/**
 * Single source of truth for “Can I bet right now?” across strip, desk, plan.
 * Derives operator-facing status from engine risk.json (capital_v2 + legacy).
 * Never invents regime caps / min-EV / exit targets — display engine fields only.
 */
import type {
  RiskState,
  PhaseState,
  BankrollState,
  RegimeProgress,
  BankrollRegimeDetail,
} from "@/types";

export type SizeMode = "NORMAL" | "REDUCED" | "FROZEN" | "LEGACY";

export type BettingGate =
  | "CLEAR"
  | "REDUCED"
  | "NO_ROOM"
  | "DAILY_STOP"
  | "WEEKLY_STOP"
  | "FROZEN"
  | "STOPPED";

export type RiskStatus = {
  v2: boolean;
  sizeMode: SizeMode;
  /** Engine can_bet after all layers */
  canBet: boolean;
  /** Unified gate for UI — never contradicts sizeMode */
  gate: BettingGate;
  /** Short label for badge: BET YES / BET NO / REDUCED / FROZEN */
  betLabel: string;
  /** One-line operator reason */
  reason: string;
  equity: number;
  liquid: number;
  openRisk: number;
  remaining: number;
  secure: number;
  unit: number;
  dd: number | null;
  ddPctLabel: string;
  freezeManual: boolean;
  dailyRoom: number | null;
  weeklyRoom: number | null;
  openRoom: number | null;
  todayPl: number | null;
  phaseId: string;
  /**
   * Engine bankroll_regime id: exploration | survival | normal
   * (or legacy stale `calibration`).
   */
  bankrollRegime: string | null;
  /** Operator label; calibration aliased as Exploration (legacy) only */
  bankrollRegimeLabel: string | null;
  /** Raw engine open-risk cap — never invent 50 in TS */
  regimeOpenCap: number | null;
  /** Raw engine min-EV floor — never invent 0.04 in TS */
  regimeMinEv: number | null;
  /** Pre-package / pre-Exploration export shape */
  staleRiskSchema: boolean;
};

export function deriveRiskStatus(
  risk: RiskState | Record<string, unknown> | undefined,
  bankroll?: BankrollState | Record<string, unknown>,
  phase?: PhaseState | Record<string, unknown>
): RiskStatus {
  const r = (risk || {}) as Record<string, unknown>;
  const b = (bankroll || {}) as Record<string, unknown>;
  const p = (phase || {}) as Record<string, unknown>;

  const v2 = r.capital_v2_enabled === true;
  const equity = num(b.equity_nok ?? r.equity_nok) ?? 0;
  const openRisk = num(r.open_pending_risk_nok ?? b.pending_at_risk_nok) ?? 0;
  const secure = num(r.secure_nok) ?? 0;
  const liquid =
    num(r.riskable_liquid_nok) ??
    num(b.liquid_nok) ??
    Math.max(0, equity - openRisk);
  const remaining = num(r.remaining_risk_nok) ?? 0;
  const unit = num(r.unit_size_nok) ?? 10;
  const minStake = num(r.min_stake_nok) ?? 10;

  let sizeMode: SizeMode = "LEGACY";
  if (v2) {
    const sm = String(r.size_mode || "NORMAL").toUpperCase();
    if (sm === "FROZEN" || sm === "REDUCED" || sm === "NORMAL") sizeMode = sm;
    else sizeMode = "NORMAL";
  }

  const freezeManual = r.freeze_manual === true;
  const ddFrozen = r.dd_frozen === true;
  const stopped = r.stopped === true;
  const engineCanBet = r.can_bet === true && !stopped;

  const ddFromRisk = num(r.drawdown_from_peak);
  const ddFromPhase = num(p.drawdown_from_peak_pct);
  const dd =
    v2 && ddFromRisk != null
      ? ddFromRisk
      : ddFromPhase != null
        ? ddFromPhase
        : null;

  const dailyLim = num(r.daily_loss_limit_nok);
  const weeklyLim = num(r.weekly_loss_limit_nok);
  const todayPl = num(r.today_realized_pl_nok);
  const weekPl = num(r.week_realized_pl_nok);
  const dailyRoom =
    dailyLim != null && todayPl != null
      ? Math.max(0, dailyLim + Math.min(0, todayPl))
      : null;
  const weeklyRoom =
    weeklyLim != null && weekPl != null
      ? Math.max(0, weeklyLim + Math.min(0, weekPl))
      : null;
  const openRoom = num(r.portfolio_open_room_nok);

  const regimeObj =
    r.regime && typeof r.regime === "object"
      ? (r.regime as BankrollRegimeDetail)
      : null;
  const bankrollRegime =
    r.bankroll_regime != null
      ? String(r.bankroll_regime)
      : regimeObj?.id != null
        ? String(regimeObj.id)
        : null;
  const rawLabel =
    r.bankroll_regime_label != null
      ? String(r.bankroll_regime_label)
      : regimeObj?.label != null
        ? String(regimeObj.label)
        : bankrollRegime;
  // Alias calibration as legacy Exploration only — never rewrite numeric caps
  const bankrollRegimeLabel =
    bankrollRegime != null &&
    bankrollRegime.toLowerCase() === "calibration"
      ? "Exploration (legacy)"
      : rawLabel;
  const regimeOpenCap = num(r.regime_open_risk_cap_nok ?? regimeObj?.open_risk_cap_nok);
  const regimeMinEv = num(r.regime_min_ev ?? regimeObj?.min_ev);
  const staleRiskSchema = isStaleRiskSchema(r);

  // Unified gate — priority matches engine fail-closed order
  let gate: BettingGate = "CLEAR";
  let reason = "All layers clear — room for new risk";

  if (freezeManual || ddFrozen || sizeMode === "FROZEN") {
    gate = "FROZEN";
    reason = freezeManual
      ? "Manual freeze active — unfreeze only after review"
      : "Drawdown ≥25% freeze — no new risk until unfreeze";
  } else if (stopped && r.daily_hard_stopped === true) {
    gate = "DAILY_STOP";
    reason = "Daily loss hard stop — no new risk today";
  } else if (stopped && r.weekly_hard_stopped === true) {
    gate = "WEEKLY_STOP";
    reason = "Weekly loss hard stop — no new risk this week";
  } else if (stopped) {
    gate = "STOPPED";
    const reasons = Array.isArray(r.reasons) ? (r.reasons as string[]) : [];
    reason = reasons[0] || "Risk engine stopped new bets";
  } else if (!engineCanBet || remaining + 1e-9 < minStake) {
    gate = "NO_ROOM";
    if (remaining + 1e-9 < minStake) {
      reason = `Remaining ${remaining.toFixed(0)} NOK below ${minStake} NOK floor — wait for settle or free risk`;
    } else {
      reason = "Cannot bet — remaining room or diversify limits";
    }
  } else if (sizeMode === "REDUCED") {
    gate = "REDUCED";
    reason = "Drawdown ≥15% — half-unit sizing only";
  }

  const canBet = gate === "CLEAR" || gate === "REDUCED";

  let betLabel = "BET YES";
  if (gate === "FROZEN") betLabel = "FROZEN";
  else if (gate === "DAILY_STOP" || gate === "WEEKLY_STOP" || gate === "STOPPED")
    betLabel = "BET NO";
  else if (gate === "NO_ROOM") betLabel = "BET NO";
  else if (gate === "REDUCED") betLabel = "REDUCED";

  return {
    v2,
    sizeMode,
    canBet,
    gate,
    betLabel,
    reason,
    equity,
    liquid,
    openRisk,
    remaining,
    secure,
    unit,
    dd,
    ddPctLabel: dd != null ? `${(dd * 100).toFixed(1)}%` : "—",
    freezeManual,
    dailyRoom,
    weeklyRoom,
    openRoom,
    todayPl,
    phaseId: String(p.phase_id || r.phase_id || "—"),
    bankrollRegime,
    bankrollRegimeLabel,
    regimeOpenCap,
    regimeMinEv,
    staleRiskSchema,
  };
}

/**
 * True when risk.json is pre-package / pre-Exploration export shape.
 *
 * Always (any capital mode):
 *   - bankroll_regime id is legacy `calibration`
 *
 * When capital_v2 ON:
 *   - regime present but package `regime_weekly_explore_max` missing
 *   - progress has legacy `calibration_exit` without package `exploration_exit`
 *
 * Progress chip still requires package `exploration_exit` (fail-closed display).
 * Never invents package numeric law in TS — only detects drift.
 */
export function isStaleRiskSchema(
  risk: RiskState | Record<string, unknown> | undefined
): boolean {
  const r = (risk || {}) as Record<string, unknown>;
  const regime =
    r.regime && typeof r.regime === "object"
      ? (r.regime as Record<string, unknown>)
      : null;
  const id = String(r.bankroll_regime ?? regime?.id ?? "").toLowerCase();
  // Strongest pre-package signal — design A.4: independent of capital_v2 flag
  if (id === "calibration") return true;

  if (r.capital_v2_enabled !== true) return false;

  const hasRegimeSignal = r.bankroll_regime != null || regime?.id != null;
  if (hasRegimeSignal && r.regime_weekly_explore_max === undefined) return true;

  const progress =
    regime?.progress && typeof regime.progress === "object"
      ? (regime.progress as Record<string, unknown>)
      : null;
  // Design: only flag when legacy calibration_exit is present without package exit
  if (
    progress != null &&
    progress.calibration_exit != null &&
    progress.exploration_exit == null
  ) {
    return true;
  }

  return false;
}

/** Compact chip text for strip (full label stays in tooltip / bankrollRegimeLabel). */
export function regimeChipLabel(
  label: string | null | undefined,
  id: string | null | undefined
): string {
  const full = String(label || id || "—");
  const idLower = String(id || "").toLowerCase();
  if (idLower === "calibration" || full === "Exploration (legacy)") {
    return "Expl. (legacy)";
  }
  return full;
}

/** Fresh package progress for Exploration/Survival chip — never from calibration_exit. */
export type RegimeProgressChip = {
  /** Short operator line e.g. "12/40 settled · eq 520/650" */
  label: string;
  /** 0–100 bar toward current regime exit (settled-based) */
  settledPct: number;
  settled: number;
  exitSettled: number;
  equity: number | null;
  exitEquity: number | null;
};

/**
 * Progress chip data only for non-stale package risk.
 * When stale: returns null (do not map calibration_exit:30 → Exploration 40).
 */
export function regimeProgressChip(
  risk: RiskState | Record<string, unknown> | undefined,
  opts?: { stale?: boolean }
): RegimeProgressChip | null {
  const r = (risk || {}) as Record<string, unknown>;
  const stale = opts?.stale ?? isStaleRiskSchema(r);
  if (stale) return null;

  const regime =
    r.regime && typeof r.regime === "object"
      ? (r.regime as Record<string, unknown>)
      : null;
  const progress =
    regime?.progress && typeof regime.progress === "object"
      ? (regime.progress as RegimeProgress)
      : null;
  if (!progress || progress.exploration_exit == null) return null;

  const id = String(r.bankroll_regime ?? regime?.id ?? "normal").toLowerCase();
  if (id === "normal" || id === "") return null;

  const settled = num(progress.settled) ?? num(r.regime_settled_count) ?? 0;
  const equity = num(regime?.equity_nok ?? r.equity_nok);

  let exitSettled: number | null = null;
  let exitEquity: number | null = null;
  if (id === "exploration") {
    exitSettled = num(progress.exploration_exit);
    exitEquity = num(progress.exploration_exit_equity);
  } else if (id === "survival") {
    exitSettled = num(progress.survival_exit);
    exitEquity = num(progress.survival_exit_equity);
  } else {
    // Unknown non-normal package id — use exploration_exit only if present (already checked)
    exitSettled = num(progress.exploration_exit);
    exitEquity = num(progress.exploration_exit_equity);
  }
  if (exitSettled == null || exitSettled <= 0) return null;

  const settledPct = Math.max(
    0,
    Math.min(100, (settled / exitSettled) * 100)
  );
  const parts = [`${settled}/${exitSettled} settled`];
  if (equity != null && exitEquity != null) {
    parts.push(`eq ${Math.round(equity)}/${Math.round(exitEquity)}`);
  }

  return {
    label: parts.join(" · "),
    settledPct,
    settled,
    exitSettled,
    equity,
    exitEquity,
  };
}


/**
 * Weekly explore quota chip for Exploration regime only.
 * Engine fields only — never invents used/max or EV window.
 *
 * Hide when:
 *   - not Exploration (id/label)
 *   - max is 0 (Survival/Normal package write 0)
 *   - fields missing (stale → STALE RISK banner; non-stale → omit chip)
 */
export type WeeklyExploreQuotaChip = {
  used: number;
  max: number;
  /** Compact primary e.g. "0/2" */
  quotaLabel: string;
  /** Operator line e.g. "Explore 0/2" */
  label: string;
  /** EV window from engine e.g. "EV 2–4%" when both present */
  evWindowLabel: string | null;
  minEv: number | null;
  maxEv: number | null;
  /**
   * True only if values came from note-scan fallback (not engine fields).
   * Prefer engine fields; derived is optional last resort.
   */
  derived: boolean;
};

/**
 * Read regime_weekly_explore_used/max + optional EV window for Exploration strip/plan.
 * Returns null when max is 0, fields missing, or regime is not Exploration.
 */
export function weeklyExploreQuotaChip(
  risk: RiskState | Record<string, unknown> | undefined,
  opts?: { stale?: boolean }
): WeeklyExploreQuotaChip | null {
  const r = (risk || {}) as Record<string, unknown>;
  const regime =
    r.regime && typeof r.regime === "object"
      ? (r.regime as Record<string, unknown>)
      : null;
  const id = String(r.bankroll_regime ?? regime?.id ?? "").toLowerCase();
  const label = String(
    r.bankroll_regime_label ?? regime?.label ?? ""
  ).toLowerCase();
  // Exploration only — legacy calibration relies on STALE banner, not this chip
  const isExploration =
    id === "exploration" ||
    (id === "" && label === "exploration") ||
    label === "exploration";
  if (!isExploration) return null;

  const max = num(r.regime_weekly_explore_max);
  const usedRaw = num(r.regime_weekly_explore_used);

  // Fields missing: hide (stale → banner; non-stale → fail-closed omit)
  if (max == null) return null;
  // max 0 means package wrote no weekly explore quota for this regime
  if (max <= 0) return null;

  const used = usedRaw != null ? Math.max(0, usedRaw) : 0;
  const minEv = num(r.regime_explore_min_ev);
  const maxEv = num(r.regime_explore_max_ev);

  let evWindowLabel: string | null = null;
  if (minEv != null && maxEv != null) {
    const lo = formatEvPct(minEv);
    const hi = formatEvPct(maxEv);
    evWindowLabel = `EV ${lo}–${hi}`;
  } else if (minEv != null) {
    evWindowLabel = `EV ≥${formatEvPct(minEv)}`;
  } else if (maxEv != null) {
    evWindowLabel = `EV ≤${formatEvPct(maxEv)}`;
  }

  // opts.stale reserved for future derived note-scan; engine path ignores it
  void opts?.stale;

  return {
    used,
    max,
    quotaLabel: `${used}/${max}`,
    label: `Explore ${used}/${max}`,
    evWindowLabel,
    minEv,
    maxEv,
    derived: false,
  };
}

/** Format engine EV fraction (0.02) as compact percent string ("2%"). */
function formatEvPct(ev: number): string {
  const pct = ev * 100;
  // Keep one decimal when needed (e.g. 2.5%), else integer
  const rounded =
    Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toFixed(1).replace(/\.0$/, "");
  return `${rounded}%`;
}

function num(x: unknown): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function modeShellClass(mode: SizeMode | string): string {
  const m = String(mode).toUpperCase();
  if (m === "FROZEN") return "mode-shell-frozen";
  if (m === "REDUCED") return "mode-shell-reduced";
  if (m === "NORMAL") return "mode-shell-normal";
  return "";
}

export function modeBadgeVariant(
  mode: SizeMode | string
): "success" | "warning" | "accent" | "secondary" {
  const m = String(mode).toUpperCase();
  if (m === "FROZEN") return "warning";
  if (m === "REDUCED") return "accent";
  if (m === "NORMAL") return "success";
  return "secondary";
}

export function gateBadgeVariant(
  gate: BettingGate
): "success" | "warning" | "loss" | "accent" | "secondary" {
  if (gate === "CLEAR") return "success";
  if (gate === "REDUCED") return "accent";
  if (gate === "FROZEN" || gate === "DAILY_STOP" || gate === "WEEKLY_STOP")
    return "warning";
  if (gate === "NO_ROOM" || gate === "STOPPED") return "loss";
  return "secondary";
}

/** Operator-facing next step for Desk / Plan hero. */
export function nextActionFor(status: RiskStatus): {
  title: string;
  detail: string;
  urgent: boolean;
  showUnfreeze: boolean;
} {
  if (status.gate === "FROZEN") {
    return {
      title: "Unfreeze required",
      detail: status.reason,
      urgent: true,
      showUnfreeze: true,
    };
  }
  if (status.gate === "DAILY_STOP" || status.gate === "WEEKLY_STOP") {
    return {
      title: "Hard stop — no new risk",
      detail: status.reason,
      urgent: true,
      showUnfreeze: false,
    };
  }
  if (status.gate === "STOPPED") {
    return {
      title: "Risk engine blocked",
      detail: status.reason,
      urgent: true,
      showUnfreeze: false,
    };
  }
  if (status.gate === "NO_ROOM") {
    return {
      title: "Wait for room",
      detail: status.reason,
      urgent: false,
      showUnfreeze: false,
    };
  }
  if (status.gate === "REDUCED") {
    return {
      title: "Bet at half-unit only",
      detail: `Unit ${status.unit} NOK · remaining ${status.remaining.toFixed(0)} NOK · ${status.reason}`,
      urgent: false,
      showUnfreeze: false,
    };
  }
  return {
    title: "Clear to size new risk",
    detail: `Remaining ${status.remaining.toFixed(0)} NOK · unit ${status.unit} NOK · ${status.sizeMode}`,
    urgent: false,
    showUnfreeze: false,
  };
}

/**
 * P1: Stranded remaining risk under NT min seat (cannot fund another ticket).
 * leftover ∈ (0, minStake) with room left after open book.
 */
export function strandedRemainder(
  status: RiskStatus,
  minStake = 10
): { stranded: boolean; amount: number; label: string } {
  const rem = status.remaining;
  if (rem > 0.5 && rem + 1e-9 < minStake) {
    return {
      stranded: true,
      amount: rem,
      label: `Stranded ${rem.toFixed(0)} NOK under ${minStake} min seat`,
    };
  }
  return { stranded: false, amount: 0, label: "" };
}

/** Large size_mode chip classes for hero badges. */
export function modeHeroClass(mode: SizeMode | string): string {
  const m = String(mode).toUpperCase();
  if (m === "FROZEN")
    return "border-loss/40 bg-loss/15 text-loss shadow-[0_0_24px_-8px_hsl(var(--loss)/0.5)]";
  if (m === "REDUCED")
    return "border-pending/40 bg-pending/15 text-pending shadow-[0_0_24px_-8px_hsl(var(--pending)/0.45)]";
  if (m === "NORMAL")
    return "border-primary/35 bg-primary/12 text-primary shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]";
  return "border-white/10 bg-white/5 text-muted-foreground";
}
