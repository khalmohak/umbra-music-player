import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import { useStarred } from "../context/StarContext";
import {
  coverArtUrl,
  countArtists,
  getAlbumList2,
  getArtists,
  getLicense,
  normalizeAlbums,
  ping,
  type AlbumSummary,
  type SubsonicPingOk,
} from "../subsonic";

type HomeData = {
  ping: SubsonicPingOk;
  artistCount: number;
  albumCount: number;
  newest: AlbumSummary[];
  frequent: AlbumSummary[];
  random: AlbumSummary[];
  licenseValid: boolean | null;
};

export default function HomePage() {
  const { creds, logout } = useAuth();
  const { current, isPlaying, togglePlayPause, playQueue } = usePlayer();
  const { playlists } = usePlaylists();
  const { starredSongs, starredAlbums, starredSongIds, toggleSongStar, loading: starLoading } = useStarred();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [randomKey, setRandomKey] = useState(0);
  const [randomAlbums, setRandomAlbums] = useState<AlbumSummary[]>([]);
  const [randomLoading, setRandomLoading] = useState(false);

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { username: u, password: p } = creds;
        const pingRes = await ping(u, p);
        if (pingRes.status !== "ok") {
          setErr("Session expired. Sign in again.");
          logout();
          return;
        }
        const [artistsRes, newestRes, frequentRes, randomRes, licRes] = await Promise.all([
          getArtists(u, p),
          getAlbumList2(u, p, { type: "newest", size: 16 }),
          getAlbumList2(u, p, { type: "frequent", size: 12 }),
          getAlbumList2(u, p, { type: "random", size: 6 }),
          getLicense(u, p),
        ]);
        if (cancelled) return;

        const artistCount = artistsRes.status === "ok" && artistsRes.artists ? countArtists(artistsRes.artists) : 0;
        const newest = normalizeAlbums(newestRes);
        const frequent = normalizeAlbums(frequentRes);
        const random = normalizeAlbums(randomRes);
        setRandomAlbums(random);

        const albumCountRes = await getAlbumList2(u, p, { type: "alphabeticalByName", size: 500 });
        if (cancelled) return;
        const albumList = normalizeAlbums(albumCountRes);
        const albumCount = albumList.length === 500 ? 500 : albumList.length;

        if (!cancelled) {
          setData({
            ping: pingRes as SubsonicPingOk,
            artistCount,
            albumCount,
            newest,
            frequent,
            random,
            licenseValid: licRes.status === "ok" && licRes.license ? licRes.license.valid === true : null,
          });
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds, logout]);

  const refreshRandom = async () => {
    if (!creds || randomLoading) return;
    setRandomLoading(true);
    setRandomKey((k) => k + 1);
    try {
      const res = await getAlbumList2(creds.username, creds.password, { type: "random", size: 6 });
      setRandomAlbums(normalizeAlbums(res));
    } finally {
      setRandomLoading(false);
    }
  };

  const heroCoverSrc = useMemo(() => {
    if (!creds || !current) return "";
    return coverArtUrl(creds.username, creds.password, current.coverArt ?? current.id, 400);
  }, [creds, current]);

  if (!creds) return null;

  const greeting = getGreeting();

  return (
    <div className="pb-20">
      <div className="relative overflow-hidden px-4 pb-10 pt-10 sm:px-6 lg:px-10">
        {heroCoverSrc && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div
              className="absolute inset-0 scale-110 opacity-[0.09] blur-[80px]"
              style={{ backgroundImage: `url(${heroCoverSrc})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/60 to-bg" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl animate-fade-up">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            Good {greeting},{" "}
            <span className="text-accent">{creds.username}</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isPlaying && current ? `Playing: ${current.title}` : "What are we spinning today?"}
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-12">

          {loading && (
            <div className="flex flex-col items-center gap-4 py-20 text-muted">
              <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
              <span className="text-sm">Loading library…</span>
            </div>
          )}

          {err && !loading && (
            <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{err}</div>
          )}

          {!loading && data && (
            <>
              {current && (
                <NowPlayingHero
                  current={current}
                  isPlaying={isPlaying}
                  onToggle={togglePlayPause}
                  coverSrc={heroCoverSrc}
                  username={creds.username}
                  password={creds.password}
                />
              )}

              <section className="animate-fade-up" style={{ animationDelay: "40ms" }}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard
                    label="Artists"
                    value={data.artistCount.toLocaleString()}
                    sub="in your library"
                    to="/artists"
                    icon={
                      <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm-2 6a5 5 0 0010 0v-1a1 1 0 10-2 0v1a3 3 0 11-6 0v-1a1 1 0 00-2 0v1zm7 6H8a1 1 0 000 2h4a1 1 0 000-2z" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Albums"
                    value={data.albumCount === 500 ? "500+" : data.albumCount.toLocaleString()}
                    sub="across all artists"
                    to="/albums"
                    icon={
                      <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Playlists"
                    value={playlists.length.toLocaleString()}
                    sub="curated lists"
                    to="/playlists"
                    icon={
                      <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Starred"
                    value={(starredAlbums.length + starredSongs.length).toLocaleString()}
                    sub="songs & albums"
                    icon={
                      <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    }
                  />
                </div>
              </section>

              {data.newest.length > 0 && (
                <section className="animate-fade-up" style={{ animationDelay: "80ms" }}>
                  <SectionHeader title="Recently Added" seeAllTo="/albums" />
                  <AlbumShelf albums={data.newest} username={creds.username} password={creds.password} />
                </section>
              )}

              {data.frequent.length > 0 && (
                <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
                  <SectionHeader title="Most Played" />
                  <AlbumShelf albums={data.frequent} username={creds.username} password={creds.password} />
                </section>
              )}

              {randomAlbums.length > 0 && (
                <section className="animate-fade-up" style={{ animationDelay: "160ms" }}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-text">Discover</h2>
                      <p className="mt-0.5 text-xs text-muted">Something you might've forgotten about</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshRandom()}
                      disabled={randomLoading}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-border-strong hover:text-text disabled:opacity-60"
                    >
                      <svg className={`size-3.5 ${randomLoading ? "animate-spin" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      Reshuffle
                    </button>
                  </div>
                  <ul key={randomKey} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                    {randomAlbums.map((a, i) => (
                      <li key={a.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                        <AlbumCard album={a} username={creds.username} password={creds.password} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {playlists.length > 0 && (
                <section className="animate-fade-up" style={{ animationDelay: "200ms" }}>
                  <SectionHeader title="Playlists" seeAllTo="/playlists" />
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {playlists.slice(0, 6).map((pl, i) => (
                      <li key={pl.id} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                        <Link
                          to={`/playlists/${pl.id}`}
                          className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-all hover:border-border-strong hover:-translate-y-px"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent-dim/20">
                            <svg className="size-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-text group-hover:text-accent transition-colors">{pl.name}</p>
                            <p className="mt-0.5 font-mono text-[0.65rem] tabular-nums text-muted">
                              {pl.songCount != null ? `${pl.songCount} tracks` : ""}
                              {pl.duration != null && pl.duration > 0 ? ` · ${fmtDur(pl.duration)}` : ""}
                            </p>
                          </div>
                          <svg className="size-4 shrink-0 text-faint" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!starLoading && (starredAlbums.length > 0 || starredSongs.length > 0) && (
                <section className="animate-fade-up" style={{ animationDelay: "240ms" }}>
                  <div className="mb-4 flex items-center gap-2">
                    <svg className="size-4 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <h2 className="font-display text-lg font-semibold text-text">Starred</h2>
                  </div>

                  {starredAlbums.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-widest text-faint">Albums</p>
                      <AlbumShelf
                        albums={starredAlbums.slice(0, 12).map((a) => ({ id: a.id, name: a.name, artist: a.artist, coverArt: a.coverArt }))}
                        username={creds.username}
                        password={creds.password}
                      />
                    </div>
                  )}

                  {starredSongs.length > 0 && (
                    <div>
                      <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-widest text-faint">Songs</p>
                      <ul className="overflow-hidden rounded-xl border border-border/50 bg-surface/60">
                        {starredSongs.slice(0, 10).map((song, idx) => (
                          <li key={song.id} className="group flex items-center border-b border-border/40 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => playQueue(starredSongs.map((s) => ({
                                id: s.id, title: s.title, artist: s.artist, artistId: s.artistId,
                                albumTitle: s.album, albumId: s.albumId, coverArt: s.coverArt, duration: s.duration,
                              })), idx)}
                              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/5"
                            >
                              <span className="w-5 shrink-0 font-mono text-xs text-faint">{idx + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-text">{song.title}</p>
                                <p className="truncate text-xs text-muted">{song.artist}{song.album ? ` · ${song.album}` : ""}</p>
                              </div>
                              <span className="shrink-0 font-mono text-xs text-faint">
                                {song.duration != null ? fmtTime(song.duration) : ""}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSongStar(song.id)}
                              className={`mr-3 shrink-0 rounded-full p-1.5 transition-all ${starredSongIds.has(song.id) ? "text-accent" : "text-faint opacity-0 group-hover:opacity-100"}`}
                              aria-label="Unstar"
                            >
                              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              <section className="animate-fade-up border-t border-border/40 pt-8" style={{ animationDelay: "280ms" }}>
                <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-faint mb-3">Server Info</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted">
                  <span>API <span className="font-mono text-text-secondary">{data.ping.version}</span></span>
                  <span>Server <span className="font-mono text-text-secondary">{data.ping.type ?? (data.ping.openSubsonic ? "OpenSubsonic" : "Subsonic")}</span></span>
                  {data.licenseValid != null && (
                    <span>License <span className={`font-mono ${data.licenseValid ? "text-accent" : "text-danger"}`}>{data.licenseValid ? "valid" : "invalid"}</span></span>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NowPlayingHero({
  current,
  isPlaying,
  onToggle,
  coverSrc,
  username,
  password,
}: {
  current: { id: string; title: string; artist?: string; artistId?: string; albumTitle?: string; albumId?: string; coverArt?: string };
  isPlaying: boolean;
  onToggle: () => void;
  coverSrc: string;
  username: string;
  password: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface animate-fade-up">
      {coverSrc && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-25 blur-2xl scale-110"
            style={{ backgroundImage: `url(${coverSrc})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
          <div className="absolute inset-0 bg-surface/70" />
        </div>
      )}
      <div className="relative flex items-center gap-5 p-4 sm:p-5">
        <div className="relative shrink-0">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              className={`size-16 rounded-xl object-cover shadow-[var(--shadow-soft)] sm:size-20 ${isPlaying ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-surface" : ""}`}
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-xl bg-elevated sm:size-20">
              <span className="font-display text-2xl font-semibold text-faint">{(current.title || "?").slice(0, 1)}</span>
            </div>
          )}
          {isPlaying && (
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent shadow-[0_0_8px_rgba(192,132,252,0.6)]">
              <span className="flex items-end gap-px">
                {[0, 150, 75].map((d) => (
                  <span key={d} className="inline-block w-[2px] origin-bottom rounded-full bg-accent-deep"
                    style={{ height: "7px", animation: `eq-bar 0.85s ease-in-out ${d}ms infinite` }} />
                ))}
              </span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-accent">Now {isPlaying ? "Playing" : "Paused"}</p>
          <p className="mt-0.5 font-display text-lg font-semibold leading-tight text-text sm:text-xl">{current.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            {current.artistId ? (
              <Link to={`/artists/${current.artistId}`} className="transition-colors hover:text-accent">{current.artist}</Link>
            ) : current.artist ? (
              <span>{current.artist}</span>
            ) : null}
            {current.artist && current.albumTitle && <span className="text-faint">·</span>}
            {current.albumId ? (
              <Link to={`/albums/${current.albumId}`} className="transition-colors hover:text-accent">{current.albumTitle}</Link>
            ) : current.albumTitle ? (
              <span>{current.albumTitle}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="flex shrink-0 size-11 items-center justify-center rounded-full bg-accent text-accent-deep shadow-[0_0_20px_rgba(192,132,252,0.3)] transition-all hover:brightness-110 active:scale-95"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg className="size-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

function AlbumShelf({
  albums,
  username,
  password,
}: {
  albums: AlbumSummary[];
  username: string;
  password: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {albums.map((a, i) => (
          <div
            key={a.id}
            className="w-[140px] shrink-0 animate-fade-up sm:w-[160px]"
            style={{ scrollSnapAlign: "start", animationDelay: `${i * 30}ms` }}
          >
            <AlbumCard album={a} username={username} password={password} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-bg to-transparent" aria-hidden />
    </div>
  );
}

function AlbumCard({
  album,
  username,
  password,
}: {
  album: AlbumSummary;
  username: string;
  password: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = coverArtUrl(username, password, album.coverArt ?? album.id, 260);

  return (
    <Link
      to={`/albums/${album.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
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
            <span className="font-display text-3xl font-semibold text-faint">{album.name.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-deep shadow-[0_0_12px_rgba(192,132,252,0.5)]">
            <svg className="size-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="line-clamp-1 text-xs font-semibold text-text">{album.name}</p>
        {album.artist && <p className="mt-0.5 line-clamp-1 text-[0.65rem] text-muted">{album.artist}</p>}
      </div>
    </Link>
  );
}

function SectionHeader({ title, seeAllTo }: { title: string; seeAllTo?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {seeAllTo && (
        <Link to={seeAllTo} className="text-xs font-medium text-muted transition-colors hover:text-accent">
          See all →
        </Link>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  to?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-all duration-150 hover:border-border-strong sm:p-5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tracking-tight text-text font-display">{value}</p>
        <p className="mt-0.5 text-[0.65rem] font-medium text-muted">{label}</p>
        {sub && <p className="text-[0.6rem] text-faint">{sub}</p>}
      </div>
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return <div>{inner}</div>;
}

function fmtTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDur(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
