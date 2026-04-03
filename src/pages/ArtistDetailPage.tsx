import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import { useStarred } from "../context/StarContext";
import { usePlaylists } from "../context/PlaylistContext";
import {
  asArray,
  coverArtUrl,
  getArtist,
  getArtistInfo2,
  getSimilarSongs2,
  getTopSongs,
  normalizeArtistAlbums,
  type ArtistAlbumEntry,
  type ArtistDetailPayload,
  type ArtistInfo2Payload,
  type RadioSong,
} from "../subsonic";
import type { PlayerTrack } from "../context/PlayerContext";

function fmtTime(sec: number | undefined) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function radioSongToTrack(s: RadioSong): PlayerTrack {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    artistId: s.artistId,
    albumTitle: s.album,
    albumId: s.albumId,
    coverArt: s.coverArt,
    duration: s.duration,
    bitRate: s.bitRate,
    suffix: s.suffix,
    transcodedSuffix: s.transcodedSuffix,
    samplingRate: s.samplingRate,
    bitDepth: s.bitDepth,
    trackGain: s.replayGain?.trackGain,
    albumGain: s.replayGain?.albumGain,
    trackPeak: s.replayGain?.trackPeak,
    albumPeak: s.replayGain?.albumPeak,
  };
}

function QualityBadge({ suffix, bitRate, transcodedSuffix }: { suffix?: string; bitRate?: number; transcodedSuffix?: string }) {
  const effectiveSuffix = transcodedSuffix ?? suffix ?? "";
  if (!effectiveSuffix) return null;
  const fmt = effectiveSuffix.toUpperCase();
  const lossless = ["FLAC", "WAV", "AIFF", "ALAC", "APE", "WV"].includes((suffix ?? "").toUpperCase());
  const isLossless = lossless && !transcodedSuffix;
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono">
      <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-semibold leading-none tracking-wide ${
        isLossless ? "bg-lossless-bg text-lossless" : "bg-white/5 text-muted"
      }`}>
        {fmt}
      </span>
      {bitRate != null && (
        <span className="hidden text-[0.6rem] tabular-nums text-faint sm:inline">{bitRate}k</span>
      )}
    </span>
  );
}

function AlbumCard({
  album,
  username,
  password,
  isActive,
  isPlaying,
}: {
  album: ArtistAlbumEntry;
  username: string;
  password: string;
  isActive: boolean;
  isPlaying: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src = coverArtUrl(username, password, album.coverArt ?? album.id, 220);

  return (
    <Link
      to={`/albums/${album.id}`}
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
            <span className="font-display text-3xl font-semibold text-faint">
              {album.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {isActive && (
          <div className="absolute bottom-2 right-2 flex items-end gap-px rounded-md bg-bg/75 px-1.5 py-1 backdrop-blur-sm">
            {[0, 160, 80].map((delay) => (
              <span
                key={delay}
                className="inline-block w-[3px] rounded-full bg-accent origin-bottom"
                style={{
                  height: "12px",
                  animation: isPlaying ? `eq-bar 0.9s ease-in-out ${delay}ms infinite` : "none",
                  transform: isPlaying ? undefined : "scaleY(0.35)",
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
        {album.year != null && album.year !== "" && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{String(album.year)}</p>
        )}
      </div>
    </Link>
  );
}

export default function ArtistDetailPage() {
  const { artistId } = useParams<{ artistId: string }>();
  const { creds } = useAuth();
  const { current, isPlaying, playQueue, addToQueue, addNext } = usePlayer();
  const { starredArtistIds, toggleArtistStar, starredSongIds, toggleSongStar } = useStarred();
  const { openPicker } = usePlaylists();
  const [artist, setArtist] = useState<ArtistDetailPayload | null>(null);
  const [info, setInfo] = useState<ArtistInfo2Payload | null>(null);
  const [topTracks, setTopTracks] = useState<RadioSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [coverBroken, setCoverBroken] = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);

  useEffect(() => {
    if (!artistId || !creds) { setLoading(false); return; }
    const { username: u, password: p } = creds;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      setArtist(null);
      setInfo(null);
      setTopTracks([]);
      setCoverBroken(false);
      try {
        const [ar, inf] = await Promise.all([
          getArtist(u, p, artistId),
          getArtistInfo2(u, p, artistId).catch(() => null),
        ]);
        if (cancelled) return;
        if (ar.status !== "ok" || !ar.artist) {
          setErr((ar as { error?: { message?: string } }).error?.message ?? "Artist not found");
          return;
        }
        setArtist(ar.artist);
        if (inf?.status === "ok" && inf.artistInfo2) setInfo(inf.artistInfo2);

        const tops = await getTopSongs(u, p, ar.artist.name, 10).catch(() => null);
        if (!cancelled && tops?.status === "ok" && tops.topSongs) {
          setTopTracks(asArray(tops.topSongs.song));
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds, artistId]);

  const albums = useMemo(() => (artist ? normalizeArtistAlbums(artist) : []), [artist]);
  const sortedAlbums = useMemo(() => {
    return [...albums].sort((a, b) => {
      const ya = a.year != null ? Number(a.year) : 0;
      const yb = b.year != null ? Number(b.year) : 0;
      if (ya !== yb && !Number.isNaN(ya) && !Number.isNaN(yb)) return yb - ya;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [albums]);

  const heroUrl = useMemo(() => {
    if (!creds || !artist) return "";
    const ext = info?.largeImageUrl || info?.mediumImageUrl || info?.smallImageUrl;
    if (ext && /^https?:\/\//i.test(ext)) return ext;
    return coverArtUrl(creds.username, creds.password, artist.coverArt ?? artist.id, 480);
  }, [creds, artist, info]);

  const handleRadio = async () => {
    if (!creds || !artistId) return;
    setRadioLoading(true);
    try {
      const res = await getSimilarSongs2(creds.username, creds.password, artistId, 50);
      if (res.status === "ok" && res.similarSongs2) {
        const songs = asArray(res.similarSongs2.song);
        if (songs.length > 0) playQueue(songs.map(radioSongToTrack), 0);
      }
    } finally {
      setRadioLoading(false);
    }
  };

  if (!creds) return null;
  if (!artistId) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted">
        Missing artist.{" "}
        <Link to="/artists" className="text-accent hover:underline">Back to artists</Link>
      </div>
    );
  }

  const isArtistStarred = artistId ? starredArtistIds.has(artistId) : false;

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/artists"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Artists
        </Link>

        {loading && (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {err && !loading && (
          <div className="mt-8 rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{err}</div>
        )}

        {!loading && artist && (
          <div className="animate-fade-up">
            <header className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="mx-auto w-full max-w-[260px] shrink-0 overflow-hidden rounded-2xl border border-border/60 shadow-[var(--shadow-card)] lg:mx-0 lg:w-[260px]">
                {!coverBroken && heroUrl ? (
                  <img src={heroUrl} alt="" className="aspect-square size-full object-cover" onError={() => setCoverBroken(true)} />
                ) : (
                  <div className="flex aspect-square size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
                    <span className="font-display text-6xl font-semibold text-faint">{artist.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-center font-display text-3xl font-semibold tracking-tight text-text lg:text-left lg:text-4xl">
                  {artist.name}
                </h1>
                <p className="mt-2 text-center text-sm text-muted lg:text-left">
                  {sortedAlbums.length} {sortedAlbums.length === 1 ? "album" : "albums"}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <button
                    type="button"
                    onClick={() => void handleRadio()}
                    disabled={radioLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-all hover:bg-accent/20 active:scale-95 disabled:opacity-60"
                  >
                    {radioLoading ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
                    ) : (
                      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
                      </svg>
                    )}
                    Artist Radio
                  </button>

                  <button
                    type="button"
                    onClick={() => artistId && toggleArtistStar(artistId)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                      isArtistStarred
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-elevated text-muted hover:border-border-strong hover:text-text"
                    }`}
                    aria-label={isArtistStarred ? "Unstar artist" : "Star artist"}
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill={isArtistStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {isArtistStarred ? "Starred" : "Star"}
                  </button>
                </div>

                {info?.biography && (
                  <div
                    className="mt-6 max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-surface/80 px-4 py-3 text-sm leading-relaxed text-text-secondary [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-90 [&_p]:mb-2 [&_p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: info.biography }}
                  />
                )}
                {info?.similarArtist && asArray(info.similarArtist).length > 0 && (
                  <div className="mt-6">
                    <p className="mb-2.5 text-[0.6rem] font-semibold uppercase tracking-widest text-faint">Similar artists</p>
                    <div className="flex flex-wrap gap-2">
                      {asArray(info.similarArtist).map((s) => (
                        <Link
                          key={s.id}
                          to={`/artists/${s.id}`}
                          className="rounded-full border border-border bg-elevated px-3 py-1 text-xs text-muted transition-all hover:border-accent/50 hover:bg-accent/8 hover:text-accent"
                        >
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </header>

            {topTracks.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-4 font-display text-lg font-semibold text-text">Top Tracks</h2>
                <ul className="overflow-hidden rounded-xl border border-border/50 bg-surface/60">
                  {topTracks.map((track, idx) => {
                    const isActive = current?.id === track.id;
                    const isStarred = starredSongIds.has(track.id);
                    return (
                      <li
                        key={track.id}
                        className={`group flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-b-0 transition-colors hover:bg-accent/5 ${isActive ? "bg-accent/8" : ""}`}
                      >
                        <div className="w-5 shrink-0 text-center">
                          {isActive ? (
                            <span className="flex items-end justify-center gap-px">
                              {[0, 150, 75].map((delay) => (
                                <span key={delay} className="inline-block w-[3px] origin-bottom rounded-full bg-accent"
                                  style={{ height: "12px", animation: isPlaying ? `eq-bar 0.9s ease-in-out ${delay}ms infinite` : "none", transform: isPlaying ? undefined : "scaleY(0.35)" }} />
                              ))}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-faint group-hover:hidden">{idx + 1}</span>
                          )}
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => playQueue(topTracks.map(radioSongToTrack), idx)}
                              className="hidden size-5 items-center justify-center group-hover:flex"
                              aria-label={`Play ${track.title}`}
                            >
                              <svg className="size-4 text-text" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${isActive ? "text-accent" : "text-text"}`}>{track.title}</p>
                          {track.album && <p className="truncate text-xs text-muted">{track.album}</p>}
                        </div>
                        <QualityBadge suffix={track.suffix} bitRate={track.bitRate} transcodedSuffix={track.transcodedSuffix} />
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => addNext(radioSongToTrack(track))}
                            className="rounded-full p-1.5 text-faint opacity-0 transition-all group-hover:opacity-100 hover:text-text"
                            aria-label="Play next"
                            title="Play next"
                          >
                            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M4 5h2v14H4V5zm4 0v14l11-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => addToQueue(radioSongToTrack(track))}
                            className="rounded-full p-1.5 text-faint opacity-0 transition-all group-hover:opacity-100 hover:text-text"
                            aria-label="Add to queue"
                            title="Add to queue"
                          >
                            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zm13-5v6l-5-3 5-3z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPicker({ id: track.id, title: track.title })}
                            className="rounded-full p-1.5 text-faint opacity-0 transition-all group-hover:opacity-100 hover:text-text"
                            aria-label="Add to playlist"
                            title="Add to playlist"
                          >
                            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSongStar(track.id)}
                            className={`rounded-full p-1.5 transition-all ${isStarred ? "text-accent" : "text-faint opacity-0 group-hover:opacity-100 hover:text-text"}`}
                            aria-label={isStarred ? "Unstar" : "Star"}
                          >
                            <svg className="size-4" viewBox="0 0 24 24" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </button>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-faint">{fmtTime(track.duration)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="mt-12">
              <h2 className="mb-4 font-display text-lg font-semibold text-text">Discography</h2>
              {sortedAlbums.length === 0 ? (
                <p className="text-sm text-muted">No albums listed.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {sortedAlbums.map((al) => (
                    <li key={al.id}>
                      <AlbumCard
                        album={al}
                        username={creds.username}
                        password={creds.password}
                        isActive={current?.albumId === al.id}
                        isPlaying={isPlaying}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
