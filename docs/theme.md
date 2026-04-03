# Theme — Audio Listener

Design reference for a **single dark theme**: **premium minimal** — cool zinc neutrals, **one restrained sky accent**, soft violet secondary glow. No light mode.

---

## Principles

| Principle | Application |
|-----------|-------------|
| **Neutral-first** | Surfaces stay in zinc (`bg` → `surface` → `elevated`); color carries meaning, not decoration. |
| **One primary accent** | Sky (`accent` / `accent-dim`) for CTAs, focus, and highlights — calm, not neon. |
| **Secondary richness** | Soft violet for gradients and secondary emphasis only — never compete with primary actions. |
| **Restraint** | Hairline borders (`border`), subtle card lift (`shadow-card` + 1px highlight); avoid rainbow UI. |
| **Motion** | Short (120–200ms), ease-out; micro-interactions on hover/active only — no decorative animation loops except loading. |

---

## Color

### Base (neutrals)

Cool **zinc** family — reads cleaner than blue-gray on OLED-style blacks.

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#09090b` | Deepest app background |
| `--surface` | `#0f0f11` | Cards, panels |
| `--elevated` | `#18181b` | Raised rows, nested panels |
| `--border` | `#27272a` | Default dividers, inputs |
| `--border-strong` | `#3f3f46` | Emphasized separators |

### Text

| Token | Hex | Role |
|-------|-----|------|
| `--text` | `#fafafa` | Primary body and titles |
| `--text-secondary` | `#d4d4d8` | Secondary lines |
| `--muted` | `#a1a1aa` | Meta labels, captions |
| `--faint` | `#52525b` | Disabled, subtle hints |

### Primary accent (sky)

Primary buttons, links, focus rings, key metrics.

| Token | Hex | Role |
|-------|-----|------|
| `--accent` | `#7dd3fc` | Bright sky — highlights, gradient start |
| `--accent-dim` | `#0284c7` | Deeper sky — gradient end, focus border |
| `--accent-deep` | `#0f172a` | Label on solid / gradient buttons (slate) |
| `--accent-glow` | `rgba(125, 211, 252, 0.055)` | Ambient top glow |

### Secondary accent (violet)

Secondary emphasis only: corner glow, charts, tertiary UI.

| Token | Hex | Role |
|-------|-----|------|
| `--rich-violet` | `#a78bfa` | Secondary bars, highlights |
| `--rich-indigo` | `#818cf8` | Deeper secondary |
| `--violet-glow` | `rgba(167, 139, 250, 0.045)` | Ambient corner |

### Semantic (state)

| Token | Hex | Role |
|-------|-----|------|
| `--danger` | `#fb7185` | Errors, destructive (rose, softer than pure red) |
| `--danger-bg` | `rgba(251, 113, 133, 0.1)` | Error surfaces |
| `--warning` | `#fbbf24` | Warnings |
| `--info` | `#22d3ee` | Informational / chart distinct from sky accent |

### Implementation (CSS variables)

Aligned with `src/index.css` `@theme`:

```css
:root {
  --bg: #09090b;
  --surface: #0f0f11;
  --elevated: #18181b;
  --border: #27272a;
  --border-strong: #3f3f46;

  --text: #fafafa;
  --text-secondary: #d4d4d8;
  --muted: #a1a1aa;
  --faint: #52525b;

  --accent: #7dd3fc;
  --accent-dim: #0284c7;
  --accent-deep: #0f172a;
  --accent-glow: rgba(125, 211, 252, 0.055);

  --rich-violet: #a78bfa;
  --rich-indigo: #818cf8;
  --violet-glow: rgba(167, 139, 250, 0.045);

  --danger: #fb7185;
  --danger-bg: rgba(251, 113, 133, 0.1);
  --warning: #fbbf24;
  --info: #22d3ee;
}
```

### Ambient background

- Large ellipse **top center**: `--accent-glow` (sky).
- Smaller ellipse **top right**: `--violet-glow` (violet).

Keep opacity low; text stays on near-white (`--text`).

---

## Typography

| Role | Family | Notes |
|------|--------|--------|
| **UI** | `DM Sans`, system-ui, sans-serif | Weights 400–700; titles **600–700**, body **400–500**. |
| **Mono** | `JetBrains Mono`, ui-monospace | IDs, API values, timestamps, code snippets. |

### Scale (reference)

| Name | Size | Use |
|------|------|-----|
| `title` | `1.5rem` | Screen titles |
| `body` | `0.95rem` | Inputs, primary body |
| `small` | `0.875rem` | Secondary text |
| `meta` | `0.75rem` | Uppercase labels (`letter-spacing: 0.06–0.08em`, `font-weight: 600`, `color: var(--muted)`) |
| `mono-small` | `0.78–0.82rem` | Tabular or technical values |

**Letter-spacing:** slightly negative on large titles (`-0.02em`). Positive on uppercase meta labels.

---

## Spacing

Use a **4px base** (0.25rem). Prefer **8 / 12 / 16 / 24 / 32** for padding and gaps.

| Token | Value | Typical use |
|-------|-------|-------------|
| `--space-1` | `0.25rem` | Tight icon gaps |
| `--space-2` | `0.5rem` | Inline spacing |
| `--space-3` | `0.75rem` | Compact padding |
| `--space-4` | `1rem` | Default block gap |
| `--space-5` | `1.25rem` | Section separation |
| `--space-6` | `1.5rem` | Page gutters |
| `--space-8` | `2rem` | Major sections |

---

## Radius & elevation

| Token | Value | Use |
|-------|-------|-----|
| `--radius` | `14px` | Cards, large containers |
| `--radius-sm` | `10px` | Inputs, buttons, inset panels |
| `--radius-full` | `9999px` | Pills, avatars |

| Token | Example | Use |
|-------|-----------|-----|
| `--shadow-card` | `0 20px 48px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.03)` | Floating cards |
| `--shadow-soft` | `0 4px 24px rgba(0,0,0,0.28)` | Inset panels, lists |

---

## Focus & interaction

- **Focus ring:** `box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.22)` with `border-color: var(--accent-dim)` on inputs.
- **Primary button:** gradient from `--accent` to `--accent-dim`; label `--accent-deep`. Spinner: light `border-t` on gradient.
- **Hover:** slight `brightness` and `translateY(-1px)`; duration **~120–150ms**.
- **Disabled:** `opacity: 0.55`, no lift on hover.

---

## Do / don’t

| Do | Don’t |
|----|--------|
| Use **one** sky-forward accent per primary action | Mix saturated green + blue + purple in one control strip |
| Use `--muted` for labels | Use full `--text` for every line |
| Use mono for technical values | Use mono for long paragraphs |
| Keep ambient gradients subtle | Add heavy blur or noise behind text |

---

## Fonts loading

Load **DM Sans** and **JetBrains Mono** from Google Fonts (or self-host). Subset weights actually used (e.g. 400, 500, 600, 700 for DM Sans; 400, 500 for mono).

---

*Keep `src/index.css` `@theme` aligned with this document.*
