import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlaylists } from "../context/PlaylistContext";

function fmtDur(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function PlaylistsPage() {
  const { playlists, loading, createPlaylist } = usePlaylists();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      await createPlaylist(name);
      setNewName("");
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text sm:text-4xl">Playlists</h1>
            <p className="mt-1.5 text-sm text-muted">{playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-all hover:bg-accent/20 active:scale-95"
          >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New playlist
          </button>
        </div>

        {showForm && (
          <form onSubmit={(e) => void handleCreate(e)} className="mb-6 flex items-center gap-3 animate-fade-up rounded-2xl border border-border bg-surface p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent-dim/20">
              <svg className="size-5 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Playlist name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-elevated px-4 py-2 text-sm text-text placeholder-faint outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-deep transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {creating ? (
                <span className="size-4 animate-spin rounded-full border-2 border-accent-deep/30 border-t-accent-deep" />
              ) : "Create"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setNewName(""); }} className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-muted transition-colors hover:text-text">
              Cancel
            </button>
          </form>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden />
            <span className="text-sm">Loading playlists…</span>
          </div>
        )}

        {!loading && playlists.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center animate-fade-up">
            <div className="flex size-20 items-center justify-center rounded-2xl border border-border bg-surface">
              <svg className="size-10 text-faint" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-text">No playlists yet</p>
              <p className="mt-1 text-sm text-muted">Create a playlist and start adding your favourite tracks</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-deep shadow-[0_0_20px_rgba(192,132,252,0.25)] transition-all hover:brightness-110 active:scale-95"
            >
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create first playlist
            </button>
          </div>
        )}

        {!loading && playlists.length > 0 && (
          <ul className="space-y-2 animate-fade-up">
            {playlists.map((pl, i) => (
              <li key={pl.id} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <Link
                  to={`/playlists/${pl.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-accent-dim/15">
                    <svg className="size-6 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text group-hover:text-accent transition-colors">{pl.name}</p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">
                      {pl.songCount ?? 0} tracks
                      {pl.duration != null && pl.duration > 0 ? ` · ${fmtDur(pl.duration)}` : ""}
                    </p>
                  </div>
                  <svg className="size-5 shrink-0 text-faint transition-colors group-hover:text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
