import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer, type PlayerTrack } from "../context/PlayerContext";
import {
  asArray,
  coverArtUrl,
  getAlbumList2,
  getGenres,
  normalizeAlbums,
  type Genre,
} from "../subsonic";

export default function GenresPage() {
  const params = useParams<{ genre?: string }>();
  const genre = params.genre ? decodeURIComponent(params.genre) : null;

  if (genre) return <GenreAlbumsPage genre={genre} />;
  return <GenreListPage />;
}

function GenreListPage() {
  const { creds } = useAuth();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getGenres(creds.username, creds.password);
        if (cancelled) return;
        if (res.status === "ok" && res.genres) {
          const list = asArray(res.genres.genre)
            .filter((g) => g.albumCount > 0)
            .sort((a, b) => b.albumCount - a.albumCount);
          setGenres(list);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load genres");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds]);

  const filtered = useMemo(() => {
    if (!query.trim()) return genres;
    const q = query.toLowerCase();
    return genres.filter((g) => g.value.toLowerCase().includes(q));
  }, [genres, query]);

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 animate-fade-up">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">Genres</h1>
          <p className="mt-2 text-sm text-muted">Browse your library by genre</p>
        </div>

        <div className="mb-6">
          <input
            type="search"
            placeholder="Filter genres…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder-faint outline-none transition-all focus:border-accent/40 focus:ring-2 focus:ring-[rgba(192,132,252,0.14)]"
          />
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading genres…</span>
          </div>
        )}

        {err && !loading && (
          <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{err}</div>
        )}

        {!loading && filtered.length === 0 && !err && (
          <p className="py-12 text-center text-sm text-muted">No genres found.</p>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="flex flex-wrap gap-2 animate-fade-up">
            {filtered.map((g, i) => (
              <li key={g.value} className="animate-fade-up" style={{ animationDelay: `${i * 15}ms` }}>
                <Link
                  to={`/genres/${encodeURIComponent(g.value)}`}
                  className="group flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm transition-all hover:border-accent/40 hover:bg-accent/8 hover:text-accent"
                >
                  <span className="font-medium text-text group-hover:text-accent">{g.value}</span>
                  <span className="font-mono text-[0.65rem] text-faint tabular-nums">{g.albumCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GenreAlbumsPage({ genre }: { genre: string }) {
  const { creds } = useAuth();
  const { playQueue } = usePlayer();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<ReturnType<typeof normalizeAlbums>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 48;

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      setAlbums([]);
      setHasMore(true);
      try {
        const res = await getAlbumList2(creds.username, creds.password, { type: "byGenre", size: PAGE, genre });
        if (cancelled) return;
        const list = normalizeAlbums(res);
        setAlbums(list);
        setHasMore(list.length === PAGE);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds, genre]);

  const loadMore = async () => {
    if (!creds || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getAlbumList2(creds.username, creds.password, { type: "byGenre", size: PAGE, offset: albums.length, genre });
      const more = normalizeAlbums(res);
      setAlbums((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate("/genres")}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Genres
        </button>

        <div className="mt-8 mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/8 px-4 py-1.5 text-sm font-medium text-accent">
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {genre}
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-text">
            {albums.length > 0 ? `${albums.length}${hasMore ? "+" : ""} albums` : "Albums"}
          </h1>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {err && !loading && (
          <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{err}</div>
        )}

        {!loading && albums.length === 0 && !err && (
          <p className="py-12 text-center text-sm text-muted">No albums in this genre.</p>
        )}

        {albums.length > 0 && creds && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {albums.map((album, i) => (
              <li key={album.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}>
                <GenreAlbumCard album={album} username={creds.username} password={creds.password} />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading && albums.length > 0 && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-2.5 text-sm font-medium text-text transition-all hover:border-border-strong disabled:opacity-60"
            >
              {loadingMore ? (
                <span className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
              ) : null}
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GenreAlbumCard({
  album,
  username,
  password,
}: {
  album: { id: string; name: string; artist?: string; coverArt?: string };
  username: string;
  password: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = coverArtUrl(username, password, album.coverArt ?? album.id, 220);

  return (
    <Link
      to={`/albums/${album.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    >
      <div className="relative aspect-square overflow-hidden bg-elevated">
        {!broken && src ? (
          <img src={src} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
            <span className="font-display text-3xl font-semibold text-faint">{album.name.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-deep">
            <svg className="size-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="line-clamp-1 text-sm font-semibold text-text">{album.name}</p>
        {album.artist && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{album.artist}</p>}
      </div>
    </Link>
  );
}
