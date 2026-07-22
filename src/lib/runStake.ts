/**
 * Run-stake room display — engine audit fields only (HV v3).
 *
 * Never invents bankroll math. Surfaces `run_stake_cap_nok`, used, binding
 * when present on PLACE_THESE.md, stake_decisions, or risk/recommend JSON.
 */
import type { RiskState, TrackerSnapshot } from "@/types";

export type RunStakeRoom = {
  /** min(remaining_risk, equity * pct) from engine */
  cap_nok: number | null;
  used_nok: number | null;
  binding: string | null;
  equity_cap_nok?: number | null;
  remaining_risk_nok?: number | null;
  /** Where fields were found */
  source: "place_these" | "stake_decisions" | "risk" | "none";
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Parse run-stake audit line from PLACE_THESE markdown (engine text). */
export function parseRunStakeFromPlaceThese(md: string | null | undefined): RunStakeRoom | null {
  if (!md?.trim()) return null;
  // Engine format (PR5):
  // Run stake: used **0** / cap **40** (equity cap **100**, remaining risk **40**) · binding: **phase_remaining**
  const usedM = md.match(/Run stake:\s*used\s+\*{0,2}([0-9.]+)\*{0,2}/i);
  const capM = md.match(/\/\s*cap\s+\*{0,2}([0-9.]+)\*{0,2}/i);
  const equityCapM = md.match(/equity cap\s+\*{0,2}([0-9.]+)\*{0,2}/i);
  const remM = md.match(/remaining risk\s+\*{0,2}([0-9.]+)\*{0,2}/i);
  const bindM = md.match(/binding:\s+\*{0,2}([A-Za-z0-9_]+)\*{0,2}/i);

  if (!usedM && !capM && !bindM) return null;

  return {
    cap_nok: capM ? num(capM[1]) : null,
    used_nok: usedM ? num(usedM[1]) : null,
    binding: bindM ? str(bindM[1]) : null,
    equity_cap_nok: equityCapM ? num(equityCapM[1]) : null,
    remaining_risk_nok: remM ? num(remM[1]) : null,
    source: "place_these",
  };
}

/** Read run_stake_* keys from a plain object (risk / stake_decision / recommend). */
export function runStakeFromRecord(
  rec: Record<string, unknown> | null | undefined,
  source: RunStakeRoom["source"]
): RunStakeRoom | null {
  if (!rec || typeof rec !== "object") return null;
  const nested =
    rec.run_stake != null && typeof rec.run_stake === "object"
      ? (rec.run_stake as Record<string, unknown>)
      : {};

  const cap = num(rec.run_stake_cap_nok ?? nested.run_stake_cap_nok);
  const used = num(rec.run_stake_used_nok ?? nested.run_stake_used_nok);
  const binding = str(rec.run_stake_binding ?? nested.run_stake_binding);
  const equityCap = num(
    rec.run_stake_equity_cap_nok ?? nested.run_stake_equity_cap_nok
  );
  const rem = num(
    rec.run_stake_remaining_risk_nok ?? nested.run_stake_remaining_risk_nok
  );

  if (cap == null && used == null && binding == null) return null;

  return {
    cap_nok: cap,
    used_nok: used,
    binding,
    equity_cap_nok: equityCap,
    remaining_risk_nok: rem,
    source,
  };
}

/**
 * Resolve run-stake room for desk UI.
 * Priority: PLACE_THESE markdown → latest stake_decision with fields → risk JSON.
 */
export function resolveRunStakeRoom(
  snapshot: TrackerSnapshot | null | undefined
): RunStakeRoom | null {
  if (!snapshot) return null;

  const fromPlace = parseRunStakeFromPlaceThese(snapshot.place_these);
  if (fromPlace && (fromPlace.cap_nok != null || fromPlace.used_nok != null)) {
    return fromPlace;
  }

  const decisions = snapshot.stake_decisions;
  if (Array.isArray(decisions) && decisions.length > 0) {
    for (let i = decisions.length - 1; i >= 0; i--) {
      const d = decisions[i];
      if (d && typeof d === "object") {
        const r = runStakeFromRecord(d as Record<string, unknown>, "stake_decisions");
        if (r) return r;
      }
    }
  }

  const risk = snapshot.risk as RiskState | Record<string, unknown> | undefined;
  if (risk && typeof risk === "object") {
    const r = runStakeFromRecord(risk as Record<string, unknown>, "risk");
    if (r) return r;
  }

  // place_these may have partial parse (binding only) — still useful
  if (fromPlace) return fromPlace;

  return null;
}

/** Short chip label e.g. "Run 30/40 · phase_remaining" */
export function runStakeChipLabel(room: RunStakeRoom | null | undefined): string | null {
  if (!room) return null;
  const used = room.used_nok != null ? String(Math.round(room.used_nok)) : "—";
  const cap = room.cap_nok != null ? String(Math.round(room.cap_nok)) : "—";
  if (used === "—" && cap === "—") return null;
  const bind = room.binding ? ` · ${room.binding}` : "";
  return `Run ${used}/${cap}${bind}`;
}
