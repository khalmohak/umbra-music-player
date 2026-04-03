import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  createPlaylist as apiCreate,
  deletePlaylist as apiDelete,
  getPlaylists,
  normalizePlaylists,
  updatePlaylist as apiUpdate,
  type PlaylistEntry,
} from "../subsonic";

export type PickerSong = { id: string; title: string };

type PlaylistContextValue = {
  playlists: PlaylistEntry[];
  loading: boolean;
  refresh: () => void;
  createPlaylist: (name: string, songIds?: string[]) => Promise<string | null>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongs: (playlistId: string, songIds: string[]) => Promise<void>;
  removeSong: (playlistId: string, songIndex: number) => Promise<void>;
  renamePlaylist: (playlistId: string, name: string) => Promise<void>;
  pickerSong: PickerSong | null;
  openPicker: (song: PickerSong) => void;
  closePicker: () => void;
};

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const { creds } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerSong, setPickerSong] = useState<PickerSong | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!creds) return;
    setLoading(true);
    try {
      const res = await getPlaylists(creds.username, creds.password);
      setPlaylists(normalizePlaylists(res));
    } finally {
      setLoading(false);
    }
  }, [creds]);

  useEffect(() => {
    void fetchPlaylists();
  }, [fetchPlaylists]);

  const createPlaylist = useCallback(
    async (name: string, songIds: string[] = []): Promise<string | null> => {
      if (!creds) return null;
      const res = await apiCreate(creds.username, creds.password, name, songIds);
      if (res.status === "ok" && res.playlist) {
        const newEntry: PlaylistEntry = {
          id: res.playlist.id,
          name: res.playlist.name,
          songCount: res.playlist.songCount ?? songIds.length,
          duration: res.playlist.duration,
          public: res.playlist.public,
        };
        setPlaylists((prev) => [newEntry, ...prev]);
        return newEntry.id;
      }
      return null;
    },
    [creds]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      if (!creds) return;
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      await apiDelete(creds.username, creds.password, id);
    },
    [creds]
  );

  const addSongs = useCallback(
    async (playlistId: string, songIds: string[]) => {
      if (!creds || songIds.length === 0) return;
      await apiUpdate(creds.username, creds.password, playlistId, { songIdsToAdd: songIds });
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, songCount: (p.songCount ?? 0) + songIds.length }
            : p
        )
      );
    },
    [creds]
  );

  const removeSong = useCallback(
    async (playlistId: string, songIndex: number) => {
      if (!creds) return;
      await apiUpdate(creds.username, creds.password, playlistId, {
        songIndicesToRemove: [songIndex],
      });
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, songCount: Math.max(0, (p.songCount ?? 1) - 1) }
            : p
        )
      );
    },
    [creds]
  );

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string) => {
      if (!creds) return;
      await apiUpdate(creds.username, creds.password, playlistId, { name });
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, name } : p))
      );
    },
    [creds]
  );

  const openPicker = useCallback((song: PickerSong) => setPickerSong(song), []);
  const closePicker = useCallback(() => setPickerSong(null), []);

  const value = useMemo<PlaylistContextValue>(
    () => ({
      playlists,
      loading,
      refresh: () => void fetchPlaylists(),
      createPlaylist,
      deletePlaylist,
      addSongs,
      removeSong,
      renamePlaylist,
      pickerSong,
      openPicker,
      closePicker,
    }),
    [playlists, loading, fetchPlaylists, createPlaylist, deletePlaylist, addSongs, removeSong, renamePlaylist, pickerSong, openPicker, closePicker]
  );

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>;
}

export function usePlaylists() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists requires PlaylistProvider");
  return ctx;
}
