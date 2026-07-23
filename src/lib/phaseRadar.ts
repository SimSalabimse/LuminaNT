/**
 * PhaseState multi-factor bars + size_mode reason helpers for DeskStrip / CapitalPlan.
 */
import type { PhaseState, RiskState, ControlSignal } from "@/types";

export type PhaseRadarDim = {
  id: string;
  label: string;
  /** 0–100, higher = healthier */
  score: number;
  rawLabel: string;
  tone: "ok" | "warn" | "loss" | "neutral";
};

function toneFor(score: number): PhaseRadarDim["tone"] {
  if (score >= 70) return "ok";
  if (score >= 45) return "warn";
  if (score >= 0) return "loss";
  return "neutral";
}

/** Build 5 health bars from phase.phase_state (higher = better). */
export function phaseRadarDims(phase?: PhaseState | null): PhaseRadarDim[] {
  const ps = (phase?.phase_state || {}) as Record<string, number | undefined>;
  const equity = Number(ps.equity_score ?? 0) * 100;
  const dd = Number(ps.dd_score ?? 0.5) * 100;
  // process_error_rate high = unhealthy → invert
  const peRate = Number(ps.process_error_rate_14d ?? 0);
  const process =
    ps.process_health_score != null
      ? Number(ps.process_health_score) * 100
      : Math.max(0, 100 - peRate * 200);
  const cal = Number(ps.calibration_score ?? 0.5) * 100;
  // concentration high = unhealthy → invert
  const conc = Number(ps.open_risk_concentration ?? 0);
  const concHealth = Math.max(0, 100 - conc * 100);

  const dims: PhaseRadarDim[] = [
    {
      id: "equity",
      label: "Equity",
      score: clamp(equity),
      rawLabel: `${(Number(ps.equity_score ?? 0) * 100).toFixed(0)}% path`,
      tone: toneFor(equity),
    },
    {
      id: "dd",
      label: "DD health",
      score: clamp(dd),
      rawLabel: `score ${(Number(ps.dd_score ?? 0) * 100).toFixed(0)}`,
      tone: toneFor(dd),
    },
    {
      id: "process",
      label: "Process",
      score: clamp(process),
      rawLabel: `err ${(peRate * 100).toFixed(0)}% 14d`,
      tone: toneFor(process),
    },
    {
      id: "conc",
      label: "Diversify",
      score: clamp(concHealth),
      rawLabel: `top sport ${(conc * 100).toFixed(0)}% open`,
      tone: toneFor(concHealth),
    },
    {
      id: "cal",
      label: "Calib",
      score: clamp(cal),
      rawLabel: `score ${(Number(ps.calibration_score ?? 0.5) * 100).toFixed(0)}`,
      tone: toneFor(cal),
    },
  ];
  return dims;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

/** Why size_mode is what it is — capital DD + phase floor. */
export function sizeModeWhy(
  risk?: RiskState | null,
  phase?: PhaseState | null
): string[] {
  const lines: string[] = [];
  const r = risk || {};
  const p = phase || {};
  const mode = String(r.size_mode || "—").toUpperCase();
  const capital = String(r.size_mode_capital || mode).toUpperCase();
  const floor = String(r.size_mode_floor || p.size_mode_floor || "").toUpperCase();

  lines.push(`Effective size_mode: ${mode}`);
  if (capital && capital !== mode) {
    lines.push(`Capital DD mode: ${capital} · phase floor tightened to ${mode}`);
  } else if (capital) {
    lines.push(`Capital DD mode: ${capital}`);
  }
  if (floor && floor !== "NORMAL" && floor !== "NULL" && floor !== "") {
    lines.push(`Phase size_mode_floor: ${floor}`);
  }
  if (r.research_only || p.research_only) {
    lines.push(
      `RESEARCH_ONLY — no new risk (${p.process_health_reason || "process health"})`
    );
  }
  if (p.process_health_until) {
    lines.push(`Process health hold until ${p.process_health_until}`);
  }

  const reasons = [
    ...((r.reasons as string[]) || []),
    ...((p.reasons as string[]) || []),
  ];
  for (const x of reasons) {
    if (
      /size_mode|PHASE HEALTH|L1 DD|FREEZE|REDUCED|FROZEN|process_error|research_only/i.test(
        x
      )
    ) {
      if (!lines.includes(x)) lines.push(x);
    }
  }
  return lines.slice(0, 10);
}

/** Active temp_gate_raise only (client-side filter). */
export function activeControlSignals(
  signals: ControlSignal[] | undefined | null,
  now = Date.now()
): ControlSignal[] {
  if (!signals?.length) return [];
  const revokes = signals.filter((s) => s.kind === "revoke");
  return signals.filter((s) => {
    if (s.kind !== "temp_gate_raise") return false;
    if (s.expires_at) {
      const t = Date.parse(s.expires_at);
      if (Number.isFinite(t) && t < now) return false;
    }
    const sigTs = s.ts ? Date.parse(s.ts) : 0;
    const sp = (s.sport || "").toLowerCase();
    const mk = (s.market || "").toLowerCase();
    for (const r of revokes) {
      const rTs = r.ts ? Date.parse(r.ts) : 0;
      if (rTs && sigTs && rTs < sigTs) continue;
      // Kind-scoped revokes that do not target temp_gate_raise leave gates alone
      const rKinds = revokeKindsOf(r);
      const rSigKind = String(r.signal_kind || "").toLowerCase();
      if (rKinds.length || rSigKind) {
        const hitsGate =
          rKinds.includes("temp_gate_raise") ||
          rKinds.includes("*") ||
          rSigKind === "temp_gate_raise" ||
          rSigKind === "*";
        if (!hitsGate) continue;
        return false;
      }
      if (r.revoke_all) return false;
      const rsp = (r.sport || "").toLowerCase();
      const rmk = (r.market || "").toLowerCase();
      if (rsp && rsp !== sp) continue;
      if (rmk && rmk !== mk) continue;
      if (rsp === sp || r.revoke_all) return false;
    }
    return true;
  });
}

function revokeKindsOf(r: ControlSignal): string[] {
  const raw = r.revoke_kinds;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).toLowerCase());
  return [String(raw).toLowerCase()];
}

/**
 * Active temp_ev_relax ControlSignals (Mechanism B).
 *
 * Does **not** fold into `activeControlSignals` (temp_gate_raise only).
 * Sport-only revokes do not clear temp_ev_relax (engine law) — require
 * kind-scoped revoke / signal_kind / true revoke_all without sport pin.
 */
export function activeTempEvRelax(
  signals: ControlSignal[] | undefined | null,
  now = Date.now()
): ControlSignal[] {
  if (!signals?.length) return [];
  const revokes = signals.filter((s) => s.kind === "revoke");
  return signals.filter((s) => {
    if (s.kind !== "temp_ev_relax") return false;
    if (s.expires_at) {
      const t = Date.parse(s.expires_at);
      if (Number.isFinite(t) && t < now) return false;
    }
    // Need at least engine delta or line_keys to treat as real overlay
    const delta = Number(s.delta_ev);
    const keys = Array.isArray(s.line_keys) ? s.line_keys : [];
    if (!(delta > 0) && keys.length === 0) return false;

    const sigTs = s.ts ? Date.parse(s.ts) : 0;
    for (const r of revokes) {
      const rTs = r.ts ? Date.parse(r.ts) : 0;
      if (rTs && sigTs && rTs < sigTs) continue;
      const rKinds = revokeKindsOf(r);
      const rSigKind = String(r.signal_kind || "").toLowerCase();
      if (rKinds.includes("temp_ev_relax") || rKinds.includes("*")) return false;
      if (rSigKind === "temp_ev_relax" || rSigKind === "*") return false;
      // True global revoke_all without sport/market pin
      if (r.revoke_all && !r.sport && !r.market && !rKinds.length && !rSigKind) {
        return false;
      }
      // Sport-only revoke does not clear temp_ev_relax
    }
    return true;
  });
}

/** Aggregated temp_ev_relax overlay fields for DeskStrip tooltip (engine values only). */
export function tempEvRelaxOverlay(
  signals: ControlSignal[] | undefined | null,
  now = Date.now()
): {
  active: boolean;
  delta_ev: number;
  stake_mult: number;
  expires_at: string | null;
  line_keys_n: number;
  n_signals: number;
  sources: string[];
} {
  const active = activeTempEvRelax(signals, now);
  if (!active.length) {
    return {
      active: false,
      delta_ev: 0,
      stake_mult: 1,
      expires_at: null,
      line_keys_n: 0,
      n_signals: 0,
      sources: [],
    };
  }
  const keySet = new Set<string>();
  let delta = 0;
  let stakeMult = 1;
  let expiresAt: string | null = null;
  const sources: string[] = [];
  for (const s of active) {
    const d = Number(s.delta_ev);
    if (Number.isFinite(d) && d > delta) delta = d;
    const sm = Number(s.stake_mult);
    if (Number.isFinite(sm) && sm > 0) {
      stakeMult = stakeMult < 1 ? Math.min(stakeMult, sm) : sm;
    }
    for (const k of Array.isArray(s.line_keys) ? s.line_keys : []) {
      if (k != null && String(k)) keySet.add(String(k));
    }
    const exp = s.expires_at ? String(s.expires_at) : null;
    if (exp && (expiresAt == null || exp < expiresAt)) expiresAt = exp;
    if (s.source) sources.push(String(s.source));
  }
  if (!(stakeMult < 1) && active.some((s) => s.stake_mult != null)) {
    // keep tightest already applied
  } else if (!(stakeMult < 1)) {
    stakeMult = 1;
  }
  return {
    active: delta > 0 || keySet.size > 0,
    delta_ev: delta,
    stake_mult: stakeMult,
    expires_at: expiresAt,
    line_keys_n: keySet.size,
    n_signals: active.length,
    sources: sources.slice(0, 4),
  };
}

export function ttlLabel(expiresAt?: string | null, now = Date.now()): string {
  if (!expiresAt) return "—";
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return "—";
  const ms = t - now;
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  if (h < 48) return `${h}h left`;
  const d = Math.floor(h / 24);
  return `${d}d left`;
}

/** Parse psp{…} blob from bet notes. */
export function parsePostSettlementPacket(
  notes?: string | null
): Record<string, string> | null {
  if (!notes) return null;
  const m = notes.match(/psp\{([^}]*)\}/i);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const part of m[1].split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
