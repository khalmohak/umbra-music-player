import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer, type PlayerTrack } from "../context/PlayerContext";
import { usePlaylists } from "../context/PlaylistContext";
import { useStarred } from "../context/StarContext";
import {
  asArray,
  coverArtUrl,
  getPlaylist,
  type PlaylistSong,
} from "../subsonic";

function fmtTime(sec: number | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDur(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const { creds } = useAuth();
  const { current, isPlaying, playQueue, addToQueue, addNext } = usePlayer();
  const { starredSongIds, toggleSongStar } = useStarred();
  const { playlists, renamePlaylist, deletePlaylist, removeSong, openPicker } = usePlaylists();
  const navigate = useNavigate();

  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const playlist = playlists.find((p) => p.id === playlistId);

  useEffect(() => {
    if (!playlistId || !creds) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getPlaylist(creds.username, creds.password, playlistId);
        if (cancelled) return;
        if (res.status === "ok" && res.playlist) {
          setSongs(asArray(res.playlist.entry));
        } else {
          setErr("Playlist not found");
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds, playlistId]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const coverSrc = useMemo(() => {
    if (!creds || songs.length === 0) return "";
    return coverArtUrl(creds.username, creds.password, songs[0].coverArt ?? songs[0].id, 400);
  }, [creds, songs]);

  const totalDuration = useMemo(() => songs.reduce((t, s) => t + (s.duration ?? 0), 0), [songs]);

  const queueTracks: PlayerTrack[] = useMemo(() =>
    songs.map((s) => ({
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
    })),
    [songs]
  );

  const handleRename = async () => {
    if (!playlistId) return;
    const name = draftName.trim();
    if (!name || name === playlist?.name) { setEditingName(false); return; }
    await renamePlaylist(playlistId, name);
    setEditingName(false);
  };

  const handleDelete = async () => {
    if (!playlistId) return;
    await deletePlaylist(playlistId);
    navigate("/playlists");
  };

  const handleRemove = async (idx: number) => {
    if (!playlistId || removing !== null) return;
    setRemoving(idx);
    try {
      await removeSong(playlistId, idx);
      setSongs((prev) => prev.filter((_, i) => i !== idx));
    } finally {
      setRemoving(null);
    }
  };

  if (!creds) return null;

  const name = playlist?.name ?? "Playlist";

  return (
    <div className="pb-20">
      <div className="relative overflow-hidden">
        {coverSrc && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 scale-110 opacity-20 blur-3xl"
              style={{ backgroundImage: `url(${coverSrc})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg" />
          </div>
        )}

        <div className="relative px-4 pb-8 pt-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={() => navigate("/playlists")}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
            >
              <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Playlists
            </button>

            <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end">
              <div className="mx-auto w-48 shrink-0 overflow-hidden rounded-2xl border border-border/60 shadow-[var(--shadow-card)] sm:mx-0">
                {coverSrc ? (
                  <img src={coverSrc} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
                    <svg className="size-16 text-faint" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted">Playlist</p>

                {editingName ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); void handleRename(); }}
                    className="mt-1 flex items-center gap-2"
                  >
                    <input
                      ref={nameInputRef}
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => void handleRename()}
                      className="min-w-0 flex-1 rounded-lg border border-accent/40 bg-elevated px-3 py-1.5 font-display text-2xl font-semibold text-text outline-none focus:ring-2 focus:ring-accent/30 sm:text-3xl"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setDraftName(name); setEditingName(true); }}
                    className="group mt-1 flex items-center gap-2"
                    title="Click to rename"
                  >
                    <h1 className="font-display text-2xl font-semibold tracking-tight text-text sm:text-3xl lg:text-4xl">
                      {name}
                    </h1>
                    <svg className="size-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                )}

                <p className="mt-2 text-sm text-muted">
                  {songs.length} {songs.length === 1 ? "track" : "tracks"}
                  {totalDuration > 0 && <> · {fmtDur(totalDuration)}</>}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  {songs.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => playQueue(queueTracks, 0)}
                        className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-deep shadow-[0_0_20px_rgba(192,132,252,0.25)] transition-all hover:brightness-110 active:scale-95"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        Play all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const shuffled = [...queueTracks].sort(() => Math.random() - 0.5);
                          playQueue(shuffled, 0);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-4 py-2.5 text-sm font-medium text-text transition-all hover:border-border-strong active:scale-95"
                      >
                        <svg className="size-4 text-muted" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                        </svg>
                        Shuffle
                      </button>
                    </>
                  )}

                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-4 py-2.5 text-sm font-medium text-muted transition-all hover:border-danger/40 hover:text-danger active:scale-95"
                    >
                      <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Delete
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger-bg px-4 py-2.5">
                      <span className="text-sm text-danger">Delete?</span>
                      <button type="button" onClick={() => void handleDelete()} className="text-sm font-semibold text-danger transition-opacity hover:opacity-80">Yes</button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-muted transition-colors hover:text-text">Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-4xl">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted">
              <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {err && !loading && (
            <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{err}</div>
          )}

          {!loading && songs.length === 0 && !err && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface">
                <svg className="size-8 text-faint" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text">This playlist is empty</p>
              <p className="text-xs text-muted">Add songs from albums, artists, or the player</p>
            </div>
          )}

          {!loading && songs.length > 0 && (
            <ol className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
              {songs.map((song, i) => {
                const active = current?.id === song.id;
                const playing = active && isPlaying;
                const starred = starredSongIds.has(song.id);
                const isRemoving = removing === i;
                const thumbSrc = creds ? coverArtUrl(creds.username, creds.password, song.coverArt ?? song.id, 48) : "";

                return (
                  <li
                    key={`${song.id}-${i}`}
                    className={`group flex items-center border-b border-border/60 last:border-b-0 transition-colors ${active ? "bg-accent/8" : ""} ${isRemoving ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => playQueue(queueTracks, i)}
                      className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors sm:gap-4 ${active ? "hover:bg-accent/12" : "hover:bg-elevated/60"}`}
                    >
                      <span className="flex w-6 shrink-0 items-center justify-center">
                        {active ? (
                          <span className="flex items-end gap-px">
                            {[0, 150, 75].map((d) => (
                              <span key={d} className="inline-block w-[3px] origin-bottom rounded-full bg-accent"
                                style={{ height: "12px", animation: playing ? `eq-bar 0.9s ease-in-out ${d}ms infinite` : "none", transform: playing ? undefined : "scaleY(0.35)" }} />
                            ))}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-faint transition-opacity group-hover:opacity-0">{i + 1}</span>
                        )}
                      </span>

                      <div className="relative shrink-0 overflow-hidden rounded-md">
                        {thumbSrc ? (
                          <img src={thumbSrc} alt="" className="size-10 object-cover" loading="lazy" />
                        ) : (
                          <div className="flex size-10 items-center justify-center bg-elevated">
                            <span className="font-display text-sm font-semibold text-faint">{song.title.slice(0, 1)}</span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium leading-snug ${active ? "text-accent" : "text-text"}`}>{song.title}</p>
                        <p className="truncate text-xs text-muted">
                          {song.artist}
                          {song.artist && song.album ? " · " : ""}
                          {song.album}
                        </p>
                      </div>

                      <QualityBadge suffix={song.suffix} bitRate={song.bitRate} transcodedSuffix={song.transcodedSuffix} />

                      <span className="hidden shrink-0 font-mono text-xs tabular-nums text-faint sm:block">
                        {fmtTime(song.duration)}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 pr-3">
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
                        aria-label="Add to another playlist"
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
                      <button
                        type="button"
                        onClick={() => void handleRemove(i)}
                        disabled={isRemoving}
                        className="rounded-full p-1.5 text-faint opacity-0 transition-all group-hover:opacity-100 hover:text-danger disabled:opacity-40"
                        aria-label="Remove from playlist"
                      >
                        <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
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
