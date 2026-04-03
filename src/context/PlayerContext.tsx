import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { coverArtUrl, streamUrl } from "../subsonic";
import { addScrobble, updateScrobble } from "../db/scrobbles";

export type PlayerTrack = {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  albumTitle?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  bitRate?: number;
  suffix?: string;
  transcodedSuffix?: string;
  samplingRate?: number;
  bitDepth?: number;
  trackGain?: number;
  albumGain?: number;
  trackPeak?: number;
  albumPeak?: number;
};

export type RepeatMode = "off" | "one" | "all";
export type ReplayGainMode = "track" | "album" | "off";

export const EQ_BANDS = [
  { label: "60",   fullLabel: "60 Hz",   frequency: 60,    type: "lowshelf"  as BiquadFilterType },
  { label: "230",  fullLabel: "230 Hz",  frequency: 230,   type: "peaking"   as BiquadFilterType },
  { label: "910",  fullLabel: "910 Hz",  frequency: 910,   type: "peaking"   as BiquadFilterType },
  { label: "3.6k", fullLabel: "3.6 kHz", frequency: 3600,  type: "peaking"   as BiquadFilterType },
  { label: "14k",  fullLabel: "14 kHz",  frequency: 14000, type: "highshelf" as BiquadFilterType },
] as const;

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:         [  0,  0,  0,  0,  0 ],
  Rock:         [  5,  3, -1,  3,  4 ],
  "Bass Boost": [  8,  5,  0, -1,  2 ],
  Vocal:        [ -2,  1,  5,  5,  3 ],
  Electronic:   [  6,  4,  0, -2,  4 ],
  Classical:    [  5,  0, -2,  2,  4 ],
  Jazz:         [  4,  3, -2,  2,  3 ],
  "Metal":      [  6,  4,  2,  4,  5 ],
};

type PlayerContextValue = {
  queue: PlayerTrack[];
  currentIndex: number;
  current: PlayerTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  gapless: boolean;
  replayGainMode: ReplayGainMode;
  directMode: boolean;
  contextSampleRate: number | null;
  playTrack: (track: PlayerTrack) => void;
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (seconds: number) => void;
  clear: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleGapless: () => void;
  setReplayGainMode: (mode: ReplayGainMode) => void;
  toggleDirectMode: () => void;
  addToQueue: (track: PlayerTrack) => void;
  addNext: (track: PlayerTrack) => void;
  removeFromQueue: (queueIndex: number) => void;
  jumpTo: (queueIndex: number) => void;
  analyserNode: AnalyserNode | null;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  setEqBandGain: (band: number, gain: number) => void;
  applyEqPreset: (preset: string) => void;
  toggleEq: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeRGLinearGain(track: PlayerTrack, mode: ReplayGainMode): number {
  if (mode === "off") return 1;
  const gainDb = mode === "album"
    ? (track.albumGain ?? track.trackGain ?? 0)
    : (track.trackGain ?? track.albumGain ?? 0);
  const peak = mode === "album"
    ? (track.albumPeak ?? track.trackPeak ?? 1)
    : (track.trackPeak ?? track.albumPeak ?? 1);
  const gain = Math.pow(10, gainDb / 20);
  return peak > 0 && gain * peak > 1 ? 1 / peak : gain;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { creds } = useAuth();

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const altAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeIndexRef = useRef<0 | 1>(0);

  const queueRef    = useRef<PlayerTrack[]>([]);
  const indexRef    = useRef(0);
  const shuffleRef  = useRef(false);
  const repeatRef   = useRef<RepeatMode>("off");
  const gaplessRef  = useRef(true);
  const rgModeRef   = useRef<ReplayGainMode>("track");

  const audioCtxRef       = useRef<AudioContext | null>(null);
  const eqFiltersRef      = useRef<BiquadFilterNode[]>([]);
  const eqGainsRef        = useRef<number[]>([0, 0, 0, 0, 0]);
  const eqEnabledRef      = useRef(true);
  const primaryRGGainRef  = useRef<GainNode | null>(null);
  const altRGGainRef      = useRef<GainNode | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);

  const preloadedTrackIdRef    = useRef<string | null>(null);
  const gaplessTriggerRef      = useRef<number | null>(null);
  const gaplessTransitionRef   = useRef(false);
  const scrobbleIdRef          = useRef<number | null>(null);

  const [queue, setQueue]         = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]   = useState(0);
  const [volume, setVolumeState]  = useState(1);
  const [muted, setMuted]         = useState(false);
  const [shuffle, setShuffle]     = useState(false);
  const [repeat, setRepeat]       = useState<RepeatMode>("off");
  const [gapless, setGapless]     = useState(true);
  const [replayGainMode, setReplayGainModeState] = useState<ReplayGainMode>("track");
  const [directMode, setDirectMode] = useState(false);
  const [contextSampleRate, setContextSampleRate] = useState<number | null>(null);
  const directModeRef = useRef(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqGains, setEqGains]     = useState<number[]>([0, 0, 0, 0, 0]);
  const [eqPreset, setEqPreset]   = useState("Flat");

  queueRef.current   = queue;
  indexRef.current   = currentIndex;
  shuffleRef.current = shuffle;
  repeatRef.current  = repeat;
  gaplessRef.current = gapless;
  rgModeRef.current  = replayGainMode;
  eqGainsRef.current = eqGains;
  eqEnabledRef.current = eqEnabled;

  const current = queue.length > 0 && currentIndex >= 0 && currentIndex < queue.length
    ? queue[currentIndex]
    : null;

  const getActiveAudio  = () => activeIndexRef.current === 0 ? audioRef.current : altAudioRef.current;
  const getStandbyAudio = () => activeIndexRef.current === 0 ? altAudioRef.current : audioRef.current;
  const getActiveRGGain = () => activeIndexRef.current === 0 ? primaryRGGainRef.current : altRGGainRef.current;
  const getStandbyRGGain= () => activeIndexRef.current === 0 ? altRGGainRef.current : primaryRGGainRef.current;

  const applyRGToGainNode = (node: GainNode | null, track: PlayerTrack | null) => {
    if (!node || !track) return;
    node.gain.value = computeRGLinearGain(track, rgModeRef.current);
  };

  const setupAudioContext = () => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
      return;
    }
    const primary = audioRef.current;
    const alt     = altAudioRef.current;
    if (!primary || !alt) return;
    try {
      const ctx = new AudioContext({ latencyHint: "playback" });
      audioCtxRef.current = ctx;
      setContextSampleRate(ctx.sampleRate);

      const primarySrc = ctx.createMediaElementSource(primary);
      const altSrc     = ctx.createMediaElementSource(alt);

      const primaryRG = ctx.createGain();
      const altRG     = ctx.createGain();
      primaryRGGainRef.current = primaryRG;
      altRGGainRef.current     = altRG;
      primaryRG.gain.value = 1;
      altRG.gain.value     = 1;

      const filters = EQ_BANDS.map(({ type, frequency }, i) => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = frequency;
        f.Q.value = 1.2;
        f.gain.value = eqEnabledRef.current ? (eqGainsRef.current[i] ?? 0) : 0;
        return f;
      });
      eqFiltersRef.current = filters;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      analyserRef.current = analyser;

      primarySrc.connect(primaryRG);
      altSrc.connect(altRG);
      let node: AudioNode = filters[0];
      primaryRG.connect(node);
      altRG.connect(node);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
        node = filters[i + 1];
      }
      node.connect(analyser);
      analyser.connect(ctx.destination);

      setAnalyserNode(analyser);
    } catch { /* Web Audio not supported */ }
  };

  const preloadNextTrack = useCallback(() => {
    if (!gaplessRef.current || !creds) return;
    const i = indexRef.current;
    const q = queueRef.current;
    const next = q[i + 1];
    if (!next || next.id === preloadedTrackIdRef.current) return;
    const standby = getStandbyAudio();
    if (!standby) return;
    preloadedTrackIdRef.current = next.id;
    standby.src = streamUrl(creds.username, creds.password, next.id);
    standby.preload = "auto";
    standby.load();
    const standbyRG = getStandbyRGGain();
    applyRGToGainNode(standbyRG, next);
  }, [creds]);

  const finalizeScrobble = useCallback((naturalEnd: boolean) => {
    const id = scrobbleIdRef.current;
    if (id === null) return;
    scrobbleIdRef.current = null;
    const active = getActiveAudio();
    const pos = active ? Math.floor(active.currentTime * 1000) : 0;
    const dur = active && Number.isFinite(active.duration) ? Math.floor(active.duration * 1000) : undefined;
    const skipped = !naturalEnd && dur != null ? pos < dur * 0.5 : false;
    updateScrobble(id, {
      endedAt: Date.now(),
      positionMs: pos,
      trackDurationMs: dur,
      skipped,
      naturalEnd,
    }).catch(() => {});
  }, []);

  const startScrobble = useCallback((track: PlayerTrack) => {
    addScrobble({
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.albumTitle,
      albumId: track.albumId,
      coverArt: track.coverArt,
      startedAt: Date.now(),
      positionMs: 0,
      trackDurationMs: track.duration ? Math.floor(track.duration * 1000) : undefined,
      skipped: false,
      naturalEnd: false,
    }).then((id) => { scrobbleIdRef.current = id; }).catch(() => {});
  }, []);

  const triggerGaplessTransition = useCallback(() => {
    const standby = getStandbyAudio();
    if (!standby || !preloadedTrackIdRef.current) return;
    const i = indexRef.current;
    const q = queueRef.current;
    if (i + 1 >= q.length) return;
    const nextTrack = q[i + 1];
    if (!nextTrack || nextTrack.id !== preloadedTrackIdRef.current) return;

    gaplessTransitionRef.current = true;

    applyRGToGainNode(getStandbyRGGain(), nextTrack);

    standby.currentTime = 0;
    standby.play().catch(() => { gaplessTransitionRef.current = false; });

    activeIndexRef.current = activeIndexRef.current === 0 ? 1 : 0;

    finalizeScrobble(true);

    setCurrentIndex(i + 1);
    setCurrentTime(0);
    setDuration(nextTrack.duration ?? 0);
    setIsPlaying(true);
    setIsBuffering(false);

    const oldActive = getStandbyAudio();
    setTimeout(() => { oldActive?.pause(); }, 60);

    preloadedTrackIdRef.current = null;

    setTimeout(() => { preloadNextTrack(); }, 300);
  }, [finalizeScrobble, preloadNextTrack]);

  useEffect(() => {
    const makeHandlers = (isAlt: boolean) => {
      const isActive = () => (isAlt ? activeIndexRef.current === 1 : activeIndexRef.current === 0);
      const getEl = () => (isAlt ? altAudioRef.current : audioRef.current);

      const onTime = () => {
        if (!isActive()) return;
        const a = getEl();
        if (!a) return;
        setCurrentTime(a.currentTime);
        if (!gaplessRef.current || !Number.isFinite(a.duration) || a.duration === 0) return;
        const rem = a.duration - a.currentTime;
        if (rem < 20) preloadNextTrack();
        if (rem < 1.2 && rem > 0 && gaplessTriggerRef.current === null) {
          const delay = Math.max(0, (rem - 0.06) * 1000);
          gaplessTriggerRef.current = window.setTimeout(() => {
            gaplessTriggerRef.current = null;
            triggerGaplessTransition();
          }, delay);
        }
      };

      const onMeta = () => {
        if (!isActive()) return;
        const a = getEl();
        if (a && Number.isFinite(a.duration)) setDuration(a.duration);
      };

      const onPlay = () => {
        if (!isActive()) return;
        setupAudioContext();
        setIsPlaying(true);
        setIsBuffering(false);
      };

      const onPause = () => {
        if (!isActive()) return;
        setIsPlaying(false);
      };

      const onLoadStart = () => { if (isActive()) setIsBuffering(true); };
      const onWaiting   = () => { if (isActive()) setIsBuffering(true); };
      const onStalled   = () => { if (isActive()) setIsBuffering(true); };
      const onSeeking   = () => { if (isActive()) setIsBuffering(true); };
      const onSeeked    = () => { if (isActive()) setIsBuffering(false); };
      const onPlaying   = () => { if (isActive()) setIsBuffering(false); };

      const onEnded = () => {
        if (!isActive()) return;
        const i = indexRef.current;
        const q = queueRef.current;
        const rep = repeatRef.current;
        const a = getEl();
        if (rep === "one") {
          if (a) { a.currentTime = 0; void a.play().catch(() => {}); }
        } else if (i + 1 < q.length) {
          finalizeScrobble(true);
          setCurrentIndex(i + 1);
        } else if (rep === "all" && q.length > 0) {
          finalizeScrobble(true);
          setCurrentIndex(0);
        } else {
          finalizeScrobble(true);
          setIsPlaying(false);
        }
        setIsBuffering(false);
      };

      return { onTime, onMeta, onPlay, onPause, onLoadStart, onWaiting, onStalled, onSeeking, onSeeked, onPlaying, onEnded };
    };

    const primaryHandlers = makeHandlers(false);
    const altHandlers     = makeHandlers(true);

    const primary = audioRef.current;
    const alt     = altAudioRef.current;
    if (!primary || !alt) return;

    const attach = (el: HTMLAudioElement, h: ReturnType<typeof makeHandlers>) => {
      el.addEventListener("timeupdate",    h.onTime);
      el.addEventListener("loadedmetadata",h.onMeta);
      el.addEventListener("durationchange",h.onMeta);
      el.addEventListener("play",          h.onPlay);
      el.addEventListener("pause",         h.onPause);
      el.addEventListener("loadstart",     h.onLoadStart);
      el.addEventListener("waiting",       h.onWaiting);
      el.addEventListener("stalled",       h.onStalled);
      el.addEventListener("seeking",       h.onSeeking);
      el.addEventListener("seeked",        h.onSeeked);
      el.addEventListener("playing",       h.onPlaying);
      el.addEventListener("ended",         h.onEnded);
    };

    const detach = (el: HTMLAudioElement, h: ReturnType<typeof makeHandlers>) => {
      el.removeEventListener("timeupdate",    h.onTime);
      el.removeEventListener("loadedmetadata",h.onMeta);
      el.removeEventListener("durationchange",h.onMeta);
      el.removeEventListener("play",          h.onPlay);
      el.removeEventListener("pause",         h.onPause);
      el.removeEventListener("loadstart",     h.onLoadStart);
      el.removeEventListener("waiting",       h.onWaiting);
      el.removeEventListener("stalled",       h.onStalled);
      el.removeEventListener("seeking",       h.onSeeking);
      el.removeEventListener("seeked",        h.onSeeked);
      el.removeEventListener("playing",       h.onPlaying);
      el.removeEventListener("ended",         h.onEnded);
    };

    attach(primary, primaryHandlers);
    attach(alt, altHandlers);
    return () => {
      detach(primary, primaryHandlers);
      detach(alt, altHandlers);
    };
  }, [preloadNextTrack, triggerGaplessTransition, finalizeScrobble]);

  useEffect(() => {
    const wasGapless = gaplessTransitionRef.current;
    if (wasGapless) {
      gaplessTransitionRef.current = false;
      if (current) startScrobble(current);
      return;
    }

    if (gaplessTriggerRef.current !== null) {
      clearTimeout(gaplessTriggerRef.current);
      gaplessTriggerRef.current = null;
    }
    preloadedTrackIdRef.current = null;

    const standby = getStandbyAudio();
    if (standby) { standby.pause(); standby.removeAttribute("src"); standby.load(); }

    const a = getActiveAudio();
    if (!a) return;

    if (!creds || !current) {
      finalizeScrobble(false);
      a.pause();
      a.removeAttribute("src");
      a.load();
      setCurrentTime(0);
      setDuration(0);
      setIsBuffering(false);
      return;
    }

    finalizeScrobble(false);

    setIsBuffering(true);
    a.src = streamUrl(creds.username, creds.password, current.id);
    a.load();
    void a.play().catch(() => { setIsPlaying(false); setIsBuffering(false); });

    applyRGToGainNode(getActiveRGGain(), current);

    startScrobble(current);
  }, [creds, current?.id]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !creds) return;
    if (!current) { navigator.mediaSession.metadata = null; return; }
    const artSrc = current.coverArt
      ? window.location.origin + coverArtUrl(creds.username, creds.password, current.coverArt, 512)
      : "";
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? "",
      album: current.albumTitle ?? "",
      artwork: artSrc ? [{ src: artSrc, sizes: "512x512", type: "image/jpeg" }] : [],
    });
  }, [creds, current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const togglePlayPause = useCallback(() => {
    const a = getActiveAudio();
    if (!a || !queueRef.current.length) return;
    if (a.paused) void a.play().catch(() => setIsPlaying(false));
    else a.pause();
  }, []);

  const playNext = useCallback(() => {
    const i = indexRef.current;
    const q = queueRef.current;
    const rep = repeatRef.current;
    if (gaplessTriggerRef.current !== null) { clearTimeout(gaplessTriggerRef.current); gaplessTriggerRef.current = null; }
    if (i + 1 < q.length) { setCurrentIndex(i + 1); setIsPlaying(true); }
    else if (rep === "all" && q.length > 0) { setCurrentIndex(0); setIsPlaying(true); }
  }, []);

  const playPrevious = useCallback(() => {
    const a = getActiveAudio();
    const i = indexRef.current;
    const q = queueRef.current;
    if (!a || q.length === 0) return;
    if (gaplessTriggerRef.current !== null) { clearTimeout(gaplessTriggerRef.current); gaplessTriggerRef.current = null; }
    if (a.currentTime > 3) { a.currentTime = 0; return; }
    if (i > 0) { setCurrentIndex(i - 1); setIsPlaying(true); }
    else a.currentTime = 0;
  }, []);

  const seek = useCallback((seconds: number) => {
    const a = getActiveAudio();
    if (!a || !Number.isFinite(seconds)) return;
    a.currentTime = Math.max(0, Math.min(seconds, a.duration || seconds));
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play",          () => togglePlayPause());
    navigator.mediaSession.setActionHandler("pause",         () => togglePlayPause());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
    navigator.mediaSession.setActionHandler("nexttrack",     () => playNext());
    navigator.mediaSession.setActionHandler("seekto",        (d) => { if (d.seekTime != null) seek(d.seekTime); });
  }, [togglePlayPause, playPrevious, playNext, seek]);

  const playTrack = useCallback((track: PlayerTrack) => {
    setQueue([track]);
    setCurrentIndex(0);
    setIsPlaying(true);
  }, []);

  const playQueue = useCallback((tracks: PlayerTrack[], startIndex = 0) => {
    if (tracks.length === 0) return;
    const selected = tracks[Math.min(Math.max(0, startIndex), tracks.length - 1)];
    if (shuffleRef.current) {
      const rest = shuffleArray(tracks.filter((_, idx) => idx !== startIndex));
      setQueue([selected, ...rest]);
      setCurrentIndex(0);
    } else {
      setQueue(tracks);
      setCurrentIndex(Math.min(Math.max(0, startIndex), tracks.length - 1));
    }
    setIsPlaying(true);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const next = !s;
      if (next) {
        const i = indexRef.current;
        const q = queueRef.current;
        if (q.length > 1) {
          const cur = q[i];
          const rest = shuffleArray(q.filter((_, idx) => idx !== i));
          setQueue([cur, ...rest]);
          setCurrentIndex(0);
        }
      }
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    const a = getActiveAudio();
    if (a) a.volume = clamped;
    if (clamped > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      const a = getActiveAudio();
      if (a) a.muted = next;
      return next;
    });
  }, []);

  const toggleGapless = useCallback(() => {
    setGapless((g) => !g);
  }, []);

  const setReplayGainMode = useCallback((mode: ReplayGainMode) => {
    setReplayGainModeState(mode);
    const currentTrack = queueRef.current[indexRef.current];
    if (currentTrack) {
      const ctx = audioCtxRef.current;
      if (ctx) {
        const gain = computeRGLinearGain(currentTrack, mode);
        const activeRG = getActiveRGGain();
        if (activeRG) activeRG.gain.value = gain;
      }
    }
  }, []);

  const toggleDirectMode = useCallback(() => {
    setDirectMode((prev) => {
      const next = !prev;
      directModeRef.current = next;
      if (next) {
        setVolumeState(1);
        setMuted(false);
        const a = getActiveAudio();
        if (a) { a.volume = 1; a.muted = false; }
        setEqGains([0, 0, 0, 0, 0]);
        setEqPreset("Flat");
        eqFiltersRef.current.forEach((f) => { f.gain.value = 0; });
        setEqEnabled(true);
        setReplayGainModeState("off");
        const activeRG = getActiveRGGain();
        if (activeRG) activeRG.gain.value = 1;
        const standbyRG = getStandbyRGGain();
        if (standbyRG) standbyRG.gain.value = 1;
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    if (gaplessTriggerRef.current !== null) { clearTimeout(gaplessTriggerRef.current); gaplessTriggerRef.current = null; }
    finalizeScrobble(false);
    const a = getActiveAudio();
    if (a) { a.pause(); a.removeAttribute("src"); a.load(); }
    const s = getStandbyAudio();
    if (s) { s.pause(); s.removeAttribute("src"); s.load(); }
    preloadedTrackIdRef.current = null;
    setQueue([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
  }, [finalizeScrobble]);

  const addToQueue = useCallback((track: PlayerTrack) => { setQueue((q) => [...q, track]); }, []);

  const addNext = useCallback((track: PlayerTrack) => {
    const i = indexRef.current;
    setQueue((q) => { const next = [...q]; next.splice(i + 1, 0, track); return next; });
  }, []);

  const removeFromQueue = useCallback((queueIndex: number) => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (queueIndex < 0 || queueIndex >= q.length) return;
    const next = q.filter((_, idx) => idx !== queueIndex);
    let nextIndex = i;
    if (queueIndex < i) nextIndex = Math.max(0, i - 1);
    else if (queueIndex === i && i >= next.length) nextIndex = Math.max(0, next.length - 1);
    setQueue(next);
    setCurrentIndex(nextIndex);
  }, []);

  const jumpTo = useCallback((queueIndex: number) => {
    if (gaplessTriggerRef.current !== null) { clearTimeout(gaplessTriggerRef.current); gaplessTriggerRef.current = null; }
    setCurrentIndex(queueIndex);
    setIsPlaying(true);
  }, []);

  const setEqBandGain = useCallback((band: number, gain: number) => {
    setEqGains((prev) => { const next = [...prev]; next[band] = gain; return next; });
    const filter = eqFiltersRef.current[band];
    if (filter && eqEnabledRef.current) filter.gain.value = gain;
    setEqPreset("Custom");
  }, []);

  const applyEqPreset = useCallback((preset: string) => {
    const gains = EQ_PRESETS[preset];
    if (!gains) return;
    setEqGains([...gains]);
    setEqPreset(preset);
    if (eqEnabledRef.current) {
      gains.forEach((g, i) => { const f = eqFiltersRef.current[i]; if (f) f.gain.value = g; });
    }
  }, []);

  const toggleEq = useCallback(() => {
    setEqEnabled((prev) => {
      const next = !prev;
      eqFiltersRef.current.forEach((f, i) => { f.gain.value = next ? (eqGainsRef.current[i] ?? 0) : 0; });
      return next;
    });
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue, currentIndex, current, isPlaying, isBuffering, currentTime, duration,
      volume, muted, shuffle, repeat, gapless, replayGainMode, directMode, contextSampleRate,
      playTrack, playQueue, togglePlayPause, playNext, playPrevious, seek, clear,
      toggleShuffle, cycleRepeat, setVolume, toggleMute, toggleGapless, setReplayGainMode, toggleDirectMode,
      addToQueue, addNext, removeFromQueue, jumpTo,
      analyserNode, eqEnabled, eqGains, eqPreset,
      setEqBandGain, applyEqPreset, toggleEq,
    }),
    [queue, currentIndex, current, isPlaying, isBuffering, currentTime, duration,
     volume, muted, shuffle, repeat, gapless, replayGainMode, directMode, contextSampleRate,
     playTrack, playQueue, togglePlayPause, playNext, playPrevious, seek, clear,
     toggleShuffle, cycleRepeat, setVolume, toggleMute, toggleGapless, setReplayGainMode, toggleDirectMode,
     addToQueue, addNext, removeFromQueue, jumpTo,
     analyserNode, eqEnabled, eqGains, eqPreset,
     setEqBandGain, applyEqPreset, toggleEq]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef}    preload="auto" className="hidden" />
      <audio ref={altAudioRef} preload="none" className="hidden" />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer requires PlayerProvider");
  return ctx;
}
