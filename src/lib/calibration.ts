/**
 * Client-side calibration analysis over snapshot.calibration rows.
 * Mirrors nt.calibrate.analyze_calibration semantics (display only).
 */

export type CalRow = {
  bet_id?: string;
  p_model?: number;
  y?: number;
  brier?: number;
  result?: string;
  sport?: string;
  odds_band?: string;
  market?: string;
  phase?: string;
  grade?: string;
  match?: string;
  selection?: string;
  [key: string]: unknown;
};

export type GroupMetrics = {
  n: number;
  brier: number;
  bias: number;
  mean_p: number;
  winrate: number;
  betIds: string[];
};

export type ReliabilityBin = {
  bin: string;
  n: number;
  mean_p: number | null;
  emp_rate: number | null;
  gap: number | null;
  betIds: string[];
};

export type CalibrationReport = {
  n: number;
  brier: number | null;
  log_loss: number | null;
  mean_p_model: number | null;
  base_rate_wins: number | null;
  bias_p_minus_y: number | null;
  interpretation: string;
  reliability_bins: ReliabilityBin[];
  by_odds_band: Record<string, GroupMetrics>;
  by_sport: Record<string, GroupMetrics>;
  by_market: Record<string, GroupMetrics>;
  by_phase: Record<string, GroupMetrics>;
  by_grade: Record<string, GroupMetrics>;
  allBetIds: string[];
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function logLoss(p: number, y: number): number {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

function groupMetrics(rows: CalRow[], key: string): Record<string, GroupMetrics> {
  const buckets = new Map<string, CalRow[]>();
  for (const r of rows) {
    const g = String(r[key] ?? "").trim() || "(empty)";
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push(r);
  }
  const out: Record<string, GroupMetrics> = {};
  for (const [g, items] of buckets) {
    const n = items.length;
    let brier = 0;
    let bias = 0;
    let meanP = 0;
    let wr = 0;
    const betIds: string[] = [];
    for (const x of items) {
      const p = num(x.p_model) ?? 0;
      const y = num(x.y) ?? 0;
      brier += (p - y) ** 2;
      bias += p - y;
      meanP += p;
      wr += y;
      if (x.bet_id) betIds.push(String(x.bet_id));
    }
    out[g] = {
      n,
      brier: Math.round((brier / n) * 1e5) / 1e5,
      bias: Math.round((bias / n) * 1e4) / 1e4,
      mean_p: Math.round((meanP / n) * 1e4) / 1e4,
      winrate: Math.round((wr / n) * 1e4) / 1e4,
      betIds,
    };
  }
  return out;
}

function reliabilityBins(rows: CalRow[], nBins = 10): ReliabilityBin[] {
  const buckets: CalRow[][] = Array.from({ length: nBins }, () => []);
  for (const r of rows) {
    const p = num(r.p_model) ?? 0;
    const idx = Math.min(nBins - 1, Math.max(0, Math.floor(p * nBins)));
    buckets[idx].push(r);
  }
  return buckets.map((items, i) => {
    const lo = i / nBins;
    const hi = (i + 1) / nBins;
    const betIds = items.map((x) => String(x.bet_id || "")).filter(Boolean);
    if (!items.length) {
      return {
        bin: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
        n: 0,
        mean_p: null,
        emp_rate: null,
        gap: null,
        betIds: [],
      };
    }
    const meanP = items.reduce((s, x) => s + (num(x.p_model) ?? 0), 0) / items.length;
    const emp = items.reduce((s, x) => s + (num(x.y) ?? 0), 0) / items.length;
    return {
      bin: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
      n: items.length,
      mean_p: Math.round(meanP * 1e4) / 1e4,
      emp_rate: Math.round(emp * 1e4) / 1e4,
      gap: Math.round((meanP - emp) * 1e4) / 1e4,
      betIds,
    };
  });
}

function interpret(bias: number, brier: number, n: number): string {
  if (n < 20) {
    return `Thin sample (n=${n}). Do not change process hard until n≥30–50.`;
  }
  const parts: string[] = [];
  if (bias > 0.05) {
    parts.push(
      "Overconfident: mean p_model > win rate — haircut/discipline working; don't raise p."
    );
  } else if (bias < -0.05) {
    parts.push(
      "Underconfident: wins more than p implies — may be leaving EV on table (or variance)."
    );
  } else {
    parts.push("Bias near zero — rough calibration OK.");
  }
  if (brier > 0.28) {
    parts.push(`Brier ${brier.toFixed(3)} is weak (random coin ~0.25 at 50%).`);
  } else if (brier < 0.2) {
    parts.push(`Brier ${brier.toFixed(3)} is solid for sports if n large.`);
  }
  return parts.join(" ");
}

export function analyzeCalibration(raw: CalRow[] | undefined | null): CalibrationReport {
  const usable = (raw || []).filter((r) => {
    const y = num(r.y);
    const p = num(r.p_model);
    return (y === 0 || y === 1) && p != null && p >= 0.01 && p <= 0.99;
  });
  const n = usable.length;
  const empty: CalibrationReport = {
    n: 0,
    brier: null,
    log_loss: null,
    mean_p_model: null,
    base_rate_wins: null,
    bias_p_minus_y: null,
    interpretation:
      "No calibration rows with p_model + Win/Loss. Settle researched bets or run calibrate rebuild.",
    reliability_bins: [],
    by_odds_band: {},
    by_sport: {},
    by_market: {},
    by_phase: {},
    by_grade: {},
    allBetIds: [],
  };
  if (n === 0) return empty;

  let brierSum = 0;
  let llSum = 0;
  let meanP = 0;
  let base = 0;
  let bias = 0;
  const allBetIds: string[] = [];
  for (const r of usable) {
    const p = num(r.p_model)!;
    const y = num(r.y)!;
    brierSum += num(r.brier) ?? (p - y) ** 2;
    llSum += logLoss(p, y);
    meanP += p;
    base += y;
    bias += p - y;
    if (r.bet_id) allBetIds.push(String(r.bet_id));
  }
  const brier = brierSum / n;
  return {
    n,
    brier: Math.round(brier * 1e5) / 1e5,
    log_loss: Math.round((llSum / n) * 1e5) / 1e5,
    mean_p_model: Math.round((meanP / n) * 1e4) / 1e4,
    base_rate_wins: Math.round((base / n) * 1e4) / 1e4,
    bias_p_minus_y: Math.round((bias / n) * 1e4) / 1e4,
    interpretation: interpret(bias / n, brier, n),
    reliability_bins: reliabilityBins(usable),
    by_odds_band: groupMetrics(usable, "odds_band"),
    by_sport: groupMetrics(usable, "sport"),
    by_market: groupMetrics(usable, "market"),
    by_phase: groupMetrics(usable, "phase"),
    by_grade: groupMetrics(usable, "grade"),
    allBetIds,
  };
}
