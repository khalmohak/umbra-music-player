import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import {
  coverArtUrl,
  getAlbumList2,
  normalizeAlbums,
  normalizeSearchAlbums,
  search3,
  type AlbumSummary,
} from "../subsonic";

const PAGE_BROWSE = 40;
const PAGE_SEARCH = 48;
const SEARCH_MIN = 2;

function AlbumTile({
  album,
  username,
  password,
  isActive,
  isPlaying,
  index,
}: {
  album: AlbumSummary;
  username: string;
  password: string;
  isActive: boolean;
  isPlaying: boolean;
  index: number;
}) {
  const [broken, setBroken] = useState(false);
  const src = coverArtUrl(username, password, album.coverArt ?? album.id, 260);

  return (
    <Link
      to={`/albums/${album.id}`}
      className={`group block overflow-hidden rounded-2xl border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] animate-fade-up ${
        isActive
          ? "border-accent/50 shadow-[0_0_0_1px_rgba(192,132,252,0.18)]"
          : "border-border hover:border-border-strong"
      }`}
      style={{ animationDelay: `${Math.min(index * 18, 320)}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-elevated">
        {!broken && src ? (
          <img
            src={src}
            alt=""
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
            <span className="font-display text-4xl font-semibold text-faint">
              {album.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-deep shadow-[0_0_20px_rgba(192,132,252,0.45)]">
            <svg className="size-6 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2.5 right-2.5 flex items-end gap-px rounded-lg bg-bg/80 px-2 py-1.5 backdrop-blur-sm">
            {[0, 160, 80].map((delay) => (
              <span
                key={delay}
                className="inline-block w-[3px] origin-bottom rounded-full bg-accent"
                style={{
                  height: "13px",
                  animation: isPlaying ? `eq-bar 0.9s ease-in-out ${delay}ms infinite` : "none",
                  transform: isPlaying ? undefined : "scaleY(0.3)",
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <h3 className={`line-clamp-1 text-sm font-semibold leading-snug ${isActive ? "text-accent" : "text-text"}`}>
          {album.name}
        </h3>
        {album.artist && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{album.artist}</p>
        )}
      </div>
    </Link>
  );
}

export default function AlbumsPage() {
  const { creds } = useAuth();
  const { current, isPlaying } = usePlayer();
  const [searchInput, setSearchInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextBrowseOffset, setNextBrowseOffset] = useState(0);
  const [nextSearchOffset, setNextSearchOffset] = useState(0);
  const [canLoadMoreBrowse, setCanLoadMoreBrowse] = useState(false);
  const [canLoadMoreSearch, setCanLoadMoreSearch] = useState(false);

  const isSearch = debounced.trim().length >= SEARCH_MIN;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(searchInput), 320);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!creds) return;
    const { username: u, password: p } = creds;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      try {
        if (debounced.trim().length >= SEARCH_MIN) {
          const q = debounced.trim();
          const res = await search3(u, p, q, { albumCount: PAGE_SEARCH, albumOffset: 0, artistCount: 0, songCount: 0 });
          if (cancelled) return;
          if (res.status !== "ok") {
            setErr((res as { error?: { message?: string } }).error?.message ?? "Search failed");
            setAlbums([]);
            setCanLoadMoreSearch(false);
            return;
          }
          const list = normalizeSearchAlbums(res);
          setAlbums(list);
          setNextSearchOffset(list.length);
          setCanLoadMoreSearch(list.length >= PAGE_SEARCH);
          setNextBrowseOffset(0);
          setCanLoadMoreBrowse(false);
        } else {
          const res = await getAlbumList2(u, p, { type: "alphabeticalByName", size: PAGE_BROWSE, offset: 0 });
          if (cancelled) return;
          if (res.status !== "ok") {
            setErr((res as { error?: { message?: string } }).error?.message ?? "Could not load albums");
            setAlbums([]);
            setCanLoadMoreBrowse(false);
            return;
          }
          const list = normalizeAlbums(res);
          setAlbums(list);
          setNextBrowseOffset(list.length);
          setCanLoadMoreBrowse(list.length >= PAGE_BROWSE);
          setNextSearchOffset(0);
          setCanLoadMoreSearch(false);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Request failed");
          setAlbums([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [creds, debounced]);

  const loadMoreBrowse = useCallback(async () => {
    if (!creds || loadingMore || !canLoadMoreBrowse) return;
    const { username: u, password: p } = creds;
    setLoadingMore(true);
    setErr(null);
    try {
      const res = await getAlbumList2(u, p, { type: "alphabeticalByName", size: PAGE_BROWSE, offset: nextBrowseOffset });
      if (res.status !== "ok") {
        setErr((res as { error?: { message?: string } }).error?.message ?? "Could not load more");
        return;
      }
      const chunk = normalizeAlbums(res);
      setAlbums((prev) => [...prev, ...chunk]);
      setNextBrowseOffset((o) => o + chunk.length);
      setCanLoadMoreBrowse(chunk.length >= PAGE_BROWSE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoadingMore(false);
    }
  }, [creds, loadingMore, canLoadMoreBrowse, nextBrowseOffset]);

  const loadMoreSearch = useCallback(async () => {
    if (!creds || loadingMore || !canLoadMoreSearch) return;
    const { username: u, password: p } = creds;
    const q = debounced.trim();
    if (q.length < SEARCH_MIN) return;
    setLoadingMore(true);
    setErr(null);
    try {
      const res = await search3(u, p, q, { albumCount: PAGE_SEARCH, albumOffset: nextSearchOffset, artistCount: 0, songCount: 0 });
      if (res.status !== "ok") {
        setErr((res as { error?: { message?: string } }).error?.message ?? "Could not load more");
        return;
      }
      const chunk = normalizeSearchAlbums(res);
      setAlbums((prev) => [...prev, ...chunk]);
      setNextSearchOffset((o) => o + chunk.length);
      setCanLoadMoreSearch(chunk.length >= PAGE_SEARCH);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoadingMore(false);
    }
  }, [creds, loadingMore, canLoadMoreSearch, debounced, nextSearchOffset]);

  if (!creds) return null;

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Albums
            </h1>
            <p className="mt-1 text-sm text-muted">
              {isSearch ? `Searching "${debounced.trim()}"` : "Alphabetical — type to search"}
            </p>
          </div>
          <div>
            <label className="sr-only" htmlFor="album-search">Search albums</label>
            <input
              id="album-search"
              type="search"
              autoComplete="off"
              placeholder="Search albums…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full max-w-sm rounded-xl border border-border bg-elevated/80 px-4 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(192,132,252,0.14)] sm:w-auto"
            />
          </div>
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">
            {err}
          </div>
        )}

        {loading && (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading albums…</span>
          </div>
        )}

        {!loading && (
          <>
            <p className="mt-6 text-xs text-muted">
              {albums.length.toLocaleString()} {albums.length === 1 ? "album" : "albums"}
              {isSearch ? " matched" : ""}
            </p>

            {albums.length === 0 && !err && (
              <p className="mt-12 text-center text-sm text-muted">
                {isSearch ? "No albums match that search." : "No albums in the library."}
              </p>
            )}

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {albums.map((album, i) => (
                <li key={album.id}>
                  <AlbumTile
                    album={album}
                    username={creds.username}
                    password={creds.password}
                    isActive={current?.albumId === album.id}
                    isPlaying={isPlaying}
                    index={i}
                  />
                </li>
              ))}
            </ul>

            {(isSearch ? canLoadMoreSearch : canLoadMoreBrowse) && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void (isSearch ? loadMoreSearch() : loadMoreBrowse())}
                  className="rounded-xl border border-border bg-elevated px-6 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:border-border-strong hover:text-text disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
