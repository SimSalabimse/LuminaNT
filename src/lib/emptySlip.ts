/**
 * Empty-slip taxonomy — process miss vs honest no-edge.
 *
 * Deep-packs SSOT is `shortlist_with_deep_n` only (count of shortlist rows
 * with a deep pack). Do **not** gate on bare `deep_n` (total packs in health
 * payload can diverge from shortlist coverage).
 *
 * Engine Coverage Health remains law; this helper only classifies for UX copy.
 *
 * Follow-up (loader): `coverage_health` is typed on `TrackerSnapshot` but the
 * Tauri snapshot path is not wired yet (`data/state/coverage_health.json`).
 * Until `load_snapshot` reads that file, live desks get `coverage_unavailable`
 * fail-closed copy rather than claiming measured zero packs. Demo/tests may
 * inject `snapshot.coverage_health` directly.
 */
import type { CoverageHealth, ViewId } from "@/types";

export type EmptySlipKind =
  | "has_picks"
  | "process_miss"
  | "process_miss_soft"
  | "no_research"
  | "coverage_unavailable"
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
   * Missing / non-finite → treat as 0 for the numeric gate.
   */
  shortlist_with_deep_n: number;
  /** Display context — shortlist size when present */
  shortlist_n?: number;
  /**
   * True when a real coverage_health payload is present (has level /
   * shortlist_with_deep_n / flags). False when snapshot field is null,
   * undefined, or empty `{}` from an unwired loader.
   */
  coverageLoaded: boolean;
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

function countSuffix(input: EmptySlipInput): string {
  const parts: string[] = [];
  if (input.coverageLoaded) {
    parts.push(`shortlist_with_deep_n=${input.shortlist_with_deep_n}`);
    if (input.shortlist_n != null) {
      parts.push(`shortlist_n=${input.shortlist_n}`);
    }
  }
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/**
 * Classify empty-slip UX from place-slip emptiness + Coverage Health fields.
 *
 * Decision table (placeEmpty gate first):
 * | placeEmpty | level / flags                         | shortlist_with_deep_n | kind                  |
 * |------------|---------------------------------------|-----------------------|-----------------------|
 * | false      | any                                   | any                   | has_picks             |
 * | true       | critical OR empty_slip_risk           | any                   | process_miss          |
 * | true       | warn                                  | any                   | process_miss_soft     |
 * | true       | coverage not loaded                   | any                   | coverage_unavailable  |
 * | true       | ok (or other non-warn/critical)       | ≤ 0                   | no_research           |
 * | true       | ok                                    | ≥ 1                   | honest_no_edge        |
 * | true       | non-ok / unknown (not warn/critical)  | ≥ 1                   | process_miss_soft     |
 */
export function classifyEmptySlip(input: EmptySlipInput): EmptySlipResult {
  const placeEmpty = Boolean(input.placeEmpty);
  const level = normLevel(input.level);
  const emptySlipRisk = Boolean(input.empty_slip_risk);
  const deepN = normDeepN(input.shortlist_with_deep_n);
  const counts = countSuffix(input);

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
      detail: `Coverage critical or empty-slip risk flag. Expand deep packs on survivable prices before recommend. Do not treat this empty board as discipline.${counts}`,
      primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
      secondaryCta: { label: "Evidence packs", view: "evidence" },
    };
  }

  if (level === "warn") {
    return {
      kind: "process_miss_soft",
      isSuccess: false,
      title: "Coverage thin — do not treat as success",
      detail: `Coverage health is warn. Prefer board + more mid/deep packs over celebrating an empty slip.${counts}`,
      primaryCta: { label: "Open Ops (Board)", view: "workflow" },
      secondaryCta: { label: "More deep packs", view: "evidence" },
    };
  }

  // Missing / empty coverage payload — fail closed without claiming measured zero
  if (!input.coverageLoaded) {
    return {
      kind: "coverage_unavailable",
      isSuccess: false,
      title: "Coverage Health not loaded",
      detail:
        "No Coverage Health signal on this snapshot (file not loaded yet or empty). Fail-closed: do not treat empty as success. Run research board / refresh once coverage_health.json is wired into the loader.",
      primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
      secondaryCta: { label: "Evidence packs", view: "evidence" },
    };
  }

  // Zero shortlist deep packs → no_research (SSOT: shortlist_with_deep_n, not deep_n)
  if (!hasDeepPacks(deepN)) {
    return {
      kind: "no_research",
      isSuccess: false,
      title: "Blocked — zero shortlist deep packs",
      detail: `No shortlist rows carry a deep pack${counts || " (shortlist_with_deep_n = 0)"}. Run research board and deep packs first — bare recommend is a process failure, not a thin board.`,
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
      detail: `Coverage healthy and shortlist deep packs present${counts}; recommend found nothing that clears the bar. Wait for the next odds dump.`,
      primaryCta: { label: "Next odds", view: "odds" },
      secondaryCta: { label: "Ops / status", view: "workflow" },
    };
  }

  // Unknown / non-ok level with deep packs — never celebrate
  return {
    kind: "process_miss_soft",
    isSuccess: false,
    title: "Coverage unknown — do not treat empty as success",
    detail: `Deep packs exist but coverage level is not ok. Confirm Coverage Health / board before recommending.${counts}`,
    primaryCta: { label: "Open Ops (Board)", view: "workflow" },
    secondaryCta: { label: "Evidence packs", view: "evidence" },
  };
}

/** True when payload carries a real Coverage Health signal (not null / {}). */
export function isCoverageHealthLoaded(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): boolean {
  if (coverage == null || typeof coverage !== "object") return false;
  const c = coverage as Record<string, unknown>;
  return (
    c.level != null ||
    c.shortlist_with_deep_n != null ||
    c.empty_slip_risk != null ||
    c.updated_at != null ||
    c.source != null ||
    c.shortlist_n != null
  );
}

/** Build helper input from place emptiness + raw coverage_health payload. */
export function emptySlipInputFromCoverage(
  placeEmpty: boolean,
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): EmptySlipInput {
  const loaded = isCoverageHealthLoaded(coverage);
  const c = (coverage || {}) as Record<string, unknown>;
  return {
    placeEmpty,
    level: String(c.level ?? ""),
    empty_slip_risk: Boolean(c.empty_slip_risk),
    shortlist_with_deep_n: normDeepN(c.shortlist_with_deep_n),
    shortlist_n:
      c.shortlist_n != null && Number.isFinite(Number(c.shortlist_n))
        ? Number(c.shortlist_n)
        : undefined,
    coverageLoaded: loaded,
  };
}
