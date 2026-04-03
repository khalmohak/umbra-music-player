import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  asArray,
  getStarred2,
  star,
  unstar,
  type StarredAlbum,
  type StarredSong,
} from "../subsonic";

type StarContextValue = {
  starredSongIds: Set<string>;
  starredAlbumIds: Set<string>;
  starredArtistIds: Set<string>;
  starredSongs: StarredSong[];
  starredAlbums: StarredAlbum[];
  toggleSongStar: (id: string) => void;
  toggleAlbumStar: (id: string) => void;
  toggleArtistStar: (id: string) => void;
  loading: boolean;
};

const StarContext = createContext<StarContextValue | null>(null);

export function StarProvider({ children }: { children: ReactNode }) {
  const { creds } = useAuth();
  const [songIds, setSongIds] = useState(new Set<string>());
  const [albumIds, setAlbumIds] = useState(new Set<string>());
  const [artistIds, setArtistIds] = useState(new Set<string>());
  const [songs, setSongs] = useState<StarredSong[]>([]);
  const [albums, setAlbums] = useState<StarredAlbum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getStarred2(creds.username, creds.password);
        if (cancelled) return;
        if (res.status === "ok" && res.starred2) {
          const s = asArray(res.starred2.song);
          const al = asArray(res.starred2.album);
          const ar = asArray(res.starred2.artist);
          setSongs(s);
          setAlbums(al);
          setSongIds(new Set(s.map((x) => x.id)));
          setAlbumIds(new Set(al.map((x) => x.id)));
          setArtistIds(new Set(ar.map((x) => x.id)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds]);

  const toggleSongStar = useCallback(
    (id: string) => {
      if (!creds) return;
      setSongIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          setSongs((s) => s.filter((x) => x.id !== id));
          unstar(creds.username, creds.password, { id }).catch(() => {});
        } else {
          next.add(id);
          star(creds.username, creds.password, { id }).catch(() => {});
        }
        return next;
      });
    },
    [creds]
  );

  const toggleAlbumStar = useCallback(
    (albumId: string) => {
      if (!creds) return;
      setAlbumIds((prev) => {
        const next = new Set(prev);
        if (next.has(albumId)) {
          next.delete(albumId);
          setAlbums((a) => a.filter((x) => x.id !== albumId));
          unstar(creds.username, creds.password, { albumId }).catch(() => {});
        } else {
          next.add(albumId);
          star(creds.username, creds.password, { albumId }).catch(() => {});
        }
        return next;
      });
    },
    [creds]
  );

  const toggleArtistStar = useCallback(
    (artistId: string) => {
      if (!creds) return;
      setArtistIds((prev) => {
        const next = new Set(prev);
        if (next.has(artistId)) {
          next.delete(artistId);
          unstar(creds.username, creds.password, { artistId }).catch(() => {});
        } else {
          next.add(artistId);
          star(creds.username, creds.password, { artistId }).catch(() => {});
        }
        return next;
      });
    },
    [creds]
  );

  const value = useMemo<StarContextValue>(
    () => ({
      starredSongIds: songIds,
      starredAlbumIds: albumIds,
      starredArtistIds: artistIds,
      starredSongs: songs,
      starredAlbums: albums,
      toggleSongStar,
      toggleAlbumStar,
      toggleArtistStar,
      loading,
    }),
    [songIds, albumIds, artistIds, songs, albums, toggleSongStar, toggleAlbumStar, toggleArtistStar, loading]
  );

  return <StarContext.Provider value={value}>{children}</StarContext.Provider>;
}

export function useStarred() {
  const ctx = useContext(StarContext);
  if (!ctx) throw new Error("useStarred requires StarProvider");
  return ctx;
}
