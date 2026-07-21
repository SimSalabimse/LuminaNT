/**
 * Single source of truth for “Can I bet right now?” across strip, desk, plan.
 * Derives operator-facing status from engine risk.json (capital_v2 + legacy).
 */
import type { RiskState, PhaseState, BankrollState } from "@/types";

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
  };
}

function num(x: unknown): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function modeShellClass(mode: SizeMode | string): string {
  const m = String(mode).toUpperCase();
  if (m === "FROZEN") return "ring-1 ring-loss/40 bg-loss/[0.06]";
  if (m === "REDUCED") return "ring-1 ring-pending/35 bg-pending/[0.05]";
  if (m === "NORMAL") return "ring-1 ring-primary/20 bg-primary/[0.03]";
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
