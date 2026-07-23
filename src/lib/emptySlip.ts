/**
 * Empty-slip taxonomy — process miss vs honest no-edge.
 *
 * Deep-packs SSOT is `shortlist_with_deep_n` only (count of shortlist rows
 * with a deep pack). Do **not** gate on bare `deep_n` (total packs in health
 * payload can diverge from shortlist coverage).
 *
 * Engine Coverage Health remains law; this helper only classifies for UX copy.
 *
 * Loader: Tauri `load_snapshot` reads `data/state/coverage_health.json` into
 * `snapshot.coverage_health`. Missing/empty payload → `coverage_unavailable`
 * fail-closed (do not claim measured zero packs).
 *
 * Also: progressive DeskStrip chips (EV-RELAX / CFLOOR) — engine fields only.
 */
import type {
  ControlSignal,
  CoverageFloorAudit,
  CoverageHealth,
  ViewId,
} from "@/types";
import { tempEvRelaxOverlay, ttlLabel } from "@/lib/phaseRadar";

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

// ─── DeskStrip progressive chips (coverage floor + temp_ev_relax) ───────────

export type DeskStripChip = {
  id: string;
  /** Short label on strip, e.g. EV-RELAX / CFLOOR */
  label: string;
  tone: "warn" | "loss" | "ok" | "neutral";
  /** Full tooltip — engine fields only, no invented EV math */
  title: string;
};

function asCoverage(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): CoverageHealth {
  if (coverage == null || typeof coverage !== "object") return {};
  return coverage as CoverageHealth;
}

function floorAuditOf(c: CoverageHealth): CoverageFloorAudit | null {
  const raw = c.coverage_floor;
  if (raw != null && typeof raw === "object") return raw as CoverageFloorAudit;
  return null;
}

function countOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function revokeKindsList(r: ControlSignal): string[] {
  const raw = r.revoke_kinds;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).toLowerCase());
  return [String(raw).toLowerCase()];
}

/**
 * Active force_coverage_priority ControlSignals (not expired, not revoked).
 * Mirrors kind-scoped + global revoke hygiene used by temp_gate / temp_ev_relax.
 */
export function activeForceCoverageSignals(
  signals: ControlSignal[] | undefined | null,
  now = Date.now()
): ControlSignal[] {
  if (!signals?.length) return [];
  const revokes = signals.filter((s) => s.kind === "revoke");
  return signals.filter((s) => {
    if (s.kind !== "force_coverage_priority") return false;
    if (s.expires_at) {
      const t = Date.parse(s.expires_at);
      if (Number.isFinite(t) && t < now) return false;
    }
    const sigTs = s.ts ? Date.parse(s.ts) : 0;
    const sp = (s.sport || "").toLowerCase();
    for (const r of revokes) {
      const rTs = r.ts ? Date.parse(r.ts) : 0;
      if (rTs && sigTs && rTs < sigTs) continue;
      const rKinds = revokeKindsList(r);
      const rSigKind = String(r.signal_kind || "").toLowerCase();
      if (
        rKinds.includes("force_coverage_priority") ||
        rKinds.includes("*") ||
        rSigKind === "force_coverage_priority" ||
        rSigKind === "*"
      ) {
        return false;
      }
      // Global revoke_all without sport pin
      if (r.revoke_all && !r.sport && !r.market && !rKinds.length && !rSigKind) {
        return false;
      }
      // Sport-scoped revoke (including revoke_all + sport)
      if (!rKinds.length && !rSigKind) {
        const rsp = (r.sport || "").toLowerCase();
        if (r.revoke_all && !rsp) return false;
        if (rsp && sp && rsp === sp) return false;
        if (rsp && !sp && r.revoke_all) return false;
      }
    }
    return true;
  });
}

/**
 * EV-RELAX strip chip from active temp_ev_relax ControlSignals.
 * Progressive: null when inactive. Tooltip uses engine delta / stake_mult only.
 * Omits stake× when the engine did not stamp stake_mult (no invented 1.00).
 */
export function tempEvRelaxChip(
  signals: ControlSignal[] | undefined | null,
  now = Date.now()
): DeskStripChip | null {
  const ov = tempEvRelaxOverlay(signals, now);
  if (!ov.active) return null;

  const parts: string[] = ["temp_ev_relax active (engine)"];
  if (ov.delta_ev > 0) {
    parts.push(`ΔEV −${ov.delta_ev.toFixed(3)}`);
  }
  if (ov.stake_mult != null && Number.isFinite(ov.stake_mult) && ov.stake_mult > 0) {
    parts.push(`stake×${ov.stake_mult.toFixed(2)}`);
  }
  if (ov.expires_at) {
    parts.push(`expires ${ov.expires_at}`);
    parts.push(ttlLabel(ov.expires_at, now));
  }
  parts.push(`lines ${ov.line_keys_n}`);
  if (ov.n_signals > 1) parts.push(`signals ${ov.n_signals}`);
  if (ov.sources.length) parts.push(`source ${ov.sources[0]}`);

  return {
    id: "ev_relax",
    label: "EV-RELAX",
    tone: "warn",
    title: parts.join(" · "),
  };
}

/**
 * CFLOOR strip chip from coverage_health audit + force_coverage + level pressure.
 *
 * Show when any of:
 * - coverage_health.coverage_floor audit has activity (scaffolds / rotation / target)
 * - force_coverage_active / force_coverage_signal
 * - active force_coverage_priority ControlSignal
 * - coverage level warn/critical (secondary pressure hint)
 *
 * Progressive disclosure only — never invents EV or pack counts.
 */
export function coverageFloorChip(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined,
  signals?: ControlSignal[] | null,
  now = Date.now()
): DeskStripChip | null {
  const c = asCoverage(coverage);
  const loaded = isCoverageHealthLoaded(coverage);
  const floor = floorAuditOf(c);
  const level = normLevel(c.level);

  const scaffoldN =
    countOrNull(floor?.scaffold_tagged_n) ??
    countOrNull((c as Record<string, unknown>).scaffold_tagged_n);
  const rotN =
    countOrNull(floor?.sport_rotation_tagged_n) ??
    countOrNull((c as Record<string, unknown>).sport_rotation_tagged_n);
  const targetN =
    countOrNull(floor?.deep_target_n_effective) ??
    countOrNull(c.deep_target_n_effective);

  const hasFloorAudit =
    floor != null ||
    scaffoldN != null ||
    rotN != null ||
    targetN != null;
  const floorActive =
    (scaffoldN != null && scaffoldN > 0) ||
    (rotN != null && rotN > 0) ||
    (targetN != null && targetN > 0) ||
    Boolean(floor?.enabled);

  const forceActive = Boolean(c.force_coverage_active);
  const forceSignal = c.force_coverage_signal;
  const forceSignals = activeForceCoverageSignals(signals, now);
  const forceFromSignals = forceSignals.length > 0;

  const levelPressure = loaded && (level === "warn" || level === "critical");

  // Need at least one real reason to show the chip
  if (!floorActive && !forceActive && !forceFromSignals && !levelPressure) {
    // coverage_floor blob present but empty counts — still surface when audit object exists with notes
    if (!hasFloorAudit || floor == null) return null;
    if (!Array.isArray(floor.notes) || floor.notes.length === 0) return null;
  }

  // If only "enabled: true" with zero tags and ok level and no force — stay quiet
  if (
    floorActive &&
    !(scaffoldN != null && scaffoldN > 0) &&
    !(rotN != null && rotN > 0) &&
    !(targetN != null && targetN > 0) &&
    !forceActive &&
    !forceFromSignals &&
    !levelPressure
  ) {
    // enabled flag alone is not enough pressure for strip noise
    if (!(Array.isArray(floor?.notes) && floor!.notes!.length > 0)) return null;
  }

  const parts: string[] = ["Coverage floor"];
  if (targetN != null && targetN > 0) {
    parts.push(`deep_target_n_effective ${targetN}`);
  }
  if (scaffoldN != null && scaffoldN > 0) {
    parts.push(`scaffold tags ${scaffoldN}`);
  }
  if (rotN != null && rotN > 0) {
    parts.push(`sport rotation ${rotN}`);
  }
  if (forceActive || forceFromSignals) {
    parts.push("force_coverage active");
    if (forceSignal?.target_odds_band) {
      parts.push(`band ${forceSignal.target_odds_band}`);
    }
    if (forceSignal?.expires_at) {
      parts.push(`force exp ${forceSignal.expires_at}`);
    } else if (forceSignals[0]?.expires_at) {
      parts.push(`force exp ${forceSignals[0].expires_at}`);
    }
  }
  if (levelPressure) {
    parts.push(`coverage ${level}`);
    if (c.empty_slip_risk) parts.push("empty_slip_risk");
  }
  if (Array.isArray(floor?.notes) && floor!.notes!.length > 0) {
    parts.push(String(floor!.notes![0]));
  }

  const tone: DeskStripChip["tone"] =
    level === "critical" || Boolean(c.empty_slip_risk)
      ? "loss"
      : level === "warn" || forceActive || forceFromSignals || floorActive
        ? "warn"
        : "neutral";

  return {
    id: "cfloor",
    label: "CFLOOR",
    tone,
    title: parts.join(" · "),
  };
}

/**
 * Compact COV level chip for DeskStrip (when coverage loaded).
 * Kept separate from CFLOOR so operators can scan level vs floor pressure.
 */
export function coverageStripChip(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): DeskStripChip | null {
  if (!isCoverageHealthLoaded(coverage)) return null;
  const c = asCoverage(coverage);
  const level = normLevel(c.level) || "—";
  const deepPct = c.shortlist_deep_pct;
  let deepLabel = "";
  if (deepPct != null && Number.isFinite(Number(deepPct))) {
    const n = Number(deepPct);
    deepLabel =
      n >= 0 && n <= 1 ? `${(n * 100).toFixed(0)}% deep` : `${n.toFixed(0)}% deep`;
  }
  const tone: DeskStripChip["tone"] =
    level === "critical" || Boolean(c.empty_slip_risk)
      ? "loss"
      : level === "warn"
        ? "warn"
        : level === "ok"
          ? "ok"
          : "neutral";
  const parts = [
    `Coverage ${level}`,
    deepLabel,
    c.force_coverage_active ? "COV FORCE" : "",
    c.empty_slip_risk ? "empty_slip_risk" : "",
  ].filter(Boolean);
  return {
    id: "cov",
    label:
      level === "critical"
        ? "COV CRIT"
        : level === "warn"
          ? "COV WARN"
          : `COV ${level.toUpperCase()}`,
    tone,
    title: parts.join(" · "),
  };
}

/** All progressive coverage-related strip chips (COV + CFLOOR + EV-RELAX). */
export function deskStripCoverageChips(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined,
  signals?: ControlSignal[] | null,
  now = Date.now()
): DeskStripChip[] {
  const chips: DeskStripChip[] = [];
  const cov = coverageStripChip(coverage);
  if (cov) chips.push(cov);
  const floor = coverageFloorChip(coverage, signals, now);
  if (floor) chips.push(floor);
  const relax = tempEvRelaxChip(signals, now);
  if (relax) chips.push(relax);
  return chips;
}
