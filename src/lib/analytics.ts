import type {
  Bet,
  BetFilters,
  BreakdownRow,
  DerivedMetrics,
  EquityPoint,
} from "@/types";
import { marketFamilyLabel } from "@/lib/markets";
import {
  isLoss,
  isOpenRisk,
  isPending,
  isSettled,
  isWin,
  settlementCalendarDay,
} from "@/lib/utils";

/** Default chart day axis — aligned with engine kill-switch day. */
export type EquityDateMode = "settlement" | "match";

export function emptyFilters(): BetFilters {
  return {
    search: "",
    results: [],
    sports: [],
    phases: [],
    grades: [],
    marketTypes: [],
    oddsBands: [],
    dateFrom: "",
    dateTo: "",
    oddsMin: "",
    oddsMax: "",
    stakeMin: "",
    stakeMax: "",
    betIds: [],
    forensicTrail: [],
  };
}

export function filterBets(bets: Bet[], f: BetFilters): Bet[] {
  const q = f.search.trim().toLowerCase();
  const oddsMin = f.oddsMin ? Number(f.oddsMin) : null;
  const oddsMax = f.oddsMax ? Number(f.oddsMax) : null;
  const stakeMin = f.stakeMin ? Number(f.stakeMin) : null;
  const stakeMax = f.stakeMax ? Number(f.stakeMax) : null;
  const idSet =
    f.betIds && f.betIds.length > 0 ? new Set(f.betIds.map(String)) : null;

  return bets.filter((b) => {
    if (idSet && !idSet.has(String(b.bet_id))) return false;
    if (f.dateFrom && b.date < f.dateFrom) return false;
    if (f.dateTo && b.date > f.dateTo) return false;
    if (f.results.length && !f.results.includes(b.result)) return false;
    if (f.sports.length && !f.sports.includes(b.sport || "(empty)")) return false;
    if (f.phases.length && !f.phases.includes(b.phase || "(empty)")) return false;
    if (f.grades.length && !f.grades.includes(b.research_grade || "(empty)")) return false;
    if (f.marketTypes.length) {
      const fam = b.market_family || "(empty)";
      const raw = b.market_type || "(empty)";
      const label = marketFamilyLabel(fam);
      const ok = f.marketTypes.some(
        (t) => t === fam || t === raw || t === label || t === "(empty)"
      );
      if (!ok) return false;
    }
    if (f.oddsBands.length && !f.oddsBands.includes(b.odds_band || "(empty)")) return false;
    if (oddsMin != null && !Number.isNaN(oddsMin) && b.decimal_odds < oddsMin) return false;
    if (oddsMax != null && !Number.isNaN(oddsMax) && b.decimal_odds > oddsMax) return false;
    if (stakeMin != null && !Number.isNaN(stakeMin) && b.stake_nok < stakeMin) return false;
    if (stakeMax != null && !Number.isNaN(stakeMax) && b.stake_nok > stakeMax) return false;

    if (q) {
      if (q.startsWith("id:")) {
        return String(b.bet_id).toLowerCase() === q.slice(3).trim();
      }
      // P2 full-text: multi-token AND across primary fields
      const hay = [
        b.bet_id,
        b.match,
        b.selection,
        b.notes,
        b.sport,
        b.market_type,
        b.market_family,
        b.phase,
        b.research_grade,
        b.source,
        b.odds_band,
        b.result,
      ]
        .join(" ")
        .toLowerCase();
      const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length === 0) return true;
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

/** P2: sport × status stake matrix for risk heatmap. */
export function riskHeatmapMatrix(bets: Bet[]): {
  sports: string[];
  statuses: string[];
  cells: Array<{ sport: string; status: string; stake: number; n: number; betIds: string[] }>;
} {
  const open = bets.filter((b) => isOpenRisk(b.result));
  const map = new Map<string, { stake: number; n: number; betIds: string[] }>();
  for (const b of open) {
    const sport = (b.sport || "(unknown)").trim() || "(unknown)";
    const status = (b.result || "Pending").trim() || "Pending";
    const k = `${sport}\0${status}`;
    const cur = map.get(k) || { stake: 0, n: 0, betIds: [] };
    cur.stake += Number(b.stake_nok) || 0;
    cur.n += 1;
    cur.betIds.push(b.bet_id);
    map.set(k, cur);
  }
  const sports = Array.from(new Set([...map.keys()].map((k) => k.split("\0")[0]))).sort();
  const statuses = Array.from(new Set([...map.keys()].map((k) => k.split("\0")[1]))).sort();
  const cells: Array<{
    sport: string;
    status: string;
    stake: number;
    n: number;
    betIds: string[];
  }> = [];
  for (const [k, v] of map) {
    const [sport, status] = k.split("\0");
    cells.push({ sport, status, stake: v.stake, n: v.n, betIds: v.betIds });
  }
  return { sports, statuses, cells };
}

/**
 * P2: Edge decay — mean realized ROI by days-from-place buckets for settled bets
 * with recoverable EV or p_model in notes.
 */
export function edgeDecaySeries(
  bets: Bet[]
): Array<{ bucket: string; n: number; roi: number; pl: number }> {
  const settled = bets.filter((b) => isSettled(b.result));
  const buckets = new Map<string, { stake: number; pl: number; n: number }>();

  for (const b of settled) {
    const stake = Number(b.stake_nok) || 0;
    const pl = Number(b.p_l_nok) || 0;
    if (stake <= 0) continue;
    // days between place (created_at/date) and settle (updated_at/date)
    const place = (b.created_at || b.date || "").slice(0, 10);
    const settle = settlementCalendarDay(b) || (b.updated_at || b.date || "").slice(0, 10);
    let days = 0;
    if (place && settle) {
      const t0 = Date.parse(place);
      const t1 = Date.parse(settle);
      if (Number.isFinite(t0) && Number.isFinite(t1)) {
        days = Math.max(0, Math.round((t1 - t0) / 86400000));
      }
    }
    let bucket = "0d";
    if (days >= 7) bucket = "7d+";
    else if (days >= 3) bucket = "3-6d";
    else if (days >= 1) bucket = "1-2d";
    const cur = buckets.get(bucket) || { stake: 0, pl: 0, n: 0 };
    cur.stake += stake;
    cur.pl += pl;
    cur.n += 1;
    buckets.set(bucket, cur);
  }

  const order = ["0d", "1-2d", "3-6d", "7d+"];
  return order
    .filter((k) => buckets.has(k))
    .map((k) => {
      const v = buckets.get(k)!;
      return {
        bucket: k,
        n: v.n,
        pl: Math.round(v.pl * 100) / 100,
        roi: v.stake > 0 ? Math.round((v.pl / v.stake) * 1000) / 1000 : 0,
      };
    });
}

/**
 * Calendar day for a bet under match-kickoff or settlement (Europe/Oslo) semantics.
 * Settlement mode matches equity/daily charts and risk kill-switch day.
 */
export function betCalendarDay(
  b: Bet,
  mode: EquityDateMode = "settlement"
): string {
  if (mode === "match") return (b.date || "").slice(0, 10);
  return settlementCalendarDay(b) || (b.date || "").slice(0, 10);
}

/** Collect bet_ids for a dimension value (client-side grain aggregate). */
export function betIdsForDim(
  bets: Bet[],
  dim: string,
  value: string,
  opts?: { dateMode?: EquityDateMode }
): string[] {
  const dateMode = opts?.dateMode ?? "settlement";
  return bets
    .filter((b) => {
      if (dim === "sport") return (b.sport || "(empty)") === value;
      if (dim === "phase") return (b.phase || "(empty)") === value;
      if (dim === "odds_band") return (b.odds_band || "(empty)") === value;
      if (dim === "research_grade") return (b.research_grade || "(empty)") === value;
      if (dim === "result") return b.result === value;
      if (dim === "source") return (b.source || "(empty)") === value;
      if (dim === "market_family") {
        const fam = b.market_family || "Other";
        const label = marketFamilyLabel(fam);
        return fam === value || label === value;
      }
      if (dim === "high_odds") {
        const bucket = b.decimal_odds > 2.5 ? "odds > 2.5" : "odds ≤ 2.5";
        return bucket === value;
      }
      if (dim === "date") return betCalendarDay(b, dateMode) === value;
      return false;
    })
    .map((b) => b.bet_id)
    .filter(Boolean);
}

/** Simple period window: last N days ending today vs prior N days. */
export function periodWindows(days = 14): {
  aFrom: string;
  aTo: string;
  bFrom: string;
  bTo: string;
} {
  const end = new Date();
  const aTo = end.toISOString().slice(0, 10);
  const aStart = new Date(end);
  aStart.setDate(aStart.getDate() - (days - 1));
  const aFrom = aStart.toISOString().slice(0, 10);
  const bEnd = new Date(aStart);
  bEnd.setDate(bEnd.getDate() - 1);
  const bTo = bEnd.toISOString().slice(0, 10);
  const bStart = new Date(bEnd);
  bStart.setDate(bStart.getDate() - (days - 1));
  const bFrom = bStart.toISOString().slice(0, 10);
  return { aFrom, aTo, bFrom, bTo };
}

export function processHealthKpis(bets: Bet[]): {
  processSolidPct: number | null;
  gradeBPlusPct: number | null;
  highOddsAPct: number | null;
  pModelInNotesPct: number | null;
  n: number;
} {
  const settled = bets.filter((b) => isSettled(b.result) && b.source !== "era_archive");
  const n = settled.length;
  if (!n) {
    return {
      processSolidPct: null,
      gradeBPlusPct: null,
      highOddsAPct: null,
      pModelInNotesPct: null,
      n: 0,
    };
  }
  const gradeB = settled.filter((b) =>
    ["A", "B"].includes((b.research_grade || "").toUpperCase())
  ).length;
  const withModel = settled.filter(
    (b) => /p_model\s*=/i.test(b.notes || "") || /EV\s*=/i.test(b.notes || "")
  ).length;
  const high = settled.filter((b) => b.decimal_odds > 2.5);
  const highA = high.filter((b) => (b.research_grade || "").toUpperCase() === "A");
  // "solid" proxy: grade A/B + notes signal (true decision join is Case File)
  const solid = settled.filter(
    (b) =>
      ["A", "B"].includes((b.research_grade || "").toUpperCase()) &&
      (/EV\s*=/i.test(b.notes || "") || /p_model\s*=/i.test(b.notes || ""))
  ).length;
  return {
    processSolidPct: solid / n,
    gradeBPlusPct: gradeB / n,
    highOddsAPct: high.length ? highA.length / high.length : null,
    pModelInNotesPct: withModel / n,
    n,
  };
}

export function computeMetrics(bets: Bet[], baseline = 500): DerivedMetrics {
  const settled = bets.filter((b) => isSettled(b.result));
  const pending = bets.filter((b) => isPending(b.result));
  const wins = settled.filter((b) => isWin(b.result));
  const losses = settled.filter((b) => isLoss(b.result));
  const totalPl = settled.reduce((s, b) => s + (b.p_l_nok || 0), 0);
  const totalStaked = settled.reduce((s, b) => s + (b.stake_nok || 0), 0);
  const avgOdds =
    settled.length > 0
      ? settled.reduce((s, b) => s + b.decimal_odds, 0) / settled.length
      : 0;
  const avgStake =
    settled.length > 0
      ? settled.reduce((s, b) => s + b.stake_nok, 0) / settled.length
      : 0;

  const highOdds = settled.filter((b) => b.decimal_odds > 2.5);

  // Streak from most recent settled by date
  const chronological = [...settled].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
  let streakType: "W" | "L" | "—" = "—";
  let streakCount = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const r = chronological[i].result;
    if (!isWin(r) && !isLoss(r)) continue;
    const t: "W" | "L" = isWin(r) ? "W" : "L";
    if (streakType === "—") {
      streakType = t;
      streakCount = 1;
    } else if (streakType === t) {
      streakCount++;
    } else break;
  }

  // Best / worst day
  const byDay = new Map<string, number>();
  for (const b of settled) {
    byDay.set(b.date, (byDay.get(b.date) || 0) + b.p_l_nok);
  }
  let bestDay: DerivedMetrics["bestDay"] = null;
  let worstDay: DerivedMetrics["worstDay"] = null;
  for (const [date, pl] of byDay) {
    if (!bestDay || pl > bestDay.pl) bestDay = { date, pl };
    if (!worstDay || pl < worstDay.pl) worstDay = { date, pl };
  }

  return {
    equity: baseline + totalPl,
    baseline,
    totalPl,
    settledCount: settled.length,
    pendingCount: pending.length,
    wins: wins.length,
    losses: losses.length,
    winRate: settled.length ? wins.length / settled.length : 0,
    roi: totalStaked > 0 ? totalPl / totalStaked : 0,
    totalStaked,
    avgOdds,
    avgStake,
    currentStreak: { type: streakType, count: streakCount },
    bestDay,
    worstDay,
    highOddsCount: highOdds.length,
    highOddsPl: highOdds.reduce((s, b) => s + b.p_l_nok, 0),
  };
}

/**
 * Equity path for charts.
 * @param dateMode default **settlement** (Europe/Oslo via updated_at) — same “today”
 *                 semantics as risk kill-switch. Pass `"match"` for kickoff calendar view.
 */
export function equityCurve(
  bets: Bet[],
  baseline = 500,
  dateMode: EquityDateMode = "settlement"
): EquityPoint[] {
  const settled = [...bets]
    .filter((b) => isSettled(b.result))
    .map((b) => ({ b, d: betCalendarDay(b, dateMode) }))
    .filter((x) => x.d)
    .sort((a, b) => {
      if (a.d !== b.d) return a.d.localeCompare(b.d);
      return (a.b.updated_at || a.b.created_at || "").localeCompare(
        b.b.updated_at || b.b.created_at || ""
      );
    });

  const byDate = new Map<string, { pl: number; bets: number }>();
  for (const { b, d } of settled) {
    const cur = byDate.get(d) || { pl: 0, bets: 0 };
    cur.pl += b.p_l_nok || 0;
    cur.bets += 1;
    byDate.set(d, cur);
  }

  const dates = Array.from(byDate.keys()).sort();
  let cum = 0;
  let hwm = baseline;
  const points: EquityPoint[] = [];
  for (const date of dates) {
    const d = byDate.get(date)!;
    cum += d.pl;
    const equity = baseline + cum;
    hwm = Math.max(hwm, equity);
    const dd = hwm > 0 ? Math.max(0, (hwm - equity) / hwm) : 0;
    points.push({
      date,
      equity,
      pl: d.pl,
      cumulativePl: cum,
      bets: d.bets,
      hwm,
      drawdownPct: dd,
    });
  }
  return points;
}

export function dailyPl(
  bets: Bet[],
  dateMode: EquityDateMode = "settlement"
): { date: string; pl: number; wins: number; losses: number }[] {
  const map = new Map<string, { pl: number; wins: number; losses: number }>();
  for (const b of bets.filter((x) => isSettled(x.result))) {
    const d = betCalendarDay(b, dateMode);
    if (!d) continue;
    const cur = map.get(d) || { pl: 0, wins: 0, losses: 0 };
    cur.pl += b.p_l_nok || 0;
    if (isWin(b.result)) cur.wins++;
    if (isLoss(b.result)) cur.losses++;
    map.set(d, cur);
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({
      date,
      pl: Math.round(v.pl * 100) / 100,
      wins: v.wins,
      losses: v.losses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type OpenRiskSportRow = {
  sport: string;
  stake: number;
  n: number;
  pending: number;
  confirmed: number;
};

export type OpenRiskMatchRow = {
  match: string;
  sport: string;
  stake: number;
  n: number;
  statuses: string[];
  betIds: string[];
};

/** Open risk concentration — Pending + ConfirmedPlaced only. */
export function openRiskConcentration(bets: Bet[]): {
  bySport: OpenRiskSportRow[];
  byMatch: OpenRiskMatchRow[];
  totalStake: number;
  n: number;
} {
  const open = bets.filter((b) => isOpenRisk(b.result));
  const sportMap = new Map<string, OpenRiskSportRow>();
  const matchMap = new Map<string, OpenRiskMatchRow>();

  for (const b of open) {
    const sport = (b.sport || "(unknown)").trim() || "(unknown)";
    const stake = Number(b.stake_nok) || 0;
    const sp = sportMap.get(sport) || {
      sport,
      stake: 0,
      n: 0,
      pending: 0,
      confirmed: 0,
    };
    sp.stake += stake;
    sp.n += 1;
    const rk = (b.result || "").toLowerCase().replace(/[\s_-]+/g, "");
    if (rk === "confirmedplaced") sp.confirmed += 1;
    else sp.pending += 1;
    sportMap.set(sport, sp);

    const match = (b.match || "(empty)").trim() || "(empty)";
    const mk = matchMap.get(match) || {
      match,
      sport,
      stake: 0,
      n: 0,
      statuses: [],
      betIds: [],
    };
    mk.stake += stake;
    mk.n += 1;
    if (b.result && !mk.statuses.includes(b.result)) mk.statuses.push(b.result);
    mk.betIds.push(b.bet_id);
    matchMap.set(match, mk);
  }

  const bySport = Array.from(sportMap.values()).sort((a, b) => b.stake - a.stake);
  const byMatch = Array.from(matchMap.values()).sort((a, b) => b.stake - a.stake);
  const totalStake = bySport.reduce((s, r) => s + r.stake, 0);
  return { bySport, byMatch, totalStake, n: open.length };
}

/** Logical order for odds bands (not alphabetical / not by count). */
const ODDS_BAND_ORDER = ["<1.5", "1.5-1.8", "1.8-2.2", "2.2-2.5", "2.5-3.0", ">=3.0"];
const PHASE_ORDER = ["1A", "1B", "2", "3", "4", "5"];
const RESULT_ORDER = [
  "Pending",
  "ConfirmedPlaced",
  "Win",
  "Loss",
  "Refunded",
  "Abandoned",
  "Void",
  "Push",
];

function naturalKeyRank(dim: string | undefined, key: string): number {
  if (!dim) return 999;
  if (dim === "odds_band") {
    const i = ODDS_BAND_ORDER.indexOf(key);
    return i >= 0 ? i : 500 + key.localeCompare("");
  }
  if (dim === "phase") {
    const i = PHASE_ORDER.indexOf(key);
    return i >= 0 ? i : 500;
  }
  if (dim === "result") {
    const i = RESULT_ORDER.findIndex((r) => r.toLowerCase() === key.toLowerCase());
    return i >= 0 ? i : 500;
  }
  return 500;
}

/**
 * @param sortMode
 *  - natural: odds_band / phase / result in ladder order; else by |pl|
 *  - count: largest n first (default legacy)
 *  - pl: best P/L first
 */
export function breakdownBy(
  bets: Bet[],
  key: keyof Bet | ((b: Bet) => string),
  sortMode: "natural" | "count" | "pl" = "natural"
): BreakdownRow[] {
  const dimName = typeof key === "string" ? key : undefined;
  const map = new Map<string, BreakdownRow>();
  for (const b of bets) {
    const k =
      typeof key === "function"
        ? key(b) || "(empty)"
        : String(b[key] ?? "").trim() || "(empty)";
    const row =
      map.get(k) ||
      ({
        key: k,
        count: 0,
        wins: 0,
        losses: 0,
        pl: 0,
        staked: 0,
        roi: 0,
        winRate: 0,
      } as BreakdownRow);
    row.count++;
    if (isWin(b.result)) row.wins++;
    if (isLoss(b.result)) row.losses++;
    if (isSettled(b.result)) {
      row.pl += b.p_l_nok || 0;
      row.staked += b.stake_nok || 0;
    }
    map.set(k, row);
  }
  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    pl: Math.round(r.pl * 100) / 100,
    roi: r.staked > 0 ? r.pl / r.staked : 0,
    winRate: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
  }));

  const hasNatural =
    dimName === "odds_band" || dimName === "phase" || dimName === "result";

  if (sortMode === "count") {
    return rows.sort((a, b) => b.count - a.count);
  }
  if (sortMode === "pl") {
    return rows.sort((a, b) => b.pl - a.pl);
  }
  // natural
  if (hasNatural) {
    return rows.sort(
      (a, b) =>
        naturalKeyRank(dimName, a.key) - naturalKeyRank(dimName, b.key) ||
        a.key.localeCompare(b.key)
    );
  }
  // markets/sports: sort by |P/L| so biggest effects read first, empty last
  return rows.sort((a, b) => {
    if (a.key === "(empty)") return 1;
    if (b.key === "(empty)") return -1;
    return Math.abs(b.pl) - Math.abs(a.pl) || b.count - a.count;
  });
}

export function histogram(
  values: number[],
  bins = 12
): { bin: string; count: number; mid: number }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ bin: min.toFixed(2), count: values.length, mid: min }];
  }
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let i = Math.floor((v - min) / width);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    counts[i]++;
  }
  return counts.map((count, i) => {
    const lo = min + i * width;
    const hi = lo + width;
    return {
      bin: `${lo.toFixed(2)}–${hi.toFixed(2)}`,
      count,
      mid: (lo + hi) / 2,
    };
  });
}

export function calendarHeatmap(
  bets: Bet[],
  dateMode: EquityDateMode = "settlement"
): { date: string; pl: number; count: number }[] {
  const map = new Map<string, { pl: number; count: number }>();
  for (const b of bets.filter((x) => isSettled(x.result))) {
    const d = betCalendarDay(b, dateMode);
    if (!d) continue;
    const cur = map.get(d) || { pl: 0, count: 0 };
    cur.pl += b.p_l_nok || 0;
    cur.count++;
    map.set(d, cur);
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function rollingWinRate(
  bets: Bet[],
  window = 20,
  dateMode: EquityDateMode = "settlement"
): { date: string; winRate: number; n: number }[] {
  const settled = [...bets]
    .filter((b) => isSettled(b.result) && (isWin(b.result) || isLoss(b.result)))
    .map((b) => ({ b, d: betCalendarDay(b, dateMode) }))
    .filter((x) => x.d)
    .sort((a, c) => {
      if (a.d !== c.d) return a.d.localeCompare(c.d);
      return (a.b.updated_at || a.b.created_at || "").localeCompare(
        c.b.updated_at || c.b.created_at || ""
      );
    });

  const out: { date: string; winRate: number; n: number }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const slice = settled.slice(Math.max(0, i - window + 1), i + 1);
    const wins = slice.filter((x) => isWin(x.b.result)).length;
    out.push({
      date: settled[i].d,
      winRate: wins / slice.length,
      n: slice.length,
    });
  }
  return out;
}

export function rollingRoi(
  bets: Bet[],
  window = 20,
  dateMode: EquityDateMode = "settlement"
): { date: string; roi: number; n: number }[] {
  const settled = [...bets]
    .filter((b) => isSettled(b.result))
    .map((b) => ({ b, d: betCalendarDay(b, dateMode) }))
    .filter((x) => x.d)
    .sort((a, c) => {
      if (a.d !== c.d) return a.d.localeCompare(c.d);
      return (a.b.updated_at || a.b.created_at || "").localeCompare(
        c.b.updated_at || c.b.created_at || ""
      );
    });

  const out: { date: string; roi: number; n: number }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const slice = settled.slice(Math.max(0, i - window + 1), i + 1);
    const pl = slice.reduce((s, x) => s + x.b.p_l_nok, 0);
    const staked = slice.reduce((s, x) => s + x.b.stake_nok, 0);
    out.push({
      date: settled[i].d,
      roi: staked > 0 ? pl / staked : 0,
      n: slice.length,
    });
  }
  return out;
}
