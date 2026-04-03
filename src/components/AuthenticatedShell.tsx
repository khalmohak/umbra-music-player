import { NavLink, Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { PlayerProvider, usePlayer } from "../context/PlayerContext";
import { PlaylistProvider } from "../context/PlaylistContext";
import { StarProvider, useStarred } from "../context/StarContext";
import { useThemeColor } from "../hooks/useThemeColor";
import GlobalPlayerBar from "./GlobalPlayerBar";
import PlaylistPickerModal from "./PlaylistPickerModal";

function ThemeColorSync() {
  useThemeColor();
  return null;
}

function NowPlayingDot() {
  const { current, isPlaying } = usePlayer();
  if (!current) return null;
  return (
    <span className="relative ml-1.5 inline-flex size-1.5 shrink-0">
      <span className={`absolute inline-flex size-full rounded-full bg-accent ${isPlaying ? "animate-ping opacity-75" : "opacity-40"}`} />
      <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
    </span>
  );
}

function NavItem({ to, end, icon, label }: { to: string; end?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-accent/12 text-accent"
            : "text-muted hover:bg-elevated hover:text-text-secondary"
        }`
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

const SHORTCUT_GROUPS = [
  {
    label: "Playback",
    items: [
      { keys: ["Space"], desc: "Play / Pause" },
      { keys: ["→"], desc: "Next track" },
      { keys: ["←"], desc: "Previous track" },
      { keys: ["↑"], desc: "Volume +5%" },
      { keys: ["↓"], desc: "Volume −5%" },
      { keys: ["m"], desc: "Mute toggle" },
      { keys: ["]"], desc: "Seek +10 s" },
      { keys: ["["], desc: "Seek −10 s" },
      { keys: ["s"], desc: "Shuffle" },
      { keys: ["r"], desc: "Repeat" },
      { keys: ["f"], desc: "Star / Unstar" },
    ],
  },
  {
    label: "Navigate",
    items: [
      { keys: ["/", "⌘T"], desc: "Search" },
      { keys: ["g", "h"], desc: "Home" },
      { keys: ["g", "a"], desc: "Albums" },
      { keys: ["g", "r"], desc: "Artists" },
      { keys: ["g", "p"], desc: "Playlists" },
      { keys: ["g", "s"], desc: "Stats" },
      { keys: ["g", "g"], desc: "Genres" },
    ],
  },
  {
    label: "UI",
    items: [{ keys: ["?"], desc: "This help" }],
  },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Keyboard shortcuts"
    >
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-md" aria-hidden />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="font-display text-sm font-semibold text-text">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint hover:bg-elevated hover:text-text transition-colors"
            aria-label="Close"
          >
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.label} className={group.label === "Playback" ? "col-span-2 sm:col-span-1" : ""}>
                <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-widest text-faint">{group.label}</p>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.desc} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted">{item.desc}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="inline-flex min-w-[1.6rem] items-center justify-center rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[0.6rem] font-medium text-text shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border/60 px-5 py-3 text-center">
          <p className="text-[0.6rem] text-faint">Press <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[0.6rem] text-text">?</kbd> or <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[0.6rem] text-text">Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}

function KeyboardHandler() {
  const navigate = useNavigate();
  const { current, isPlaying, togglePlayPause, playNext, playPrevious, seek, currentTime, volume, setVolume, toggleMute, toggleShuffle, cycleRepeat, queue } = usePlayer();
  const { starredSongIds, toggleSongStar } = useStarred();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const open = () => setShowHelp(true);
    window.addEventListener("umbra:shortcuts", open);
    return () => window.removeEventListener("umbra:shortcuts", open);
  }, []);
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        e.preventDefault();
        navigate("/search");
        return;
      }

      if (inInput) return;

      if (gPressedRef.current) {
        gPressedRef.current = false;
        if (gTimerRef.current) { clearTimeout(gTimerRef.current); gTimerRef.current = null; }
        e.preventDefault();
        switch (e.key) {
          case "h": navigate("/"); break;
          case "a": navigate("/albums"); break;
          case "r": navigate("/artists"); break;
          case "p": navigate("/playlists"); break;
          case "s": navigate("/stats"); break;
          case "g": navigate("/genres"); break;
        }
        return;
      }

      switch (e.key) {
        case " ":
          if (queue.length === 0) return;
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          playNext();
          break;
        case "ArrowLeft":
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          playPrevious();
          break;
        case "ArrowUp":
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          setVolume(Math.round((volume + 0.05) * 20) / 20);
          break;
        case "ArrowDown":
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          setVolume(Math.round((volume - 0.05) * 20) / 20);
          break;
        case "m":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          toggleMute();
          break;
        case "]":
          if (current) { e.preventDefault(); seek(currentTime + 10); }
          break;
        case "[":
          if (current) { e.preventDefault(); seek(Math.max(0, currentTime - 10)); }
          break;
        case "s":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          toggleShuffle();
          break;
        case "r":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          cycleRepeat();
          break;
        case "f":
          if (e.metaKey || e.ctrlKey) return;
          if (current) { e.preventDefault(); toggleSongStar(current.id); }
          break;
        case "/":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          navigate("/search");
          break;
        case "?":
          e.preventDefault();
          setShowHelp((v) => !v);
          break;
        case "g":
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          gPressedRef.current = true;
          gTimerRef.current = window.setTimeout(() => {
            gPressedRef.current = false;
            gTimerRef.current = null;
          }, 1000);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [navigate, current, isPlaying, currentTime, togglePlayPause, playNext, playPrevious, seek, volume, setVolume, toggleMute, toggleShuffle, cycleRepeat, toggleSongStar, queue, starredSongIds]);

  return showHelp ? <ShortcutsModal onClose={() => setShowHelp(false)} /> : null;
}

export default function AuthenticatedShell() {
  const { creds, logout } = useAuth();
  if (!creds) return <Navigate to="/login" replace />;

  return (
    <PlayerProvider>
      <StarProvider>
        <PlaylistProvider>
          <div className="min-h-screen pb-28">
            <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/95 backdrop-blur-xl">
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">

                <span className="flex shrink-0 items-center gap-2 font-display text-base font-semibold tracking-tight text-text">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15">
                    <svg className="size-3.5 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </span>
                  Umbra
                  <NowPlayingDot />
                </span>

                <nav className="flex flex-1 items-center justify-end gap-0.5 sm:justify-start sm:pl-4">
                  <NavItem to="/" end label="Home" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  } />
                  <NavItem to="/albums" label="Albums" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-5a3 3 0 110-6 3 3 0 010 6zm0-1.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clipRule="evenodd" />
                    </svg>
                  } />
                  <NavItem to="/artists" label="Artists" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm-2 6a5 5 0 0010 0v-1a1 1 0 10-2 0v1a3 3 0 11-6 0v-1a1 1 0 00-2 0v1zm7 6H8a1 1 0 000 2h4a1 1 0 000-2z" />
                    </svg>
                  } />
                  <NavItem to="/playlists" label="Playlists" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h6a1 1 0 100-2H3zm8 0a1 1 0 000 2h3a1 1 0 100-2h-3z" />
                    </svg>
                  } />
                  <NavItem to="/genres" label="Genres" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  } />
                  <NavItem to="/stats" label="Stats" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  } />
                  <NavItem to="/history" label="History" icon={
                    <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  } />
                </nav>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to="/search"
                    className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-text"
                    aria-label="Search"
                    title="Search  /  ⌘T"
                  >
                    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </Link>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("umbra:shortcuts"))}
                    className="flex size-8 items-center justify-center rounded-lg font-mono text-xs text-faint transition-colors hover:bg-elevated hover:text-text"
                    aria-label="Keyboard shortcuts"
                    title="Keyboard shortcuts  ?"
                  >
                    ?
                  </button>
                  <span className="hidden max-w-[100px] truncate font-mono text-xs text-faint sm:block">
                    {creds.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-border-strong hover:text-text active:scale-95"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </header>

            <ThemeColorSync />
            <KeyboardHandler />
            <Outlet />
            <GlobalPlayerBar />
            <PlaylistPickerModal />
          </div>
        </PlaylistProvider>
      </StarProvider>
    </PlayerProvider>
  );
}
