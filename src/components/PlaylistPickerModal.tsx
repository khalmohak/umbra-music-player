import { useEffect, useRef, useState } from "react";
import { usePlaylists } from "../context/PlaylistContext";

export default function PlaylistPickerModal() {
  const { pickerSong, closePicker, playlists, addSongs, createPlaylist } = usePlaylists();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const open = !!pickerSong;

  useEffect(() => {
    if (!open) {
      setNewName("");
      setShowNew(false);
      setAdded({});
      setAdding(null);
    }
  }, [open]);

  useEffect(() => {
    if (showNew) newInputRef.current?.focus();
  }, [showNew]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePicker]);

  if (!open || !pickerSong) return null;

  const handleAdd = async (playlistId: string) => {
    if (adding || added[playlistId]) return;
    setAdding(playlistId);
    try {
      await addSongs(playlistId, [pickerSong.id]);
      setAdded((prev) => ({ ...prev, [playlistId]: true }));
      setTimeout(() => closePicker(), 800);
    } finally {
      setAdding(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      await createPlaylist(name, [pickerSong.id]);
      setTimeout(() => closePicker(), 400);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add to playlist"
    >
      <div
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
        onClick={closePicker}
        aria-hidden
      />

      <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-accent">Add to playlist</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-text">{pickerSong.title}</p>
          </div>
          <button
            type="button"
            onClick={closePicker}
            className="ml-4 flex shrink-0 size-7 items-center justify-center rounded-full text-faint transition-colors hover:bg-elevated hover:text-text"
            aria-label="Close"
          >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No playlists yet.</p>
          ) : (
            <ul>
              {playlists.map((pl) => {
                const isAdded = added[pl.id];
                const isAdding = adding === pl.id;
                return (
                  <li key={pl.id}>
                    <button
                      type="button"
                      onClick={() => void handleAdd(pl.id)}
                      disabled={isAdding || !!adding}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-elevated/60 disabled:pointer-events-none ${isAdded ? "text-accent" : "text-text"}`}
                    >
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isAdded ? "bg-accent/15" : "bg-elevated"}`}>
                        {isAdded ? (
                          <svg className="size-4 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : isAdding ? (
                          <span className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
                        ) : (
                          <svg className="size-4 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{pl.name}</p>
                        <p className="text-[0.65rem] text-muted">{pl.songCount ?? 0} songs</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-3">
          {showNew ? (
            <form onSubmit={(e) => void handleCreate(e)} className="flex items-center gap-2">
              <input
                ref={newInputRef}
                type="text"
                placeholder="Playlist name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text placeholder-faint outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-deep transition-all hover:brightness-110 disabled:opacity-50"
                aria-label="Create"
              >
                {creating ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-accent-deep/30 border-t-accent-deep" />
                ) : (
                  <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowNew(false); setNewName(""); }}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-elevated hover:text-text"
                aria-label="Cancel"
              >
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted transition-colors hover:bg-elevated/60 hover:text-text"
            >
              <svg className="size-4 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New playlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
