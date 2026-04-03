import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer, type PlayerTrack } from "../context/PlayerContext";
import { useStarred } from "../context/StarContext";
import { usePlaylists } from "../context/PlaylistContext";
import {
  coverArtUrl,
  search3,
  normalizeSearchArtists,
  normalizeSearchAlbums,
  normalizeSearchSongs,
  type SearchArtist,
  type AlbumSummary,
  type SearchSong,
} from "../subsonic";

function fmtTime(sec: number | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function songToTrack(s: SearchSong): PlayerTrack {
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
  };
}

function QualityBadge({ suffix, transcodedSuffix }: { suffix?: string; transcodedSuffix?: string }) {
  const fmt = (transcodedSuffix ?? suffix ?? "").toUpperCase();
  if (!fmt) return null;
  const isLossless = ["FLAC", "WAV", "AIFF", "ALAC", "APE", "WV"].includes((suffix ?? "").toUpperCase()) && !transcodedSuffix;
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold leading-none tracking-wide ${
      isLossless ? "bg-lossless-bg text-lossless" : "bg-white/5 text-muted"
    }`}>
      {fmt}
    </span>
  );
}

export default function SearchPage() {
  const { creds } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [input, setInput] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    artists: SearchArtist[];
    albums: AlbumSummary[];
    songs: SearchSong[];
  } | null>(initialQ ? null : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = input.trim();
    if (!q || !creds) { setResults(null); return; }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await search3(creds.username, creds.password, q, {
          artistCount: 6, albumCount: 12, songCount: 25,
        });
        if (res.status === "ok") {
          setResults({
            artists: normalizeSearchArtists(res),
            albums: normalizeSearchAlbums(res),
            songs: normalizeSearchSongs(res),
          });
          setSearchParams({ q }, { replace: true });
        }
      } catch {
        // aborted or network error
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [input, creds, setSearchParams]);

  const hasResults = results && (results.artists.length + results.albums.length + results.songs.length) > 0;
  const noResults = results && !hasResults;

  return (
    <div className="px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            {loading ? (
              <span className="size-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            ) : (
              <svg className="size-5 text-faint" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search artists, albums, songs…"
            className="w-full rounded-2xl border border-border bg-surface py-4 pl-12 pr-5 font-sans text-lg text-text placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
            autoComplete="off"
          />
          {input && (
            <button
              type="button"
              onClick={() => { setInput(""); setResults(null); inputRef.current?.focus(); }}
              className="absolute inset-y-0 right-4 flex items-center text-faint hover:text-muted"
              aria-label="Clear"
            >
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {!input.trim() && !results && (
          <div className="mt-24 flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface">
              <svg className="size-8 text-faint" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-display text-base font-semibold text-text">Search your library</p>
              <p className="mt-1 text-sm text-muted">Artists, albums, songs — press <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-xs text-faint">/</kbd> to focus</p>
            </div>
          </div>
        )}

        {noResults && (
          <div className="mt-20 text-center">
            <p className="text-sm text-muted">No results for <span className="font-medium text-text">"{input}"</span></p>
            <p className="mt-1 text-xs text-faint">Try a different artist, album, or song name</p>
          </div>
        )}

        {hasResults && (
          <div className="mt-8 space-y-10">
            {results.artists.length > 0 && (
              <ArtistsSection artists={results.artists} creds={creds!} />
            )}
            {results.albums.length > 0 && (
              <AlbumsSection albums={results.albums} creds={creds!} />
            )}
            {results.songs.length > 0 && (
              <SongsSection songs={results.songs} creds={creds!} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-xs text-faint">{count}</span>
    </div>
  );
}

function ArtistsSection({ artists, creds }: { artists: SearchArtist[]; creds: { username: string; password: string } }) {
  return (
    <section>
      <SectionHeader title="Artists" count={artists.length} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {artists.map((artist) => {
          const imgSrc = artist.coverArt
            ? coverArtUrl(creds.username, creds.password, artist.coverArt, 200)
            : null;
          return (
            <Link
              key={artist.id}
              to={`/artists/${artist.id}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 transition-all hover:border-accent/40 hover:bg-elevated"
            >
              <div className="relative size-16 overflow-hidden rounded-full border border-border/60">
                {imgSrc ? (
                  <img src={imgSrc} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
                    <span className="font-display text-xl font-semibold text-faint">
                      {artist.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="truncate text-xs font-medium text-text group-hover:text-accent">{artist.name}</p>
                {artist.albumCount != null && (
                  <p className="text-[0.6rem] text-faint">{artist.albumCount} albums</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AlbumsSection({ albums, creds }: { albums: AlbumSummary[]; creds: { username: string; password: string } }) {
  return (
    <section>
      <SectionHeader title="Albums" count={albums.length} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {albums.map((album) => {
          const imgSrc = album.coverArt
            ? coverArtUrl(creds.username, creds.password, album.coverArt, 200)
            : null;
          return (
            <Link
              key={album.id}
              to={`/albums/${album.id}`}
              className="group flex flex-col gap-2"
            >
              <div className="aspect-square overflow-hidden rounded-xl border border-border/60 bg-surface">
                {imgSrc ? (
                  <img src={imgSrc} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
                    <span className="font-display text-2xl font-semibold text-faint">
                      {album.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="truncate text-xs font-semibold text-text group-hover:text-accent">{album.name}</p>
                <p className="truncate text-[0.6rem] text-muted">{album.artist ?? "—"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SongsSection({ songs, creds }: { songs: SearchSong[]; creds: { username: string; password: string } }) {
  const { current, isPlaying, playTrack, addNext, addToQueue } = usePlayer();
  const { starredSongIds, toggleSongStar } = useStarred();
  const { openPicker } = usePlaylists();

  return (
    <section>
      <SectionHeader title="Songs" count={songs.length} />
      <ol className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
        {songs.map((song, i) => {
          const track = songToTrack(song);
          const active = current?.id === song.id;
          const playing = active && isPlaying;
          const starred = starredSongIds.has(song.id);
          const thumbSrc = song.coverArt
            ? coverArtUrl(creds.username, creds.password, song.coverArt, 48)
            : null;
          return (
            <li
              key={`${song.id}-${i}`}
              className={`group flex items-center border-b border-border/60 last:border-b-0 ${active ? "bg-accent/8" : ""}`}
            >
              <button
                type="button"
                onClick={() => playTrack(track)}
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
                    <span className="font-mono text-xs text-faint group-hover:opacity-0">{i + 1}</span>
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
                    {song.artist && <span>{song.artist}</span>}
                    {song.artist && song.album && <span className="text-faint"> · </span>}
                    {song.album && (
                      <span className="transition-colors group-hover:text-accent-dim">{song.album}</span>
                    )}
                  </p>
                </div>

                <QualityBadge suffix={song.suffix} transcodedSuffix={song.transcodedSuffix} />
                <span className="shrink-0 font-mono text-xs tabular-nums text-faint">{fmtTime(song.duration)}</span>
              </button>

              <div className="mr-2 flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => addNext(track)}
                  className="rounded-full p-1.5 text-faint opacity-0 transition-all group-hover:opacity-100 hover:text-text"
                  title="Play next"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M4 5h2v14H4V5zm4 0v14l11-7z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => addToQueue(track)}
                  className="rounded-full p-1.5 text-faint opacity-0 transition-all group-hover:opacity-100 hover:text-text"
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
                  title={starred ? "Unstar" : "Star"}
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
  );
}
