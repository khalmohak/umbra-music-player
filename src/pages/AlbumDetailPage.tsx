import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer, type PlayerTrack } from "../context/PlayerContext";
import { useStarred } from "../context/StarContext";
import { usePlaylists } from "../context/PlaylistContext";
import {
  coverArtUrl,
  getAlbum,
  normalizeAlbumSongs,
  type AlbumDetailPayload,
  type AlbumSong,
} from "../subsonic";

function fmtDuration(sec: number | undefined) {
  if (sec == null || Number.isNaN(sec)) return "—";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function sortSongs(songs: AlbumSong[]) {
  return [...songs].sort((a, b) => {
    const ta = a.track ?? 999;
    const tb = b.track ?? 999;
    return ta - tb;
  });
}

export default function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const { creds } = useAuth();
  const { current, isPlaying, playQueue, addToQueue, addNext } = usePlayer();
  const { starredSongIds, toggleSongStar, starredAlbumIds, toggleAlbumStar } = useStarred();
  const { openPicker } = usePlaylists();
  const [album, setAlbum] = useState<AlbumDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [coverBroken, setCoverBroken] = useState(false);

  useEffect(() => {
    if (!albumId) {
      setLoading(false);
      setAlbum(null);
      setErr(null);
      return;
    }
    if (!creds) return;
    const { username: u, password: p } = creds;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      setAlbum(null);
      setCoverBroken(false);
      try {
        const res = await getAlbum(u, p, albumId);
        if (cancelled) return;
        if (res.status !== "ok" || !res.album) {
          const msg =
            (res as { error?: { message?: string } }).error?.message ??
            "Album not found";
          setErr(msg);
          return;
        }
        setAlbum(res.album);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Request failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [creds, albumId]);

  const songs = useMemo(
    () => (album ? sortSongs(normalizeAlbumSongs(album)) : []),
    [album]
  );

  const totalDuration = useMemo(() => {
    let t = 0;
    for (const s of songs) {
      if (typeof s.duration === "number") t += s.duration;
    }
    return t;
  }, [songs]);

  const queueTracks: PlayerTrack[] = useMemo(() => {
    if (!album) return [];
    return songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist ?? album.artist,
      artistId: album.artistId,
      albumTitle: album.name,
      albumId: album.id,
      coverArt: album.coverArt ?? album.id,
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
    }));
  }, [album, songs]);

  function playFromIndex(i: number) {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, i);
  }

  if (!creds) return null;

  if (!albumId) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted">
        Missing album id.{" "}
        <Link to="/albums" className="text-accent hover:underline">
          Back to albums
        </Link>
      </div>
    );
  }

  const coverSrc =
    album && creds
      ? coverArtUrl(creds.username, creds.password, album.coverArt ?? album.id, 480)
      : "";

  const yearLabel =
    album?.year != null && album.year !== "" ? String(album.year) : null;

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/albums"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Albums
        </Link>

        {loading && (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading album…</span>
          </div>
        )}

        {err && !loading && (
          <div className="mt-8 rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">
            {err}
          </div>
        )}

        {!loading && album && (
          <div className="animate-fade-up">
            <header className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
              <div className="mx-auto w-full max-w-[260px] shrink-0 overflow-hidden rounded-2xl border border-border/60 shadow-[var(--shadow-card)] sm:mx-0 sm:w-[220px]">
                {!coverBroken && coverSrc ? (
                  <img
                    src={coverSrc}
                    alt=""
                    className="aspect-square size-full object-cover"
                    onError={() => setCoverBroken(true)}
                  />
                ) : (
                  <div className="flex aspect-square size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
                    <span className="font-display text-5xl font-semibold text-faint">
                      {album.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                {album.artistId ? (
                  <Link
                    to={`/artists/${album.artistId}`}
                    className="text-sm font-medium text-accent transition-opacity hover:opacity-80"
                  >
                    {album.artist ?? "—"}
                  </Link>
                ) : (
                  <p className="text-sm text-muted">{album.artist ?? "—"}</p>
                )}
                <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                  {album.name}
                </h1>
                <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                  {yearLabel && <Pill>{yearLabel}</Pill>}
                  {album.genre && <Pill>{album.genre}</Pill>}
                  <Pill>{songs.length} tracks</Pill>
                  {totalDuration > 0 && <Pill mono>{fmtDuration(totalDuration)}</Pill>}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                  {queueTracks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => playFromIndex(0)}
                      className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-deep shadow-[0_0_20px_rgba(192,132,252,0.25)] transition-all hover:brightness-110 active:scale-95"
                    >
                      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Play album
                    </button>
                  )}
                  {album && (
                    <button
                      type="button"
                      onClick={() => toggleAlbumStar(album.id)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all active:scale-95 ${
                        starredAlbumIds.has(album.id)
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border bg-elevated text-muted hover:border-border-strong hover:text-text"
                      }`}
                      aria-label={starredAlbumIds.has(album.id) ? "Unstar album" : "Star album"}
                    >
                      <svg className="size-4" viewBox="0 0 24 24" fill={starredAlbumIds.has(album.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {starredAlbumIds.has(album.id) ? "Starred" : "Star"}
                    </button>
                  )}
                </div>
              </div>
            </header>

            <section className="mt-10">
              <ol className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
                {songs.map((song, i) => {
                  const active = current?.id === song.id;
                  const playing = active && isPlaying;
                  const starred = starredSongIds.has(song.id);
                  return (
                    <li key={song.id} className={`group flex items-center border-b border-border/60 last:border-b-0 ${active ? "bg-accent/8" : ""}`}>
                      <button
                        type="button"
                        onClick={() => playFromIndex(i)}
                        className={`flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors sm:px-5 ${
                          active ? "hover:bg-accent/12" : "hover:bg-elevated/60"
                        }`}
                      >
                        <span className="flex w-7 shrink-0 items-center justify-end">
                          {active ? (
                            <span className="flex items-end gap-px">
                              {[0, 160, 80].map((delay) => (
                                <span key={delay} className="inline-block w-[3px] origin-bottom rounded-full bg-accent"
                                  style={{ height: "14px", animation: playing ? `eq-bar 0.9s ease-in-out ${delay}ms infinite` : "none", transform: playing ? undefined : "scaleY(0.35)" }} />
                              ))}
                            </span>
                          ) : (
                            <span className="font-mono text-xs tabular-nums text-faint transition-opacity group-hover:opacity-0">
                              {song.track ?? i + 1}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${active ? "text-accent" : "text-text"}`}>{song.title}</p>
                          {song.artist && song.artist !== album.artist && (
                            <p className="truncate text-xs text-muted">{song.artist}</p>
                          )}
                        </div>
                        <QualityBadge suffix={song.suffix} bitRate={song.bitRate} transcodedSuffix={song.transcodedSuffix} />
                        <span className="shrink-0 font-mono text-xs tabular-nums text-faint">{fmtDuration(song.duration)}</span>
                      </button>
                      <div className="mr-2 flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => addNext(queueTracks[i])}
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
                          onClick={() => addToQueue(queueTracks[i])}
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
                          onClick={() => openPicker({ id: song.id, title: song.title })}
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
                          onClick={() => toggleSongStar(song.id)}
                          className={`rounded-full p-1.5 transition-all ${starred ? "text-accent" : "text-faint opacity-0 group-hover:opacity-100 hover:text-text"}`}
                          aria-label={starred ? "Unstar" : "Star"}
                        >
                          <svg className="size-4" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function QualityBadge({ suffix, bitRate, transcodedSuffix }: { suffix?: string; bitRate?: number; transcodedSuffix?: string }) {
  const effectiveSuffix = transcodedSuffix ?? suffix ?? "";
  if (!effectiveSuffix) return null;
  const fmt = effectiveSuffix.toUpperCase();
  const originalFmt = transcodedSuffix && transcodedSuffix !== suffix ? (suffix ?? "").toUpperCase() : null;
  const lossless = ["FLAC", "WAV", "AIFF", "ALAC", "APE", "WV"].includes((suffix ?? "").toUpperCase());
  const isLossless = lossless && !transcodedSuffix;
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono">
      <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-semibold leading-none tracking-wide ${
        isLossless ? "bg-lossless-bg text-lossless" : "bg-white/5 text-muted"
      }`}>
        {fmt}
      </span>
      {originalFmt && (
        <span className="hidden text-[0.6rem] text-faint sm:inline">← {originalFmt}</span>
      )}
      {bitRate != null && (
        <span className="hidden text-[0.6rem] tabular-nums text-faint sm:inline">{bitRate}k</span>
      )}
    </span>
  );
}

function Pill({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-border bg-elevated px-3 py-1 text-xs text-muted ${mono ? "font-mono tabular-nums" : ""}`}>
      {children}
    </span>
  );
}
