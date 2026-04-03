import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayer, type RepeatMode, type ReplayGainMode, EQ_BANDS, EQ_PRESETS } from "../context/PlayerContext";
import { useStarred } from "../context/StarContext";
import { usePlaylists } from "../context/PlaylistContext";
import { coverArtUrl } from "../subsonic";

function fmtTime(sec: number | undefined) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-accent/20 border-t-accent ${className ?? "size-5"}`}
      aria-hidden
    />
  );
}

function EqBars({ playing }: { playing: boolean }) {
  return (
    <span className="flex items-end gap-px">
      {([0, 150, 75] as const).map((delay) => (
        <span
          key={delay}
          className="inline-block w-[3px] origin-bottom rounded-full bg-accent"
          style={{
            height: "13px",
            animation: playing ? `eq-bar 0.85s ease-in-out ${delay}ms infinite` : "none",
            transform: playing ? undefined : "scaleY(0.3)",
          }}
        />
      ))}
    </span>
  );
}

function SeekBar({
  currentTime,
  dur,
  onSeek,
  size = "md",
}: {
  currentTime: number;
  dur: number;
  onSeek: (s: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const pct = dur > 0 ? Math.min(100, (currentTime / dur) * 100) : 0;
  const h = size === "lg" ? "h-1.5" : "h-1";
  const thumbSize = size === "lg" ? "size-4" : "size-3";

  return (
    <div
      className={`group relative ${h} cursor-pointer rounded-full bg-border/80`}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur);
      }}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={currentTime}
      aria-label="Seek"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 5));
        if (e.key === "ArrowRight") onSeek(Math.min(dur, currentTime + 5));
      }}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-dim transition-[width] duration-100"
        style={{ width: `${pct}%` }}
      />
      <div
        className={`absolute top-1/2 ${thumbSize} -translate-y-1/2 scale-0 rounded-full bg-accent shadow-[0_0_6px_rgba(192,132,252,0.7)] transition-transform group-hover:scale-100`}
        style={{ left: `calc(${pct}% - ${size === "lg" ? 8 : 6}px)` }}
      />
    </div>
  );
}

function QualityLine({
  suffix,
  bitRate,
  transcodedSuffix,
  samplingRate,
  bitDepth,
  compact = false,
}: {
  suffix?: string;
  bitRate?: number;
  transcodedSuffix?: string;
  samplingRate?: number;
  bitDepth?: number;
  compact?: boolean;
}) {
  const effectiveSuffix = transcodedSuffix ?? suffix ?? "";
  if (!effectiveSuffix) return null;
  const fmt = effectiveSuffix.toUpperCase();
  const originalFmt = transcodedSuffix && transcodedSuffix !== suffix ? (suffix ?? "").toUpperCase() : null;
  const losslessFormats = ["FLAC", "WAV", "AIFF", "ALAC", "APE", "WV"];
  const isLossless = losslessFormats.includes((suffix ?? "").toUpperCase()) && !transcodedSuffix;

  if (compact) {
    return (
      <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold leading-none tracking-wide ${
        isLossless ? "bg-lossless-bg text-lossless" : "bg-white/5 text-muted"
      }`}>
        {fmt}
      </span>
    );
  }

  const parts: string[] = [];
  if (samplingRate) parts.push(`${Math.round(samplingRate / 100) / 10} kHz`);
  if (bitDepth) parts.push(`${bitDepth}-bit`);
  if (bitRate) parts.push(`${bitRate} kbps`);

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      <span className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none tracking-wide ${
        isLossless ? "bg-lossless-bg text-lossless" : "bg-white/5 text-muted"
      }`}>
        {fmt}
      </span>
      {originalFmt && <span className="text-faint">← {originalFmt}</span>}
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="text-faint" aria-hidden>·</span>
          <span className="text-muted">{p}</span>
        </span>
      ))}
    </div>
  );
}

function Visualizer({ analyserNode }: { analyserNode: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const nodeRef = useRef(analyserNode);
  useEffect(() => { nodeRef.current = analyserNode; }, [analyserNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = 512;
    const H = 96;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "rgba(233,121,249,0.95)");
    gradient.addColorStop(0.45, "rgba(192,132,252,0.65)");
    gradient.addColorStop(1, "rgba(147,51,234,0.06)");

    const BAR_COUNT = 56;
    const GAP = 2;
    const barW = (W - GAP * (BAR_COUNT - 1)) / BAR_COUNT;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      ctx!.clearRect(0, 0, W, H);
      const an = nodeRef.current;
      if (!an) return;
      if (!dataArray || dataArray.length !== an.frequencyBinCount) {
        dataArray = new Uint8Array(new ArrayBuffer(an.frequencyBinCount));
      }
      an.getByteFrequencyData(dataArray);
      const step = Math.max(1, Math.floor(an.frequencyBinCount / BAR_COUNT));
      ctx!.fillStyle = gradient;
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = dataArray[i * step] ?? 0;
        const h = Math.max(2, (val / 255) * H * 0.94);
        const x = i * (barW + GAP);
        ctx!.beginPath();
        const r = Math.min(2, barW / 2);
        ctx!.moveTo(x + r, H - h);
        ctx!.lineTo(x + barW - r, H - h);
        ctx!.arcTo(x + barW, H - h, x + barW, H - h + r, r);
        ctx!.lineTo(x + barW, H);
        ctx!.lineTo(x, H);
        ctx!.lineTo(x, H - h + r);
        ctx!.arcTo(x, H - h, x + r, H - h, r);
        ctx!.closePath();
        ctx!.fill();
      }
    }

    draw();
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute bottom-0 left-0 w-full"
      style={{ height: "96px", mixBlendMode: "screen" }}
      aria-hidden
    />
  );
}

function EqPanel({
  eqGains,
  eqPreset,
  eqEnabled,
  onBandChange,
  onPreset,
  onToggle,
}: {
  eqGains: number[];
  eqPreset: string;
  eqEnabled: boolean;
  onBandChange: (band: number, gain: number) => void;
  onPreset: (preset: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="mt-5 w-full max-w-sm rounded-2xl border border-border/60 bg-surface/80 p-4 backdrop-blur-md animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-faint">Equalizer</p>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            eqEnabled ? "bg-accent/15 text-accent" : "bg-elevated text-muted hover:text-text"
          }`}
        >
          {eqEnabled ? "On" : "Off"}
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {Object.keys(EQ_PRESETS).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onPreset(preset)}
            disabled={!eqEnabled}
            className={`rounded-full px-2.5 py-1 text-[0.65rem] font-medium transition-all disabled:opacity-40 ${
              eqPreset === preset
                ? "bg-accent/20 text-accent"
                : "bg-elevated text-muted hover:text-text"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="flex items-end justify-between gap-1">
        {EQ_BANDS.map((band, i) => {
          const gain = eqGains[i] ?? 0;
          const pct = ((gain + 12) / 24) * 100;
          return (
            <div key={band.label} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={`font-mono text-[0.55rem] tabular-nums ${Math.abs(gain) > 0 ? "text-accent" : "text-faint"}`}>
                {gain > 0 ? `+${gain}` : gain}
              </span>
              <div className="relative flex h-20 w-5 items-center justify-center">
                <div className="absolute h-full w-[3px] rounded-full bg-border" />
                <div
                  className="absolute w-[3px] rounded-full bg-accent/60 transition-all"
                  style={{
                    height: `${Math.abs(gain) / 12 * 50}%`,
                    bottom: gain >= 0 ? "50%" : undefined,
                    top: gain < 0 ? "50%" : undefined,
                  }}
                />
                <div
                  className="absolute h-[2px] w-5 rounded-full bg-border-strong"
                  style={{ top: "50%" }}
                />
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={gain}
                  disabled={!eqEnabled}
                  onChange={(e) => onBandChange(i, Number(e.target.value))}
                  className="absolute opacity-0"
                  style={{
                    width: "80px",
                    height: "20px",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(-90deg)",
                    cursor: eqEnabled ? "pointer" : "default",
                  }}
                  aria-label={`${band.fullLabel} gain`}
                  aria-valuenow={gain}
                  aria-valuemin={-12}
                  aria-valuemax={12}
                />
                <div
                  className={`absolute size-3.5 rounded-full border-2 shadow transition-all ${eqEnabled ? "border-accent bg-bg cursor-pointer" : "border-border bg-elevated"}`}
                  style={{ top: `${100 - pct}%`, transform: "translate(-50%, -50%)", left: "50%" }}
                />
              </div>
              <span className="font-mono text-[0.55rem] text-faint">{band.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepeatIcon({ mode, className }: { mode: RepeatMode; className?: string }) {
  if (mode === "one") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  );
}

function TransportButtons({
  isPlaying,
  isBuffering,
  onPrev,
  onToggle,
  onNext,
  nextDisabled,
  shuffle,
  repeat,
  onShuffle,
  onRepeat,
  size = "md",
}: {
  isPlaying: boolean;
  isBuffering: boolean;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  onShuffle: () => void;
  onRepeat: () => void;
  size?: "md" | "lg";
}) {
  const playSize = size === "lg" ? "p-4" : "p-2.5";
  const playIcon = size === "lg" ? "size-7" : "size-5";
  const sideBtn = (active?: boolean) =>
    `flex items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
      size === "lg" ? "size-12" : "size-9"
    } ${active ? "text-accent" : "text-muted hover:bg-elevated hover:text-text-secondary"}`;
  const sideIcon = size === "lg" ? "size-6 shrink-0" : "size-5 shrink-0";
  const modIcon = size === "lg" ? "size-5 shrink-0" : "size-4 shrink-0";

  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={onShuffle} className={sideBtn(shuffle)} aria-label="Shuffle" title="Shuffle (S)">
        <svg className={modIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
        </svg>
      </button>

      <button type="button" onClick={onPrev} className={sideBtn()} aria-label="Previous">
        <svg className={sideIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`flex items-center justify-center rounded-full bg-accent text-accent-deep shadow-[0_0_20px_rgba(192,132,252,0.3)] transition-all duration-150 hover:brightness-110 active:scale-95 ${playSize}`}
      >
        {isBuffering ? (
          <Spinner className={size === "lg" ? "size-7 border-[3px] border-accent-deep/30 border-t-accent-deep" : "size-5 border-2 border-accent-deep/30 border-t-accent-deep"} />
        ) : isPlaying ? (
          <svg className={playIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className={playIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled && repeat !== "all"}
        className={`${sideBtn()} disabled:pointer-events-none disabled:opacity-30`}
        aria-label="Next"
      >
        <svg className={sideIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onRepeat}
        className={sideBtn(repeat !== "off")}
        aria-label={`Repeat ${repeat}`}
        title="Repeat (R)"
      >
        <RepeatIcon mode={repeat} className={modIcon} />
      </button>
    </div>
  );
}

type SignalNode = {
  label: string;
  detail: string;
  ok: boolean;
  warn?: string;
};

function SignalPathPanel({
  current,
  contextSampleRate,
  replayGainMode,
  eqEnabled,
  eqGains,
  volume,
  muted,
}: {
  current: { suffix?: string; bitDepth?: number; samplingRate?: number } | null;
  contextSampleRate: number | null;
  replayGainMode: string;
  eqEnabled: boolean;
  eqGains: number[];
  volume: number;
  muted: boolean;
}) {
  const fmt     = (current?.suffix ?? "").toUpperCase() || "?";
  const bits    = current?.bitDepth;
  const rate    = current?.samplingRate;
  const srcLabel = [fmt, bits ? `${bits}-bit` : null, rate ? `${rate >= 1000 ? `${rate / 1000}` : rate} kHz` : null]
    .filter(Boolean).join(" · ") || "Unknown";

  const hasSrc = rate != null && contextSampleRate != null;
  const srcMismatch = hasSrc && Math.abs(rate! - contextSampleRate!) > 100;

  const eqActive  = eqEnabled && eqGains.some((g) => g !== 0);
  const rgActive  = replayGainMode !== "off";
  const volOk     = !muted && volume >= 0.999;

  const nodes: SignalNode[] = [
    {
      label: "Source",
      detail: srcLabel,
      ok: true,
    },
    {
      label: "ReplayGain",
      detail: rgActive ? replayGainMode : "bypass",
      ok: !rgActive,
    },
    {
      label: "EQ",
      detail: eqActive ? "active" : "bypass",
      ok: !eqActive,
    },
    {
      label: "Volume",
      detail: muted ? "muted" : `${Math.round(volume * 100)}%`,
      ok: volOk,
      warn: !volOk ? "Software attenuation reduces bit depth — use DAC volume control" : undefined,
    },
    {
      label: "Context",
      detail: contextSampleRate ? `${contextSampleRate >= 1000 ? contextSampleRate / 1000 : contextSampleRate} kHz` : "—",
      ok: !srcMismatch,
      warn: srcMismatch
        ? `Source is ${rate! >= 1000 ? rate! / 1000 : rate} kHz but macOS is running at ${contextSampleRate! >= 1000 ? contextSampleRate! / 1000 : contextSampleRate} kHz — SRC active. Open Audio MIDI Setup and set output to ${rate! >= 1000 ? rate! / 1000 : rate} kHz.`
        : undefined,
    },
  ];

  const allClean = nodes.every((n) => n.ok);
  const warnings = nodes.filter((n) => n.warn);

  return (
    <div className="mt-4 w-full max-w-sm rounded-2xl border border-border/60 bg-surface/80 p-4 backdrop-blur-md animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-faint">Signal Path</p>
        {allClean ? (
          <span className="flex items-center gap-1 rounded-full bg-lossless-bg px-2 py-0.5 text-[0.6rem] font-semibold text-lossless">
            <span className="size-1.5 rounded-full bg-lossless" />
            Clean
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[0.6rem] font-semibold text-warning">
            <span className="size-1.5 rounded-full bg-warning" />
            Processing active
          </span>
        )}
      </div>

      <ol className="space-y-0">
        {nodes.map((node, i) => (
          <li key={node.label} className="flex items-stretch">
            <div className="flex w-5 flex-col items-center">
              <div className={`size-3 shrink-0 rounded-full border-2 ${node.ok ? "border-lossless bg-lossless/20" : "border-warning bg-warning/20"}`} />
              {i < nodes.length - 1 && <div className="w-px flex-1 bg-border/60" />}
            </div>
            <div className="mb-3 ml-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text">{node.label}</span>
                <span className={`font-mono text-[0.6rem] ${node.ok ? "text-faint" : "text-warning"}`}>
                  {node.detail}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {warnings.length > 0 && (
        <div className="mt-1 space-y-2 border-t border-border/60 pt-3">
          {warnings.map((n) => (
            <div key={n.label} className="flex gap-2 rounded-lg bg-warning/8 px-3 py-2">
              <svg className="mt-0.5 size-3.5 shrink-0 text-warning" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-[0.65rem] leading-relaxed text-warning/90">{n.warn}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectModeButton() {
  const { directMode, toggleDirectMode } = usePlayer();
  return (
    <button
      type="button"
      onClick={toggleDirectMode}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        directMode
          ? "bg-lossless/15 text-lossless ring-1 ring-lossless/30"
          : "text-muted hover:text-text"
      }`}
      aria-pressed={directMode}
      title="Direct mode — bypasses all DSP (EQ, ReplayGain) and locks volume to 100% for bit-clean signal to your DAC"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      </svg>
      Direct
      {directMode && <span className="size-1.5 rounded-full bg-lossless" />}
    </button>
  );
}

function GaplessButton() {
  const { gapless, toggleGapless } = usePlayer();
  return (
    <button
      type="button"
      onClick={toggleGapless}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        gapless ? "bg-accent/12 text-accent" : "text-muted hover:text-text"
      }`}
      aria-pressed={gapless}
      title="Gapless playback — pre-buffers the next track for seamless transitions"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
      Gapless
    </button>
  );
}

const RG_MODES: { value: ReplayGainMode; label: string }[] = [
  { value: "off",   label: "RG Off" },
  { value: "track", label: "Track" },
  { value: "album", label: "Album" },
];

function ReplayGainButton() {
  const { replayGainMode, setReplayGainMode } = usePlayer();
  const cycle = () => {
    const idx = RG_MODES.findIndex((m) => m.value === replayGainMode);
    setReplayGainMode(RG_MODES[(idx + 1) % RG_MODES.length].value);
  };
  return (
    <button
      type="button"
      onClick={cycle}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        replayGainMode !== "off" ? "bg-accent/12 text-accent" : "text-muted hover:text-text"
      }`}
      title="ReplayGain loudness normalization — cycles Off → Track → Album"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
      {RG_MODES.find((m) => m.value === replayGainMode)?.label}
    </button>
  );
}

export default function GlobalPlayerBar() {
  const { creds } = useAuth();
  const {
    current,
    queue,
    currentIndex,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    shuffle,
    repeat,
    togglePlayPause,
    playNext,
    playPrevious,
    seek,
    clear,
    toggleShuffle,
    cycleRepeat,
    removeFromQueue,
    jumpTo,
    analyserNode,
    eqEnabled,
    eqGains,
    eqPreset,
    setEqBandGain,
    applyEqPreset,
    toggleEq,
    directMode,
    contextSampleRate,
    volume,
    muted,
    replayGainMode,
  } = usePlayer();
  const { starredSongIds, toggleSongStar } = useStarred();
  const { openPicker } = usePlaylists();

  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"nowplaying" | "queue">("nowplaying");
  const [showEq, setShowEq] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentQueueItemRef = useRef<HTMLLIElement>(null);
  const [docFullscreen, setDocFullscreen] = useState(false);

  const coverSrc = useMemo(() => {
    if (!creds || !current) return "";
    return coverArtUrl(creds.username, creds.password, current.coverArt ?? current.id, expanded ? 800 : 120);
  }, [creds, current, expanded]);

  const barCoverSrc = useMemo(() => {
    if (!creds || !current) return "";
    return coverArtUrl(creds.username, creds.password, current.coverArt ?? current.id, 120);
  }, [creds, current]);

  const artistAvatarSrc = useMemo(() => {
    if (!creds || !current?.artistId) return "";
    return coverArtUrl(creds.username, creds.password, current.artistId, 96);
  }, [creds, current?.artistId]);

  const dur = Number.isFinite(duration) && duration > 0 ? duration : current?.duration ?? 0;

  const exitExpanded = useCallback(() => {
    setExpanded(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  useEffect(() => {
    const onFs = () => setDocFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitExpanded(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, exitExpanded]);

  useEffect(() => {
    if (activeTab === "queue" && currentQueueItemRef.current) {
      setTimeout(() => {
        currentQueueItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }, [activeTab]);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = overlayRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { return; }
  }, []);

  if (!current) return null;

  return (
    <>
      {expanded && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[60] flex min-h-[100dvh] flex-col overflow-hidden bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
        >
          {coverSrc && (
            <div
              className="pointer-events-none absolute inset-0 scale-105 opacity-[0.18] blur-3xl"
              style={{ backgroundImage: `url(${coverSrc})`, backgroundSize: "cover", backgroundPosition: "center" }}
              aria-hidden
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-bg/70" aria-hidden />

          <div className="relative flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={exitExpanded}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/6 hover:text-text"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface/60 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setActiveTab("nowplaying")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "nowplaying" ? "bg-elevated text-text shadow-sm" : "text-muted hover:text-text"}`}
              >
                Now Playing
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "queue" ? "bg-elevated text-text shadow-sm" : "text-muted hover:text-text"}`}
              >
                Queue
                <span className={`rounded-full px-1.5 py-0.5 font-mono text-[0.55rem] leading-none ${activeTab === "queue" ? "bg-accent/20 text-accent" : "bg-border text-faint"}`}>
                  {queue.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {typeof document !== "undefined" && document.fullscreenEnabled && (
                <button
                  type="button"
                  onClick={() => void toggleBrowserFullscreen()}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/6 hover:text-text"
                >
                  {docFullscreen ? "Exit" : "Fullscreen"}
                </button>
              )}
            </div>
          </div>

          {activeTab === "nowplaying" && (
          <div className="relative flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 pb-10 pt-6 lg:flex-row lg:items-center lg:justify-center lg:gap-14 lg:px-12 lg:pt-4">
            <div className="mx-auto w-full max-w-xs shrink-0 lg:mx-0 lg:max-w-sm">
              <div
                className={`relative overflow-hidden rounded-2xl shadow-[var(--shadow-card)] transition-all duration-300 ${isPlaying ? "scale-100" : "scale-[0.97] opacity-90"}`}
              >
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt=""
                    className="block aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
                    <span className="font-display text-7xl font-semibold text-faint">
                      {(current.title || "?").slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
                {isBuffering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-bg/50 backdrop-blur-sm">
                    <Spinner className="size-10 border-[3px]" />
                  </div>
                )}
                <Visualizer analyserNode={analyserNode} />
              </div>
            </div>

            <div className="flex w-full max-w-sm flex-col lg:max-w-md">
              <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted">
                {current.artistId && current.artist ? (
                  <Link
                    to={`/artists/${current.artistId}`}
                    onClick={exitExpanded}
                    className="transition-colors hover:text-accent"
                  >
                    {current.artist}
                  </Link>
                ) : (
                  <span>{current.artist ?? "—"}</span>
                )}
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-text sm:text-3xl lg:text-4xl">
                {current.title}
              </h2>
              {current.albumTitle && (
                <div className="mt-1.5 text-sm text-muted">
                  {current.albumId ? (
                    <Link
                      to={`/albums/${current.albumId}`}
                      onClick={exitExpanded}
                      className="transition-colors hover:text-accent"
                    >
                      {current.albumTitle}
                    </Link>
                  ) : (
                    <span>{current.albumTitle}</span>
                  )}
                </div>
              )}

              {(current.suffix || current.bitRate) && (
                <div className="mt-3">
                  <QualityLine
                    suffix={current.suffix}
                    bitRate={current.bitRate}
                    transcodedSuffix={current.transcodedSuffix}
                    samplingRate={current.samplingRate}
                    bitDepth={current.bitDepth}
                  />
                </div>
              )}

              <div className="mt-8 space-y-2">
                <SeekBar currentTime={currentTime} dur={dur} onSeek={seek} size="lg" />
                <div className="flex justify-between font-mono text-[0.65rem] tabular-nums text-muted">
                  <span>{fmtTime(currentTime)}</span>
                  <span>{fmtTime(dur)}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3">
                <TransportButtons
                  isPlaying={isPlaying}
                  isBuffering={isBuffering}
                  onPrev={playPrevious}
                  onToggle={togglePlayPause}
                  onNext={playNext}
                  nextDisabled={currentIndex >= queue.length - 1}
                  shuffle={shuffle}
                  repeat={repeat}
                  onShuffle={toggleShuffle}
                  onRepeat={cycleRepeat}
                  size="lg"
                />
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => current && openPicker({ id: current.id, title: current.title })}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-all hover:text-text"
                    aria-label="Add to playlist"
                  >
                    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    Add to playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => current && toggleSongStar(current.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      current && starredSongIds.has(current.id)
                        ? "text-accent"
                        : "text-muted hover:text-text"
                    }`}
                    aria-label={current && starredSongIds.has(current.id) ? "Unstar" : "Star track"}
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill={current && starredSongIds.has(current.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {current && starredSongIds.has(current.id) ? "Starred" : "Star"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEq((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      showEq ? "bg-accent/12 text-accent" : "text-muted hover:text-text"
                    }`}
                    aria-label="Toggle equalizer"
                    aria-pressed={showEq}
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M7 18H5V6h2v12zm4-6H9v6h2v-6zm4-4h-2v10h2V8zm4 4h-2v6h2v-6z" />
                    </svg>
                    EQ
                    {eqEnabled && eqPreset !== "Flat" && eqPreset !== "Custom" && (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[0.55rem] text-accent">{eqPreset}</span>
                    )}
                  </button>
                  <GaplessButton />
                  <ReplayGainButton />
                  <DirectModeButton />
                </div>

                {showEq && !directMode && (
                  <EqPanel
                    eqGains={eqGains}
                    eqPreset={eqPreset}
                    eqEnabled={eqEnabled}
                    onBandChange={setEqBandGain}
                    onPreset={applyEqPreset}
                    onToggle={toggleEq}
                  />
                )}

                {directMode && (
                  <SignalPathPanel
                    current={current}
                    contextSampleRate={contextSampleRate}
                    replayGainMode={replayGainMode}
                    eqEnabled={eqEnabled}
                    eqGains={eqGains}
                    volume={volume}
                    muted={muted}
                  />
                )}
              </div>

            </div>
          </div>
          )}

          {activeTab === "queue" && (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-4">
              <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-5 pb-3">
                <p className="text-xs text-muted">
                  <span className="font-semibold text-text">{queue.length}</span> tracks
                  {queue.length > 0 && (
                    <> · playing <span className="font-semibold text-text">{currentIndex + 1}</span> of {queue.length}</>
                  )}
                </p>
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs text-muted transition-colors hover:text-danger"
                >
                  Clear all
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto px-2 py-2">
                {queue.map((t, i) => {
                  const isCurrent = i === currentIndex;
                  const isPast = i < currentIndex;
                  return (
                    <li
                      key={`${t.id}-${i}`}
                      ref={isCurrent ? currentQueueItemRef : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                        isCurrent
                          ? "bg-accent/10"
                          : isPast
                          ? "opacity-35 hover:opacity-60"
                          : "hover:bg-elevated/60"
                      }`}
                    >
                      <div className="flex w-6 shrink-0 items-center justify-center">
                        {isCurrent ? (
                          <EqBars playing={isPlaying} />
                        ) : (
                          <span className="font-mono text-[0.6rem] text-faint">{i + 1}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { if (!isCurrent) jumpTo(i); }}
                        className="min-w-0 flex-1 text-left"
                        disabled={isCurrent}
                        aria-label={isCurrent ? undefined : `Play ${t.title}`}
                      >
                        <p className={`truncate text-sm font-medium leading-snug ${isCurrent ? "text-accent" : "text-text"}`}>{t.title}</p>
                        <p className="truncate text-xs text-muted">{t.artist ?? "—"}</p>
                      </button>
                      {t.suffix && (
                        <span className={`hidden shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.55rem] font-semibold leading-none sm:inline ${
                          ["FLAC","WAV","AIFF","ALAC","APE","WV"].includes((t.suffix ?? "").toUpperCase()) && !t.transcodedSuffix
                            ? "bg-lossless-bg text-lossless"
                            : "bg-white/5 text-faint"
                        }`}>
                          {(t.transcodedSuffix ?? t.suffix).toUpperCase()}
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[0.65rem] tabular-nums text-faint">
                        {fmtTime(t.duration)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(i)}
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-faint transition-all hover:text-danger ${isCurrent ? "invisible" : "opacity-0 group-hover:opacity-100"}`}
                        aria-label="Remove from queue"
                        title="Remove from queue"
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-bg/95 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(192,132,252,0.25), transparent)" }}
          aria-hidden
        />

        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
          <button
            type="button"
            onClick={() => { setActiveTab("nowplaying"); setExpanded(true); }}
            className="relative shrink-0 overflow-visible rounded-lg border border-border/60"
            aria-label="Open now playing"
          >
            <span className="relative block overflow-hidden rounded-[7px]">
              {barCoverSrc ? (
                <img
                  src={barCoverSrc}
                  alt=""
                  className={`size-12 object-cover sm:size-14 ${isBuffering ? "opacity-60" : ""}`}
                />
              ) : (
                <div className="flex size-12 items-center justify-center font-display text-sm font-semibold text-faint sm:size-14">
                  {(current.title || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              {isBuffering && (
                <span className="absolute inset-0 flex items-center justify-center bg-bg/50">
                  <Spinner className="size-5" />
                </span>
              )}
            </span>
            {artistAvatarSrc && (
              <img
                src={artistAvatarSrc}
                alt=""
                className="absolute -bottom-1 -right-1 z-10 size-6 rounded-full border-2 border-bg object-cover sm:size-7"
              />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="block w-full text-left"
            >
              <p className="truncate text-sm font-medium text-text">{current.title}</p>
            </button>
            <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-xs text-muted">
              {current.artist && (
                current.artistId ? (
                  <Link
                    to={`/artists/${current.artistId}`}
                    className="min-w-0 truncate transition-colors hover:text-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {current.artist}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate">{current.artist}</span>
                )
              )}
              {current.artist && current.albumTitle && (
                <span className="shrink-0 text-faint" aria-hidden>·</span>
              )}
              {current.albumTitle && (
                current.albumId ? (
                  <Link
                    to={`/albums/${current.albumId}`}
                    className="min-w-0 truncate transition-colors hover:text-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {current.albumTitle}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate">{current.albumTitle}</span>
                )
              )}
              {isPlaying && <EqBars playing />}
              {current.suffix && (
                <QualityLine suffix={current.suffix} bitRate={current.bitRate} transcodedSuffix={current.transcodedSuffix} compact />
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-8 shrink-0 text-right font-mono text-[0.6rem] tabular-nums text-faint">
                {fmtTime(currentTime)}
              </span>
              <div className="min-w-0 flex-1">
                <SeekBar currentTime={currentTime} dur={dur} onSeek={seek} size="sm" />
              </div>
              <span className="w-8 shrink-0 font-mono text-[0.6rem] tabular-nums text-faint">
                {fmtTime(dur)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => { setActiveTab("queue"); setExpanded(true); }}
              className="mr-1 hidden items-center gap-1.5 rounded-lg border border-border/60 bg-elevated px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-text sm:flex"
              aria-label="View queue"
              title="Queue"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zm13-5v6l-5-3 5-3z" />
              </svg>
              {queue.length}
            </button>
            <TransportButtons
              isPlaying={isPlaying}
              isBuffering={isBuffering}
              onPrev={playPrevious}
              onToggle={togglePlayPause}
              onNext={playNext}
              nextDisabled={currentIndex >= queue.length - 1}
              shuffle={shuffle}
              repeat={repeat}
              onShuffle={toggleShuffle}
              onRepeat={cycleRepeat}
              size="md"
            />
            <button
              type="button"
              onClick={() => clear()}
              className="ml-1 flex size-8 items-center justify-center rounded-full text-faint transition-all hover:bg-elevated hover:text-danger"
              aria-label="Stop and clear"
              title="Stop"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
