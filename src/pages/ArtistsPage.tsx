import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import { coverArtUrl, flattenArtistList, getArtists } from "../subsonic";

function ArtistCard({
  id,
  name,
  username,
  password,
  isActive,
  isPlaying,
}: {
  id: string;
  name: string;
  username: string;
  password: string;
  isActive: boolean;
  isPlaying: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src = coverArtUrl(username, password, id, 220);

  return (
    <Link
      to={`/artists/${id}`}
      className={`group block overflow-hidden rounded-2xl border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${
        isActive
          ? "border-accent/50 shadow-[0_0_0_1px_rgba(192,132,252,0.18)]"
          : "border-border hover:border-border-strong"
      }`}
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
              {name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className={`truncate text-sm font-semibold leading-snug ${isActive ? "text-accent" : "text-text"}`}>
          {name}
        </p>
      </div>
    </Link>
  );
}

export default function ArtistsPage() {
  const { creds } = useAuth();
  const { current, isPlaying } = usePlayer();
  const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!creds) return;
    const { username: u, password: p } = creds;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getArtists(u, p);
        if (cancelled) return;
        if (res.status !== "ok") {
          setErr((res as { error?: { message?: string } }).error?.message ?? "Could not load artists");
          setArtists([]);
          return;
        }
        setArtists(flattenArtistList(res));
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Request failed");
          setArtists([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(s));
  }, [artists, q]);

  if (!creds) return null;

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Artists
            </h1>
            <p className="mt-1 text-sm text-muted">
              {!loading && `${artists.length.toLocaleString()} artists in library`}
            </p>
          </div>
          <label className="sr-only" htmlFor="artist-search">Search artists</label>
          <input
            id="artist-search"
            type="search"
            placeholder="Filter artists…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-border bg-elevated/80 px-4 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(192,132,252,0.14)] sm:w-auto"
          />
        </div>

        {err && (
          <div className="mt-6 rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">
            {err}
          </div>
        )}

        {loading && (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading artists…</span>
          </div>
        )}

        {!loading && (
          <>
            {q.trim() && (
              <p className="mt-6 text-xs text-muted">
                {filtered.length} of {artists.length} artists
              </p>
            )}

            {filtered.length === 0 ? (
              <p className="mt-12 text-center text-sm text-muted">No artists match.</p>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filtered.map((a, i) => (
                  <li
                    key={a.id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                  >
                    <ArtistCard
                      id={a.id}
                      name={a.name}
                      username={creds.username}
                      password={creds.password}
                      isActive={current?.artistId === a.id}
                      isPlaying={isPlaying}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
