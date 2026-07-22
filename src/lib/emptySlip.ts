/**
 * Empty-slip taxonomy — process miss vs honest no-edge.
 *
 * Deep-packs SSOT is `shortlist_with_deep_n` only (count of shortlist rows
 * with a deep pack). Do **not** gate on bare `deep_n` (total packs in health
 * payload can diverge from shortlist coverage).
 *
 * Engine Coverage Health remains law; this helper only classifies for UX copy.
 * When `starvation_kind` is present (HV v3), map engine kinds only — never
 * invent bankroll / clearability math client-side.
 *
 * Loader: Tauri `load_snapshot` reads `data/state/coverage_health.json` into
 * `snapshot.coverage_health`. Missing/empty payload → `coverage_unavailable`
 * fail-closed (do not claim measured zero packs).
 */
import type { CoverageHealth, ViewId } from "@/types";

/** Engine starvation_kind SSOT (coverage_health / recommend JSON). */
export type StarvationKind =
  | "none"
  | "research_starvation"
  | "clearability_miss"
  | "honest_no_edge"
  | "coverage_critical"
  | "risk_block"
  | string;

export type EmptySlipKind =
  | "has_picks"
  | "process_miss"
  | "process_miss_soft"
  | "clearability_miss"
  | "no_research"
  | "coverage_unavailable"
  | "risk_block"
  | "honest_no_edge";

/** Funnel KPIs from engine coverage_health / funnel block (display only). */
export type EmptySlipFunnel = {
  n_raw_ev_pass?: number;
  median_raw_ev?: number | null;
  clearable_track_share?: number | null;
  second_pass_ran?: boolean;
  second_pass_completed?: boolean;
  n_packs_with_p?: number;
};

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
  /**
   * Engine `starvation_kind` when present. Prefer over level heuristics.
   * Empty / missing → fall back to coverage level + deep packs table.
   */
  starvation_kind?: StarvationKind | null;
  /** Optional funnel metrics (passed through for detail copy / UI). */
  funnel?: EmptySlipFunnel;
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
  /** Echo of engine starvation_kind when used */
  starvation_kind?: StarvationKind | null;
  funnel?: EmptySlipFunnel;
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

function normStarvationKind(raw: unknown): string {
  return String(raw ?? "")
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
  const sk = normStarvationKind(input.starvation_kind);
  if (sk) parts.push(`starvation_kind=${sk}`);
  const f = input.funnel;
  if (f?.n_raw_ev_pass != null && Number.isFinite(Number(f.n_raw_ev_pass))) {
    parts.push(`n_raw_ev_pass=${Number(f.n_raw_ev_pass)}`);
  }
  if (f?.second_pass_ran != null) {
    parts.push(`second_pass_ran=${Boolean(f.second_pass_ran)}`);
  }
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function withMeta(
  result: EmptySlipResult,
  input: EmptySlipInput
): EmptySlipResult {
  const sk = normStarvationKind(input.starvation_kind);
  return {
    ...result,
    starvation_kind: sk || input.starvation_kind || null,
    funnel: input.funnel,
  };
}

/**
 * Map engine starvation_kind → empty-slip UX (HV v3).
 * Returns null when kind is absent / unknown so caller can fall back.
 */
export function mapStarvationKind(
  kind: unknown,
  input: EmptySlipInput
): EmptySlipResult | null {
  const sk = normStarvationKind(kind);
  if (!sk || sk === "none") return null;

  const counts = countSuffix(input);

  switch (sk) {
    case "coverage_critical":
      return withMeta(
        {
          kind: "process_miss",
          isSuccess: false,
          title: "Process miss — under-researched mid-price",
          detail: `Engine starvation_kind=coverage_critical. Expand deep packs on survivable prices before recommend. Do not treat this empty board as discipline.${counts}`,
          primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
          secondaryCta: { label: "Evidence packs", view: "evidence" },
        },
        input
      );

    case "research_starvation":
      return withMeta(
        {
          kind: "no_research",
          isSuccess: false,
          title: "Research starvation — mid unresearched",
          detail: `Engine starvation_kind=research_starvation. Mid-band lines lack deep packs. Run board + deep research before treating empty as success.${counts}`,
          primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
          secondaryCta: { label: "Evidence packs", view: "evidence" },
        },
        input
      );

    case "clearability_miss":
      // Process miss: deep packs present but nothing clears raw EV bar;
      // second-pass / alt expansion still needed — never celebrate.
      return withMeta(
        {
          kind: "clearability_miss",
          isSuccess: false,
          title: "Clearability miss — second-pass needed",
          detail: `Engine starvation_kind=clearability_miss. Deep packs present and mid covered, but zero raw-EV clears. Run second-pass / deep-queue inject before celebrating empty.${counts}`,
          primaryCta: { label: "Open Shortlist / deep queue", view: "shortlist" },
          secondaryCta: { label: "Ops (Board / second-pass)", view: "workflow" },
        },
        input
      );

    case "honest_no_edge":
      return withMeta(
        {
          kind: "honest_no_edge",
          isSuccess: true,
          title: "Empty slip is success — no edge after research",
          detail: `Engine starvation_kind=honest_no_edge. Place-capable path completed (incl. second-pass when required) and nothing cleared the bar. Wait for the next odds dump.${counts}`,
          primaryCta: { label: "Next odds", view: "odds" },
          secondaryCta: { label: "Ops / status", view: "workflow" },
        },
        input
      );

    case "risk_block":
      return withMeta(
        {
          kind: "risk_block",
          isSuccess: false,
          title: "Risk blocked — empty is not discipline",
          detail: `Engine starvation_kind=risk_block. can_bet is false (room / stop / freeze). Resolve risk gates before treating empty as research success.${counts}`,
          primaryCta: { label: "Open Capital plan", view: "capital" },
          secondaryCta: { label: "Ops / status", view: "workflow" },
        },
        input
      );

    default:
      return null;
  }
}

/**
 * Classify empty-slip UX from place-slip emptiness + Coverage Health fields.
 *
 * Prefer engine `starvation_kind` when present (HV v3). Fallback decision table
 * (placeEmpty gate first) when kind missing:
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
    return withMeta(
      {
        kind: "has_picks",
        isSuccess: false,
        title: "Place slip has picks",
        detail: "Shortlist cards ready — place on NT then place-ack.",
        primaryCta: { label: "Open Shortlist", view: "shortlist" },
      },
      input
    );
  }

  // Engine starvation_kind is SSOT when present (including clearability_miss).
  const mapped = mapStarvationKind(input.starvation_kind, input);
  if (mapped) return mapped;

  // Critical / empty_slip_risk always process miss — never celebrate empty
  if (level === "critical" || emptySlipRisk) {
    return withMeta(
      {
        kind: "process_miss",
        isSuccess: false,
        title: "Process miss — under-researched mid-price",
        detail: `Coverage critical or empty-slip risk flag. Expand deep packs on survivable prices before recommend. Do not treat this empty board as discipline.${counts}`,
        primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
        secondaryCta: { label: "Evidence packs", view: "evidence" },
      },
      input
    );
  }

  if (level === "warn") {
    return withMeta(
      {
        kind: "process_miss_soft",
        isSuccess: false,
        title: "Coverage thin — do not treat as success",
        detail: `Coverage health is warn. Prefer board + more mid/deep packs over celebrating an empty slip.${counts}`,
        primaryCta: { label: "Open Ops (Board)", view: "workflow" },
        secondaryCta: { label: "More deep packs", view: "evidence" },
      },
      input
    );
  }

  // Missing / empty coverage payload — fail closed without claiming measured zero
  if (!input.coverageLoaded) {
    return withMeta(
      {
        kind: "coverage_unavailable",
        isSuccess: false,
        title: "Coverage Health not loaded",
        detail:
          "No Coverage Health signal on this snapshot (file not loaded yet or empty). Fail-closed: do not treat empty as success. Run research board / refresh once coverage_health.json is wired into the loader.",
        primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
        secondaryCta: { label: "Evidence packs", view: "evidence" },
      },
      input
    );
  }

  // Zero shortlist deep packs → no_research (SSOT: shortlist_with_deep_n, not deep_n)
  if (!hasDeepPacks(deepN)) {
    return withMeta(
      {
        kind: "no_research",
        isSuccess: false,
        title: "Blocked — zero shortlist deep packs",
        detail: `No shortlist rows carry a deep pack${counts || " (shortlist_with_deep_n = 0)"}. Run research board and deep packs first — bare recommend is a process failure, not a thin board.`,
        primaryCta: { label: "Open Ops (Board first)", view: "workflow" },
        secondaryCta: { label: "Evidence packs", view: "evidence" },
      },
      input
    );
  }

  // Honest no-edge only when coverage ok + deep packs present on shortlist
  // (fallback path — prefer engine starvation_kind=honest_no_edge when available)
  if (level === "ok") {
    // If funnel says second pass did not complete and zero raw EV passes, soft-miss
    // rather than celebrate (fail-closed without inventing kind).
    const f = input.funnel;
    const nPass =
      f?.n_raw_ev_pass != null && Number.isFinite(Number(f.n_raw_ev_pass))
        ? Number(f.n_raw_ev_pass)
        : null;
    const spDone =
      f?.second_pass_completed === true ||
      (f?.second_pass_ran === true && f?.second_pass_completed !== false);
    if (nPass === 0 && f && f.second_pass_completed === false) {
      return withMeta(
        {
          kind: "clearability_miss",
          isSuccess: false,
          title: "Clearability miss — second-pass needed",
          detail: `Deep packs present but n_raw_ev_pass=0 and second_pass not completed. Run second-pass / deep-queue inject before celebrating empty.${counts}`,
          primaryCta: {
            label: "Open Shortlist / deep queue",
            view: "shortlist",
          },
          secondaryCta: {
            label: "Ops (Board / second-pass)",
            view: "workflow",
          },
        },
        input
      );
    }
    // Avoid unused warning: spDone used only for future tight gates
    void spDone;

    return withMeta(
      {
        kind: "honest_no_edge",
        isSuccess: true,
        title: "Empty slip is success — no edge after research",
        detail: `Coverage healthy and shortlist deep packs present${counts}; recommend found nothing that clears the bar. Wait for the next odds dump.`,
        primaryCta: { label: "Next odds", view: "odds" },
        secondaryCta: { label: "Ops / status", view: "workflow" },
      },
      input
    );
  }

  // Unknown / non-ok level with deep packs — never celebrate
  return withMeta(
    {
      kind: "process_miss_soft",
      isSuccess: false,
      title: "Coverage unknown — do not treat empty as success",
      detail: `Deep packs exist but coverage level is not ok. Confirm Coverage Health / board before recommending.${counts}`,
      primaryCta: { label: "Open Ops (Board)", view: "workflow" },
      secondaryCta: { label: "Evidence packs", view: "evidence" },
    },
    input
  );
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
    c.shortlist_n != null ||
    c.starvation_kind != null ||
    c.n_raw_ev_pass != null
  );
}

/** Pull funnel KPIs from top-level or nested funnel/clearability blocks. */
export function funnelFromCoverage(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): EmptySlipFunnel | undefined {
  if (coverage == null || typeof coverage !== "object") return undefined;
  const c = coverage as Record<string, unknown>;
  const nested =
    (c.funnel != null && typeof c.funnel === "object"
      ? (c.funnel as Record<string, unknown>)
      : null) ||
    (c.clearability != null && typeof c.clearability === "object"
      ? (c.clearability as Record<string, unknown>)
      : null) ||
    {};

  const pickNum = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = c[k] ?? nested[k];
      if (v != null && Number.isFinite(Number(v))) return Number(v);
    }
    return undefined;
  };
  const pickBool = (...keys: string[]): boolean | undefined => {
    for (const k of keys) {
      const v = c[k] ?? nested[k];
      if (typeof v === "boolean") return v;
    }
    return undefined;
  };

  const funnel: EmptySlipFunnel = {
    n_raw_ev_pass: pickNum("n_raw_ev_pass"),
    median_raw_ev: (() => {
      const v = c.median_raw_ev ?? nested.median_raw_ev;
      if (v == null) return undefined;
      if (Number.isFinite(Number(v))) return Number(v);
      return null;
    })(),
    clearable_track_share: (() => {
      const v = c.clearable_track_share ?? nested.clearable_track_share;
      if (v == null) return undefined;
      if (Number.isFinite(Number(v))) return Number(v);
      return null;
    })(),
    second_pass_ran: pickBool("second_pass_ran"),
    second_pass_completed: pickBool("second_pass_completed"),
    n_packs_with_p: pickNum("n_packs_with_p"),
  };

  const hasAny =
    funnel.n_raw_ev_pass != null ||
    funnel.median_raw_ev != null ||
    funnel.clearable_track_share != null ||
    funnel.second_pass_ran != null ||
    funnel.second_pass_completed != null ||
    funnel.n_packs_with_p != null;

  return hasAny ? funnel : undefined;
}

/** Build helper input from place emptiness + raw coverage_health payload. */
export function emptySlipInputFromCoverage(
  placeEmpty: boolean,
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): EmptySlipInput {
  const loaded = isCoverageHealthLoaded(coverage);
  const c = (coverage || {}) as Record<string, unknown>;
  const skRaw = c.starvation_kind;
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
    starvation_kind:
      skRaw != null && String(skRaw).trim() !== ""
        ? (String(skRaw).trim() as StarvationKind)
        : null,
    funnel: funnelFromCoverage(coverage),
  };
}
