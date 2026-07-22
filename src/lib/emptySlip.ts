/**
 * Empty-slip taxonomy — process miss vs honest no-edge.
 *
 * Deep-packs SSOT is `shortlist_with_deep_n` only (count of shortlist rows
 * with a deep pack). Do **not** gate on bare `deep_n` (total packs in health
 * payload can diverge from shortlist coverage).
 *
 * Engine Coverage Health remains law; this helper only classifies for UX copy.
 */
import type { ViewId } from "@/types";

export type EmptySlipKind =
  | "has_picks"
  | "process_miss"
  | "process_miss_soft"
  | "no_research"
  | "honest_no_edge";

export type EmptySlipInput = {
  /** PLACE_THESE has no place rows / NO BETS */
  placeEmpty: boolean;
  /** coverage_health.level */
  level: string;
  /** coverage_health.empty_slip_risk */
  empty_slip_risk: boolean;
  /**
   * coverage_health.shortlist_with_deep_n — SSOT for “deep packs on shortlist”.
   * Missing / non-finite → treat as 0.
   */
  shortlist_with_deep_n: number;
  /** Optional display context only — not the no_research gate */
  shortlist_n?: number;
};

export type EmptySlipCta = {
  label: string;
  view: ViewId;
};

export type EmptySlipResult = {
  kind: EmptySlipKind;
  /** Celebrate empty slip only for honest_no_edge */
  isSuccess: boolean;
  title: string;
  detail: string;
  primaryCta: EmptySlipCta;
  secondaryCta?: EmptySlipCta;
};

function hasDeepPacks(n: number): boolean {
  return Number(n) > 0;
}

function normDeepN(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

function normLevel(level: unknown): string {
  return String(level ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Classify empty-slip UX from place-slip emptiness + Coverage Health fields.
 *
 * Decision table (placeEmpty gate first):
 * | placeEmpty | level / flags              | shortlist_with_deep_n | kind              |
 * |------------|----------------------------|-----------------------|-------------------|
 * | false      | any                        | any                   | has_picks         |
 * | true       | critical OR empty_slip_risk| any                   | process_miss      |
 * | true       | warn                       | any                   | process_miss_soft |
 * | true       | ok (or other non-warn)     | ≤ 0                   | no_research       |
 * | true       | ok                         | ≥ 1                   | honest_no_edge    |
 */
export function classifyEmptySlip(input: EmptySlipInput): EmptySlipResult {
  const placeEmpty = Boolean(input.placeEmpty);
  const level = normLevel(input.level);
  const emptySlipRisk = Boolean(input.empty_slip_risk);
  const deepN = normDeepN(input.shortlist_with_deep_n);

  if (!placeEmpty) {
    return {
      kind: "has_picks",
      isSuccess: false,
      title: "Place slip has picks",
      detail: "Shortlist cards ready — place on NT then place-ack.",
      primaryCta: { label: "Open Shortlist", view: "shortlist" },
    };
  }

  // Critical / empty_slip_risk always process miss — never celebrate empty
  if (level === "critical" || emptySlipRisk) {
    return {
      kind: "process_miss",
      isSuccess: false,
      title: "Process miss — under-researched mid-price",
      detail:
        "Coverage critical or empty-slip risk flag. Expand deep packs on survivable prices before recommend. Do not treat this empty board as discipline.",
      primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
      secondaryCta: { label: "Evidence packs", view: "evidence" },
    };
  }

  if (level === "warn") {
    return {
      kind: "process_miss_soft",
      isSuccess: false,
      title: "Coverage thin — do not treat as success",
      detail:
        "Coverage health is warn. Prefer board + more mid/deep packs over celebrating an empty slip.",
      primaryCta: { label: "Open Ops (Board)", view: "workflow" },
      secondaryCta: { label: "More deep packs", view: "evidence" },
    };
  }

  // Zero shortlist deep packs → no_research (SSOT: shortlist_with_deep_n, not deep_n)
  if (!hasDeepPacks(deepN)) {
    return {
      kind: "no_research",
      isSuccess: false,
      title: "Blocked — zero shortlist deep packs",
      detail:
        "No shortlist rows carry a deep pack (shortlist_with_deep_n = 0). Run research board and deep packs first — bare recommend is a process failure, not a thin board.",
      primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
      secondaryCta: { label: "Evidence packs", view: "evidence" },
    };
  }

  // Honest no-edge only when coverage ok + deep packs present on shortlist
  if (level === "ok") {
    return {
      kind: "honest_no_edge",
      isSuccess: true,
      title: "Empty slip is success — no edge after research",
      detail:
        "Coverage healthy and shortlist deep packs present; recommend found nothing that clears the bar. Wait for the next odds dump.",
      primaryCta: { label: "Next odds", view: "odds" },
      secondaryCta: { label: "Ops / status", view: "workflow" },
    };
  }

  // Unknown level with deep packs — never celebrate
  return {
    kind: "process_miss_soft",
    isSuccess: false,
    title: "Coverage unknown — do not treat empty as success",
    detail:
      "Deep packs exist but coverage level is not ok. Confirm Coverage Health / board before recommending.",
    primaryCta: { label: "Open Ops (Board)", view: "workflow" },
    secondaryCta: { label: "Evidence packs", view: "evidence" },
  };
}

/** Build helper input from place emptiness + raw coverage_health payload. */
export function emptySlipInputFromCoverage(
  placeEmpty: boolean,
  coverage: Record<string, unknown> | null | undefined
): EmptySlipInput {
  const c = coverage || {};
  return {
    placeEmpty,
    level: String(c.level ?? ""),
    empty_slip_risk: Boolean(c.empty_slip_risk),
    shortlist_with_deep_n: normDeepN(c.shortlist_with_deep_n),
    shortlist_n:
      c.shortlist_n != null && Number.isFinite(Number(c.shortlist_n))
        ? Number(c.shortlist_n)
        : undefined,
  };
}
