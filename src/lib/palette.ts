/**
 * LuminaNT · God Desk design tokens
 * Hero accent: Electric Gold / Amber-Gold ("God color")
 * CSS HSL counterparts live in index.css :root.
 */

export const palette = {
  /** Deep electric gold — primary signal, profit, live, God accent */
  profit: "#C9A227",
  primary: "#C9A227",
  /** Rich highlight (still warm, not pale) */
  accent: "#E0B83A",
  /** Soft gold glow edge */
  cyan: "#D4B04A",
  gold: "#C9A227",
  goldBright: "#E0B83A",
  goldGlow: "#D4B04A",
  /** Soft indigo — secondary accent (nav secondary, refunded) */
  indigo: "#8B95FF",
  violet: "#8B95FF",
  /** Coral — loss / destructive */
  loss: "#FF6B7A",
  /** Amber — risk / pending only (distinct from profit gold) */
  pending: "#F59E0B",
  /** Axis / muted labels */
  muted: "#A8B6CA",
  /** Grid lines */
  grid: "rgba(168,182,202,0.14)",
  /** Deep void (chart bg reference) */
  void: "#070C16",
} as const;

/** Gold-led categorical series (deep gold family + cool secondary) */
export const seriesCool = [
  "#C9A227",
  "#E0B83A",
  "#A67C1A",
  "#8B95FF",
  "#B8860B",
  "#A8B6CA",
  "#D4B04A",
  "#8B6914",
  "#7B8CFF",
  "#C4A035",
  "#9A7B1A",
  "#94A3B8",
] as const;

/** Fixed sport → color map (deep gold-led + cool secondary) */
export const sportColors: Record<string, string> = {
  football: "#C9A227",
  soccer: "#C9A227",
  tennis: "#E0B83A",
  esports: "#8B95FF",
  "e-sports": "#8B95FF",
  wnba: "#B8860B",
  nba: "#B8860B",
  basketball: "#A67C1A",
  handball: "#D4B04A",
  cycling: "#A8B6CA",
  snooker: "#8B95FF",
  golf: "#C4A035",
  hockey: "#D4B04A",
  baseball: "#7B8CFF",
  mma: "#94A3B8",
  boxing: "#8B6914",
  cricket: "#B8860B",
  rugby: "#A67C1A",
  volleyball: "#E0B83A",
  darts: "#8B95FF",
  motorsport: "#A8B6CA",
  formula: "#A8B6CA",
};

export function colorForSport(sport: string, fallbackIndex = 0): string {
  const key = (sport || "").trim().toLowerCase();
  if (key && sportColors[key]) return sportColors[key];
  for (const [k, c] of Object.entries(sportColors)) {
    if (key.includes(k) || k.includes(key)) return c;
  }
  return seriesCool[fallbackIndex % seriesCool.length];
}

/** Result labels for pie / badges (engine taxonomy + legacy) */
export const resultColors: Record<string, string> = {
  win: palette.profit,
  loss: palette.loss,
  pending: palette.pending,
  confirmedplaced: palette.pending,
  "confirmed placed": palette.pending,
  refunded: palette.indigo,
  abandoned: palette.muted,
  void: palette.muted,
  push: palette.accent,
};

export function colorForResult(name: string, index = 0): string {
  const key = (name || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (resultColors[key]) return resultColors[key];
  // spaced keys
  const spaced = (name || "").trim().toLowerCase();
  if (resultColors[spaced]) return resultColors[spaced];
  return seriesCool[index % seriesCool.length];
}

/** ECharts / SVG hex with alpha suffix (00–ff) */
export function withAlpha(hex: string, alpha01: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha01)) * 255)
    .toString(16)
    .padStart(2, "0");
  const h = hex.replace("#", "");
  if (h.length === 6) return `#${h}${a}`;
  return hex;
}

/** chartColors-compatible object for existing charts.ts consumers */
export const chartColors: {
  accent: string;
  cyan: string;
  violet: string;
  magenta: string;
  profit: string;
  loss: string;
  pending: string;
  muted: string;
  grid: string;
  series: string[];
} = {
  accent: palette.accent,
  cyan: palette.goldGlow,
  violet: palette.indigo,
  magenta: palette.indigo,
  profit: palette.profit,
  loss: palette.loss,
  pending: palette.pending,
  muted: palette.muted,
  grid: palette.grid,
  series: [...seriesCool],
};

/** Gold glow rgba helpers for charts / SVG (deep gold) */
export const goldGlow = {
  soft: "rgba(201,162,39,0.22)",
  mid: "rgba(201,162,39,0.38)",
  strong: "rgba(201,162,39,0.55)",
  bright: "rgba(224,184,58,0.42)",
  tip: "rgba(212,176,74,0.35)",
  border: "rgba(201,162,39,0.35)",
} as const;
