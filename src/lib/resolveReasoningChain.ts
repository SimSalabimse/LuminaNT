/**
 * Resolve engine ReasoningChain rows from snapshot.reasoning_chains.
 * Join by reasoning_chain_id → bet_id → match+selection(+day) → soft exact match+selection.
 * Pure readers for engine wire aliases — never mutate kind, never invent EV/p_model.
 *
 * Resolve fallthrough (EXISTING control flow — do not rewrite unless fixture fails):
 * 1. reasoning_chain_id exact
 * 2. bet_id reverse-scan (newest last) — miss continues (does not return null)
 * 3. score match+selection+day (s >= 80, not gated on !qBet)
 * 4. soft exact norm(match)+norm(selection) when !best — not gated on !qBet
 */
import type { ReasoningChain } from "@/types";

export type TrafficLight = "green" | "amber" | "red" | "gray";

export type ResolveReasoningQuery = {
  betId?: string | null;
  match?: string | null;
  selection?: string | null;
  day?: string | null;
  reasoningChainId?: string | null;
};

export type ChainMissingField = "p_model" | "ev" | "stake";

export type GradeTone = {
  tone: "ok" | "primary" | "warn" | "loss" | "neutral";
  text: string;
  border: string;
  bg: string;
};

function norm(s: string | null | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normDay(s: string | null | undefined): string {
  const t = String(s || "").trim();
  if (!t) return "";
  const m = t.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : t.slice(0, 10);
}

function finiteNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Recommended / go-path kinds — includes live engine `pick`. Never mutates chain.kind. */
export function isRecommendedKind(kind: string | null | undefined): boolean {
  const k = String(kind || "").trim().toLowerCase();
  return (
    k === "pick" ||
    k === "recommended" ||
    k === "placed" ||
    k === "place" ||
    k === "accepted"
  );
}

/**
 * Post-haircut EV from engine SSOT only.
 * Reads haircut_ev OR ev_after_haircut — never invents, never re-labels raw ev.
 */
export function haircutEvOf(
  chain: ReasoningChain | null | undefined
): number | null {
  if (!chain) return null;
  const h =
    finiteNum(chain.haircut_ev) ??
    finiteNum((chain as { ev_after_haircut?: unknown }).ev_after_haircut);
  return h;
}

/**
 * Unit size in NOK from controls / chain aliases.
 * Does not invent; stake is separate (stake_nok).
 */
export function unitNokOf(
  chain: ReasoningChain | null | undefined
): number | null {
  if (!chain) return null;
  const controls = chain.controls as
    | { unit_nok?: unknown; active_unit_nok?: unknown; unit?: unknown }
    | null
    | undefined;
  return (
    finiteNum(controls?.unit_nok) ??
    finiteNum(controls?.active_unit_nok) ??
    finiteNum(controls?.unit) ??
    finiteNum((chain as { unit_nok?: unknown }).unit_nok) ??
    finiteNum((chain as { active_unit_nok?: unknown }).active_unit_nok) ??
    finiteNum((chain as { unit?: unknown }).unit)
  );
}

/** Stake NOK from chain (stake_nok preferred). */
export function stakeNokOf(
  chain: ReasoningChain | null | undefined
): number | null {
  if (!chain) return null;
  return (
    finiteNum(chain.stake_nok) ??
    finiteNum((chain as { stake?: unknown }).stake)
  );
}

/**
 * Shared grade color tokens — single source for SimpleMode + gateChips.
 */
export function gradeTone(grade: string | null | undefined): GradeTone {
  const g = String(grade || "")
    .trim()
    .toUpperCase();
  if (g === "A") {
    return {
      tone: "ok",
      text: "text-profit",
      border: "border-profit/30",
      bg: "bg-profit/12",
    };
  }
  if (g === "B") {
    return {
      tone: "primary",
      text: "text-primary",
      border: "border-primary/30",
      bg: "bg-primary/12",
    };
  }
  if (g === "C") {
    return {
      tone: "warn",
      text: "text-pending",
      border: "border-pending/30",
      bg: "bg-pending/12",
    };
  }
  if (g) {
    return {
      tone: "loss",
      text: "text-loss",
      border: "border-loss/30",
      bg: "bg-loss/12",
    };
  }
  return {
    tone: "neutral",
    text: "text-muted-foreground",
    border: "border-white/12",
    bg: "bg-white/[0.03]",
  };
}

/** EV display tone classes. */
export function evTone(ev: number | null | undefined): string {
  if (ev == null || !Number.isFinite(Number(ev))) return "text-muted-foreground";
  const n = Number(ev);
  if (n > 0) return "text-profit";
  if (n < 0) return "text-loss";
  return "text-muted-foreground";
}

/**
 * Map chain → Simple Mode traffic light.
 * Kind-primary for near_miss / rejected / pick.
 * Never maps light.verdict alone to Go (near_miss often has verdict:pass).
 */
export function trafficLightFromChain(
  chain: ReasoningChain | null | undefined
): TrafficLight {
  if (!chain) return "gray";

  const kind = String(chain.kind || "")
    .trim()
    .toLowerCase();

  // Kind wins for near_miss / rejected (anti false-green from decision/pass)
  if (kind === "near_miss" || kind.startsWith("near_miss")) return "amber";
  if (kind.startsWith("rejected") || kind === "reject") return "red";

  // Recommended-path kinds including live engine pick → green
  if (isRecommendedKind(kind)) return "green";

  // Explicit traffic_light / decision only — never light.verdict
  const raw = String(chain.traffic_light || chain.decision || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (
    raw &&
    raw !== "unknown" &&
    raw !== "none" &&
    raw !== "pending" &&
    raw !== "gray" &&
    raw !== "grey" &&
    raw !== "neutral"
  ) {
    if (
      raw === "green" ||
      raw === "go" ||
      raw === "ok" ||
      raw === "recommended" ||
      raw === "place" ||
      raw === "placed" ||
      raw === "accept" ||
      raw === "accepted"
    ) {
      return "green";
    }
    if (
      raw === "amber" ||
      raw === "yellow" ||
      raw === "caution" ||
      raw === "warn" ||
      raw === "warning" ||
      raw === "nearmiss" ||
      raw === "borderline" ||
      raw === "hold"
    ) {
      return "amber";
    }
    if (
      raw === "red" ||
      raw === "stop" ||
      raw === "block" ||
      raw === "blocked" ||
      raw === "reject" ||
      raw === "rejected" ||
      raw === "fail" ||
      raw === "no"
    ) {
      return "red";
    }
    // Note: bare "pass" on decision without recommended kind is NOT green —
    // light.verdict:pass is common on near_miss; decision alone is weak.
  }

  return "gray";
}

/** Human label for traffic light chip. */
export function trafficLightLabel(light: TrafficLight): string {
  if (light === "green") return "Go";
  if (light === "amber") return "Caution";
  if (light === "red") return "No-go";
  return "Unknown";
}

/** Tailwind-ish class tokens for light indicator (design-system tokens). */
export function trafficLightTone(light: TrafficLight): {
  dot: string;
  text: string;
  border: string;
  bg: string;
} {
  if (light === "green") {
    return {
      dot: "bg-profit",
      text: "text-profit",
      border: "border-profit/35",
      bg: "bg-profit/10",
    };
  }
  if (light === "amber") {
    return {
      dot: "bg-pending",
      text: "text-pending",
      border: "border-pending/35",
      bg: "bg-pending/10",
    };
  }
  if (light === "red") {
    return {
      dot: "bg-loss",
      text: "text-loss",
      border: "border-loss/35",
      bg: "bg-loss/10",
    };
  }
  return {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    border: "border-white/12",
    bg: "bg-white/[0.03]",
  };
}

function reasonsList(chain: ReasoningChain): string[] {
  const r = chain.reasons;
  if (!Array.isArray(r)) return [];
  return r
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function lightReasonText(chain: ReasoningChain): string {
  const light = chain.light;
  if (light == null) return "";
  if (typeof light === "string") return light.trim();
  if (typeof light === "object") {
    const reason = (light as { reason?: unknown }).reason;
    if (reason != null && String(reason).trim()) return String(reason).trim();
  }
  return "";
}

function humanizedKindLabel(kind: string): string {
  const k = kind.trim().toLowerCase();
  if (isRecommendedKind(k)) return "Recommended";
  if (k === "near_miss" || k.startsWith("near_miss")) return "Near-miss";
  if (k.startsWith("rejected") || k === "reject") return "Rejected";
  if (!k) return "Chain";
  return kind.replace(/_/g, " ");
}

/**
 * One-sentence Simple Mode summary.
 * Prefer summary → why → reasons → reject_reason (nm/rej) → notes snippet →
 * humanized kind + match + selection. Never bare "pick" / "UNKNOWN".
 */
export function simpleModeSummary(
  chain: ReasoningChain | null | undefined
): string {
  if (!chain) return "No reasoning chain on disk for this line.";

  const summary = String(chain.summary || "").trim();
  if (summary) return summary;

  const why = String(chain.why_this || chain.why || "").trim();
  if (why) return why;

  const reasons = reasonsList(chain);
  if (reasons.length > 0) {
    return reasons.slice(0, 2).join(" · ");
  }

  const kind = String(chain.kind || "").trim().toLowerCase();
  const isNmOrRej =
    kind === "near_miss" ||
    kind.startsWith("near_miss") ||
    kind.startsWith("rejected") ||
    kind === "reject";
  if (isNmOrRej) {
    const rr = String(chain.reject_reason || "").trim();
    if (rr) return rr;
  }

  const notes = String(chain.notes || "").trim();
  if (notes) {
    return notes.length > 140 ? `${notes.slice(0, 140).trimEnd()}…` : notes;
  }

  const lightR = lightReasonText(chain);
  if (lightR) {
    return lightR.length > 140 ? `${lightR.slice(0, 140).trimEnd()}…` : lightR;
  }

  const parts = [
    humanizedKindLabel(String(chain.kind || "")),
    chain.match ? String(chain.match).trim() : "",
    chain.selection ? String(chain.selection).trim() : "",
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");

  return "Chain present — expand for detail.";
}

/** Why this — why_this/why → reasons → light.reason. */
export function whyThisText(chain: ReasoningChain | null | undefined): string {
  if (!chain) return "";
  const direct = String(chain.why_this || chain.why || "").trim();
  if (direct) return direct;
  const reasons = reasonsList(chain);
  if (reasons.length > 0) return reasons.join(" · ");
  return lightReasonText(chain);
}

/**
 * Why not — why_not* → reject_reason for near_miss/reject.
 * Empty is OK for picks (not Partial).
 */
export function whyNotText(chain: ReasoningChain | null | undefined): string {
  if (!chain) return "";
  const direct = String(chain.why_not_this || chain.why_not || "").trim();
  if (direct) return direct;
  const kind = String(chain.kind || "").trim().toLowerCase();
  const isNmOrRej =
    kind === "near_miss" ||
    kind.startsWith("near_miss") ||
    kind.startsWith("rejected") ||
    kind === "reject";
  if (isNmOrRej) {
    return String(chain.reject_reason || "").trim();
  }
  return "";
}

/**
 * Partial only for missing numeric SSOT on recommended-path kinds.
 * Missing summary / why / sources → NOT partial (use copy fallbacks).
 * near_miss / rejected → full (no banner; often lack stake/p_model by design).
 */
export function chainCompleteness(chain: ReasoningChain | null | undefined): {
  status: "full" | "partial" | "absent";
  missing: ChainMissingField[];
  banner: string | null;
} {
  if (!chain) return { status: "absent", missing: [], banner: null };

  if (!isRecommendedKind(chain.kind)) {
    return { status: "full", missing: [], banner: null };
  }

  const missing: ChainMissingField[] = [];
  if (finiteNum(chain.p_model) == null) {
    missing.push("p_model");
  }
  // Need at least one EV signal: haircut EV preferred, else raw model EV
  if (haircutEvOf(chain) == null && finiteNum(chain.ev) == null) {
    missing.push("ev");
  }
  if (stakeNokOf(chain) == null) {
    missing.push("stake");
  }

  if (missing.length === 0) {
    return { status: "full", missing: [], banner: null };
  }
  return {
    status: "partial",
    missing,
    banner: `Partial chain – missing ${missing.join(", ")}`,
  };
}

function scoreMatch(
  chain: ReasoningChain,
  q: ResolveReasoningQuery
): number {
  let score = 0;
  const qBet = String(q.betId || "").trim();
  const cBet = String(chain.bet_id || "").trim();
  if (qBet && cBet && qBet === cBet) score += 100;

  const qRc = String(q.reasoningChainId || "").trim();
  const cRc = String(chain.reasoning_chain_id || "").trim();
  if (qRc && cRc && qRc === cRc) score += 120;

  const qMatch = norm(q.match);
  const cMatch = norm(chain.match);
  const qSel = norm(q.selection);
  const cSel = norm(chain.selection);
  if (qMatch && cMatch && qMatch === cMatch) score += 40;
  if (qSel && cSel && qSel === cSel) score += 40;

  const qDay = normDay(q.day);
  const cDay = normDay(chain.day);
  if (qDay && cDay && qDay === cDay) score += 20;
  else if (qDay && cDay && qDay !== cDay) score -= 10;

  return score;
}

/**
 * Resolve best chain for a bet / shortlist line.
 * Prefer bet_id (or reasoning_chain_id); else match+selection(+day).
 * bet_id miss does NOT short-circuit — falls through to match+selection.
 */
export function resolveReasoningChain(
  chains: ReasoningChain[] | null | undefined,
  query: ResolveReasoningQuery
): ReasoningChain | null {
  if (!chains?.length) return null;
  const qBet = String(query.betId || "").trim();
  const qRc = String(query.reasoningChainId || "").trim();

  if (qRc) {
    const byId = chains.find(
      (c) => String(c.reasoning_chain_id || "").trim() === qRc
    );
    if (byId) return byId;
  }
  if (qBet) {
    // Newest last wins — reverse scan; miss continues to match+selection
    for (let i = chains.length - 1; i >= 0; i--) {
      const c = chains[i];
      if (String(c.bet_id || "").trim() === qBet) return c;
    }
  }

  const qMatch = norm(query.match);
  const qSel = norm(query.selection);
  if (!qMatch && !qSel) return null;

  let best: ReasoningChain | null = null;
  let bestScore = 0;
  for (const c of chains) {
    const s = scoreMatch(c, query);
    // Require at least match+selection alignment (s >= 80); not gated on !qBet
    if (s >= 80 && s > bestScore) {
      best = c;
      bestScore = s;
    } else if (!qBet && qMatch && qSel && s >= 80 && s >= bestScore) {
      best = c;
      bestScore = s;
    }
  }
  // Soften: exact match+selection when day missing on either side (not gated on !qBet)
  if (!best && qMatch && qSel) {
    for (let i = chains.length - 1; i >= 0; i--) {
      const c = chains[i];
      if (norm(c.match) === qMatch && norm(c.selection) === qSel) return c;
    }
  }
  return best;
}

/** True when chain kind is near-miss or rejected_* (board near-miss list). */
export function isNearMissOrRejected(
  chain: ReasoningChain | null | undefined
): boolean {
  if (!chain) return false;
  const kind = String(chain.kind || "")
    .trim()
    .toLowerCase();
  if (!kind) return false;
  if (kind === "near_miss" || kind.startsWith("near_miss")) return true;
  if (kind.startsWith("rejected") || kind === "reject") return true;
  return false;
}

/**
 * Collapsible near-miss / rejected list — engine chains only.
 * Sorted: near_miss first, then rejected_*, stable by match.
 * Does not list pick (kind is never rewritten).
 */
export function listNearMissChains(
  chains: ReasoningChain[] | null | undefined
): ReasoningChain[] {
  if (!chains?.length) return [];
  const rows = chains.filter(isNearMissOrRejected);
  const rank = (c: ReasoningChain) => {
    const k = String(c.kind || "")
      .trim()
      .toLowerCase();
    if (k === "near_miss" || k.startsWith("near_miss")) return 0;
    return 1;
  };
  return [...rows].sort((a, b) => {
    const dr = rank(a) - rank(b);
    if (dr !== 0) return dr;
    return norm(a.match).localeCompare(norm(b.match));
  });
}
