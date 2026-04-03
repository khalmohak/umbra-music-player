import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStarred } from "../context/StarContext";
import { usePlaylists } from "../context/PlaylistContext";
import {
  coverArtUrl,
  countArtists,
  getAlbumList2,
  getArtists,
  normalizeAlbums,
  type AlbumSummary,
} from "../subsonic";

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

type LibraryData = {
  artistCount: number;
  albumCount: number;
  frequent: AlbumSummary[];
  recent: AlbumSummary[];
};

export default function StatsPage() {
  const { creds } = useAuth();
  const { starredSongs, starredAlbums } = useStarred();
  const { playlists } = usePlaylists();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!creds) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { username: u, password: p } = creds;
        const [artistsRes, frequentRes, recentRes, albumCountRes] = await Promise.all([
          getArtists(u, p),
          getAlbumList2(u, p, { type: "frequent", size: 20 }),
          getAlbumList2(u, p, { type: "recent", size: 15 }),
          getAlbumList2(u, p, { type: "alphabeticalByName", size: 500 }),
        ]);
        if (cancelled) return;
        setData({
          artistCount: artistsRes.status === "ok" && artistsRes.artists ? countArtists(artistsRes.artists) : 0,
          albumCount: normalizeAlbums(albumCountRes).length,
          frequent: normalizeAlbums(frequentRes),
          recent: normalizeAlbums(recentRes),
        });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [creds]);

  const topArtists = useMemo(() => {
    if (!data?.frequent) return [];
    const map = new Map<string, { id?: string; name: string; plays: number; albums: number }>();
    for (const album of data.frequent) {
      const key = album.artistId ?? album.artist ?? "";
      if (!key) continue;
      const entry = map.get(key);
      if (entry) {
        entry.plays += album.playCount ?? 0;
        entry.albums += 1;
      } else {
        map.set(key, {
          id: album.artistId,
          name: album.artist ?? "Unknown",
          plays: album.playCount ?? 0,
          albums: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.plays - a.plays).slice(0, 8);
  }, [data]);

  const totalPlays = useMemo(
    () => data?.frequent.reduce((s, a) => s + (a.playCount ?? 0), 0) ?? 0,
    [data]
  );

  if (!creds) return null;

  return (
    <div className="px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text">Listening Insights</h1>
          <p className="mt-1.5 text-sm text-muted">Your library stats and listening history</p>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-20 text-muted">
            <span className="size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading stats…</span>
          </div>
        )}

        {err && !loading && (
          <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">{err}</div>
        )}

        {!loading && data && (
          <div className="space-y-12 animate-fade-up">
            <section>
              <SectionLabel>Library</SectionLabel>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  value={data.artistCount}
                  label="Artists"
                  icon={
                    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm-2 6a5 5 0 0010 0v-1a1 1 0 10-2 0v1a3 3 0 11-6 0v-1a1 1 0 00-2 0v1zm7 6H8a1 1 0 000 2h4a1 1 0 000-2z" />
                    </svg>
                  }
                  href="/artists"
                />
                <StatCard
                  value={data.albumCount >= 500 ? "500+" : data.albumCount}
                  label="Albums"
                  icon={
                    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-5a3 3 0 110-6 3 3 0 010 6zm0-1.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clipRule="evenodd" />
                    </svg>
                  }
                  href="/albums"
                />
                <StatCard
                  value={playlists.length}
                  label="Playlists"
                  icon={
                    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h6a1 1 0 100-2H3zm8 0a1 1 0 000 2h3a1 1 0 100-2h-3z" />
                    </svg>
                  }
                  href="/playlists"
                />
                <StatCard
                  value={starredSongs.length + starredAlbums.length}
                  label="Starred"
                  icon={
                    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  }
                />
              </div>
            </section>

            {data.frequent.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <SectionLabel>Most Played Albums</SectionLabel>
                  {totalPlays > 0 && (
                    <span className="text-xs text-muted">
                      <span className="font-semibold text-text">{totalPlays.toLocaleString()}</span> total plays tracked
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {data.frequent.slice(0, 10).map((album, rank) => (
                    <FrequentAlbumCard key={album.id} album={album} rank={rank + 1} creds={creds} />
                  ))}
                </div>
              </section>
            )}

            {topArtists.length > 0 && topArtists.some((a) => a.plays > 0) && (
              <section>
                <SectionLabel>Top Artists</SectionLabel>
                <p className="mb-4 text-xs text-faint">Aggregated from most-played albums</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {topArtists.map((artist, i) => (
                    <div
                      key={artist.id ?? artist.name}
                      className="flex items-center gap-4 rounded-xl border border-border/60 bg-surface px-4 py-3"
                    >
                      <span className="w-5 shrink-0 font-mono text-xs font-bold text-accent">#{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        {artist.id ? (
                          <Link to={`/artists/${artist.id}`} className="truncate text-sm font-semibold text-text hover:text-accent transition-colors">
                            {artist.name}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-semibold text-text">{artist.name}</p>
                        )}
                        <p className="text-xs text-muted">{artist.albums} {artist.albums === 1 ? "album" : "albums"}</p>
                      </div>
                      {artist.plays > 0 && (
                        <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 font-mono text-xs font-medium text-accent">
                          {artist.plays.toLocaleString()} plays
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.recent.length > 0 && (
              <section>
                <SectionLabel>Recently Played</SectionLabel>
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
                  {data.recent.map((album) => {
                    const imgSrc = album.coverArt
                      ? coverArtUrl(creds.username, creds.password, album.coverArt, 48)
                      : null;
                    return (
                      <li key={album.id} className="group border-b border-border/60 last:border-b-0">
                        <Link
                          to={`/albums/${album.id}`}
                          className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-elevated/60"
                        >
                          <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-border/60">
                            {imgSrc ? (
                              <img src={imgSrc} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center bg-elevated">
                                <span className="font-display text-sm font-semibold text-faint">{album.name.slice(0, 1)}</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-text group-hover:text-accent transition-colors">{album.name}</p>
                            <p className="truncate text-xs text-muted">{album.artist}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {album.playCount != null && album.playCount > 0 && (
                              <p className="font-mono text-xs text-muted">{album.playCount} plays</p>
                            )}
                            <p className="font-mono text-xs text-faint">{timeAgo(album.lastPlayed)}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[0.6rem] font-semibold uppercase tracking-widest text-faint">{children}</p>
  );
}

function StatCard({
  value,
  label,
  icon,
  href,
}: {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-surface p-4 transition-all hover:border-accent/30 hover:bg-elevated">
      <span className="text-accent opacity-70">{icon}</span>
      <span className="font-display text-2xl font-semibold tabular-nums text-text">{typeof value === "number" ? value.toLocaleString() : value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : <div>{inner}</div>;
}

function FrequentAlbumCard({
  album,
  rank,
  creds,
}: {
  album: AlbumSummary;
  rank: number;
  creds: { username: string; password: string };
}) {
  const imgSrc = album.coverArt
    ? coverArtUrl(creds.username, creds.password, album.coverArt, 200)
    : null;
  return (
    <Link to={`/albums/${album.id}`} className="group flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-surface">
        {imgSrc ? (
          <img src={imgSrc} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
            <span className="font-display text-2xl font-semibold text-faint">{album.name.slice(0, 1)}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-bg/80 font-mono text-[0.6rem] font-bold text-accent backdrop-blur-sm">
          {rank}
        </div>
        {album.playCount != null && album.playCount > 0 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-bg/80 px-2 py-0.5 font-mono text-[0.55rem] text-accent backdrop-blur-sm">
            {album.playCount.toLocaleString()}×
          </div>
        )}
      </div>
      <div>
        <p className="truncate text-xs font-semibold text-text group-hover:text-accent">{album.name}</p>
        <p className="truncate text-[0.6rem] text-muted">{album.artist ?? "—"}</p>
      </div>
    </Link>
  );
}
