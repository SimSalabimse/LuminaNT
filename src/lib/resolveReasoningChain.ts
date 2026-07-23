/**
 * Resolve engine ReasoningChain rows from snapshot.reasoning_chains.
 * Join by bet_id first, else match + selection + day.
 * Never invent chain content when SSOT is missing.
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

function norm(s: string | null | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normDay(s: string | null | undefined): string {
  const t = String(s || "").trim();
  if (!t) return "";
  // Accept ISO date prefix or plain YYYY-MM-DD
  const m = t.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : t.slice(0, 10);
}

/**
 * Map engine traffic_light / decision tokens → Simple Mode light.
 * Unknown / missing → gray.
 */
export function trafficLightFromChain(
  chain: ReasoningChain | null | undefined
): TrafficLight {
  if (!chain) return "gray";
  const raw = String(
    chain.traffic_light || chain.decision || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (
    !raw ||
    raw === "unknown" ||
    raw === "none" ||
    raw === "pending" ||
    raw === "gray" ||
    raw === "grey" ||
    raw === "neutral"
  ) {
    // Fall through to kind-based hint
  } else if (
    raw === "green" ||
    raw === "go" ||
    raw === "ok" ||
    raw === "pass" ||
    raw === "recommended" ||
    raw === "place" ||
    raw === "placed" ||
    raw === "accept"
  ) {
    return "green";
  } else if (
    raw === "amber" ||
    raw === "yellow" ||
    raw === "caution" ||
    raw === "warn" ||
    raw === "warning" ||
    raw === "nearmiss" ||
    raw === "borderline"
  ) {
    return "amber";
  } else if (
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

  const kind = String(chain.kind || "")
    .trim()
    .toLowerCase();
  if (kind === "near_miss" || kind.startsWith("near_miss")) return "amber";
  if (kind.startsWith("rejected") || kind === "reject") return "red";
  if (
    kind === "recommended" ||
    kind === "placed" ||
    kind === "place" ||
    kind === "accepted"
  ) {
    return "green";
  }

  // Light from traffic_light aliases already handled; residual gray
  if (raw === "green" || raw === "amber" || raw === "red") {
    return raw as TrafficLight;
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

/** Tailwind-ish class tokens for light indicator. */
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

/**
 * One-sentence Simple Mode summary — engine summary preferred; never invent EV math.
 */
export function simpleModeSummary(
  chain: ReasoningChain | null | undefined
): string {
  if (!chain) return "No reasoning chain on disk for this line.";
  const s = String(chain.summary || "").trim();
  if (s) return s;
  const decision = String(chain.decision || "").trim();
  const kind = String(chain.kind || "").trim();
  if (decision && kind) return `${decision} · ${kind}`;
  if (decision) return decision;
  if (kind) return kind.replace(/_/g, " ");
  return "Chain present — expand for detail.";
}

export function whyThisText(chain: ReasoningChain | null | undefined): string {
  if (!chain) return "";
  return String(chain.why_this || chain.why || "").trim();
}

export function whyNotText(chain: ReasoningChain | null | undefined): string {
  if (!chain) return "";
  return String(chain.why_not_this || chain.why_not || "").trim();
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
    // Newest last wins — reverse scan
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
    // Require at least match+selection alignment when no bet_id
    if (s >= 80 && s > bestScore) {
      best = c;
      bestScore = s;
    } else if (!qBet && qMatch && qSel && s >= 80 && s >= bestScore) {
      best = c;
      bestScore = s;
    }
  }
  // Soften: match+selection only (no day) still valid when day missing on either side
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
