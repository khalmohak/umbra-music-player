import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { coverArtUrl } from "../subsonic";
import { getScrobbles, clearScrobbles, type ScrobbleEntry } from "../db/scrobbles";

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateBucket(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;
  if (ts >= todayStart) return "Today";
  if (ts >= yesterdayStart) return "Yesterday";
  if (ts >= weekStart) return "This week";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function HistoryPage() {
  const { creds } = useAuth();
  const [entries, setEntries] = useState<ScrobbleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const reload = () => {
    setLoading(true);
    getScrobbles({ limit: 500 }).then((e) => {
      setEntries(e);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    let total = 0, todayCount = 0, todayMs = 0, allMs = 0;
    for (const e of entries) {
      total++;
      allMs += e.positionMs;
      if (e.startedAt >= ts) { todayCount++; todayMs += e.positionMs; }
    }
    return { total, todayCount, todayMs, allMs };
  }, [entries]);

  const groups = useMemo(() => {
    const map = new Map<string, ScrobbleEntry[]>();
    for (const e of entries) {
      const bucket = dateBucket(e.startedAt);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(e);
    }
    return [...map.entries()];
  }, [entries]);

  const handleClear = async () => {
    if (!confirm("Clear your entire listen history? This cannot be undone.")) return;
    setClearing(true);
    await clearScrobbles().catch(() => {});
    setEntries([]);
    setClearing(false);
  };

  if (!creds) return null;

  return (
    <div className="px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text">Listen History</h1>
            <p className="mt-1 text-sm text-muted">Logged locally on this device</p>
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger/50 hover:text-danger"
            >
              {clearing ? "Clearing…" : "Clear history"}
            </button>
          )}
        </div>

        {stats.total > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Today" value={`${stats.todayCount} tracks`} sub={stats.todayMs > 0 ? fmtMs(stats.todayMs) : undefined} />
            <StatCard label="All time" value={`${stats.total} tracks`} sub={stats.allMs > 0 ? fmtMs(stats.allMs) : undefined} />
            <StatCard
              label="Completion rate"
              value={`${Math.round((entries.filter((e) => !e.skipped).length / Math.max(1, entries.length)) * 100)}%`}
              sub="tracks finished"
            />
            <StatCard
              label="Skipped"
              value={`${entries.filter((e) => e.skipped).length}`}
              sub="tracks"
            />
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-20 text-muted">
            <span className="size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading history…</span>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface">
              <svg className="size-7 text-faint" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-base font-semibold text-text">No history yet</p>
              <p className="mt-1 text-sm text-muted">Start playing music to build your diary</p>
            </div>
          </div>
        )}

        {!loading && groups.length > 0 && (
          <div className="space-y-8 animate-fade-up">
            {groups.map(([bucket, items]) => (
              <section key={bucket}>
                <div className="mb-3 flex items-center gap-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-faint">{bucket}</p>
                  <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[0.6rem] text-faint">{items.length}</span>
                </div>
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
                  {items.map((entry, idx) => (
                    <HistoryRow key={`${entry.id ?? idx}`} entry={entry} creds={creds} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-4">
      <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-1.5 font-display text-lg font-semibold text-text">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function HistoryRow({ entry, creds }: { entry: ScrobbleEntry; creds: { username: string; password: string } }) {
  const imgSrc = entry.coverArt
    ? coverArtUrl(creds.username, creds.password, entry.coverArt, 48)
    : null;

  const pct = entry.trackDurationMs && entry.trackDurationMs > 0
    ? Math.min(100, (entry.positionMs / entry.trackDurationMs) * 100)
    : null;

  return (
    <li className="group flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-elevated">
        {imgSrc ? (
          <img src={imgSrc} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="font-display text-sm font-semibold text-faint">{entry.title.slice(0, 1)}</span>
          </div>
        )}
        {entry.skipped && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
            <svg className="size-4 text-muted" viewBox="0 0 24 24" fill="currentColor" aria-label="Skipped" aria-hidden>
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium leading-snug ${entry.skipped ? "text-muted" : "text-text"}`}>
          {entry.title}
        </p>
        <p className="truncate text-xs text-muted">
          {[entry.artist, entry.album].filter(Boolean).join(" · ")}
        </p>
        {pct !== null && (
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-border/80">
            <div
              className={`h-full rounded-full ${entry.skipped ? "bg-faint" : "bg-accent/50"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-[0.6rem] tabular-nums text-faint">{timeAgo(entry.startedAt)}</p>
        {entry.positionMs > 0 && (
          <p className="font-mono text-[0.6rem] tabular-nums text-faint">{fmtMs(entry.positionMs)}</p>
        )}
      </div>
    </li>
  );
}
