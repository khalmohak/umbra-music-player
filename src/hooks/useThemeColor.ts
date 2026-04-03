import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { usePlayer } from "../context/PlayerContext";
import { coverArtUrl } from "../subsonic";

const DEFAULT_HUE = 280;
const TRANSITION_MS = 1400;

let rafId: number | null = null;
let liveHue = DEFAULT_HUE;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function applyHue(h: number) {
  const hue = Math.round(((h % 360) + 360) % 360);
  const root = document.documentElement;
  root.style.setProperty("--color-accent",       `hsl(${hue}, 73%, 72%)`);
  root.style.setProperty("--color-accent-dim",   `hsl(${hue}, 65%, 52%)`);
  root.style.setProperty("--color-accent-deep",  `hsl(${hue}, 75%, 7%)`);
  root.style.setProperty("--color-accent-glow",  `hsla(${hue}, 70%, 68%, 0.12)`);
  root.style.setProperty("--color-rich-violet",  `hsl(${hue}, 80%, 78%)`);
  root.style.setProperty("--color-rich-indigo",  `hsl(${(hue + 35) % 360}, 70%, 73%)`);
  root.style.setProperty("--color-violet-glow",  `hsla(${hue}, 70%, 68%, 0.06)`);
  root.style.setProperty("--shadow-glow",        `0 0 40px hsla(${hue}, 70%, 68%, 0.28)`);
  root.style.setProperty("--shadow-card",        `0 24px 60px rgba(0,0,0,0.82), 0 0 0 1px hsla(${hue}, 70%, 68%, 0.07)`);
  document.body.style.backgroundImage = [
    `radial-gradient(ellipse 90% 55% at 25% -14%, hsla(${hue},70%,50%,0.15) 0%, transparent 62%)`,
    `radial-gradient(ellipse 65% 55% at 90% 115%, hsla(${hue},70%,68%,0.09) 0%, transparent 55%)`,
    `radial-gradient(ellipse 50% 45% at 5% 90%, hsla(${hue},80%,30%,0.07) 0%, transparent 62%)`,
  ].join(",");
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return from + diff * t;
}

function transitionToHue(target: number) {
  if (rafId !== null) cancelAnimationFrame(rafId);
  const from = liveHue;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / TRANSITION_MS);
    const ease = 1 - Math.pow(1 - t, 3);
    liveHue = lerpAngle(from, target, ease);
    applyHue(liveHue);
    if (t < 1) { rafId = requestAnimationFrame(tick); }
    else { rafId = null; liveHue = target; }
  };
  rafId = requestAnimationFrame(tick);
}

async function extractDominantHue(artUrl: string): Promise<number | null> {
  let blobUrl: string | null = null;
  try {
    const res = await fetch(artUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    blobUrl = URL.createObjectURL(blob);

    return await new Promise<number | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 32;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        let data: ImageData;
        try {
          data = ctx.getImageData(0, 0, SIZE, SIZE);
        } catch {
          resolve(null);
          return;
        }

        const NUM_BUCKETS = 24;
        const bucketCount = new Float32Array(NUM_BUCKETS);
        const bucketSat   = new Float32Array(NUM_BUCKETS);

        for (let i = 0; i < data.data.length; i += 4) {
          const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2], a = data.data[i + 3];
          if (a < 100) continue;
          const [h, s, l] = rgbToHsl(r, g, b);
          if (s < 0.18 || l < 0.07 || l > 0.93) continue;
          const bucket = Math.floor(h / (360 / NUM_BUCKETS)) % NUM_BUCKETS;
          bucketCount[bucket]++;
          bucketSat[bucket] += s;
        }

        let best = -1, bestScore = 0;
        for (let i = 0; i < NUM_BUCKETS; i++) {
          if (bucketCount[i] === 0) continue;
          const avgS = bucketSat[i] / bucketCount[i];
          const score = bucketCount[i] * avgS * avgS;
          if (score > bestScore) { bestScore = score; best = i; }
        }

        if (best === -1) { resolve(null); return; }
        resolve(best * (360 / NUM_BUCKETS) + 360 / NUM_BUCKETS / 2);
      };
      img.onerror = () => resolve(null);
      img.src = blobUrl!;
    });
  } catch {
    return null;
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}

export function useThemeColor() {
  const { creds } = useAuth();
  const { current } = usePlayer();
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!current || !creds) {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        transitionToHue(DEFAULT_HUE);
      }
      return;
    }

    const { id, coverArt } = current;
    if (id === lastIdRef.current) return;
    lastIdRef.current = id;

    if (!coverArt) {
      transitionToHue(DEFAULT_HUE);
      return;
    }

    const artSrc = coverArtUrl(creds.username, creds.password, coverArt, 48);
    extractDominantHue(artSrc).then((hue) => {
      if (lastIdRef.current === id) {
        transitionToHue(hue ?? DEFAULT_HUE);
      }
    });
  }, [current, creds]);
}
