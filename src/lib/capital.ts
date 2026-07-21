/**
 * capital_v2 display helpers — pure parse/format for Plan + Shortlist views.
 */
import type { Bet, TrackerSnapshot } from "@/types";
import { isOpenRisk, isSettled } from "@/lib/utils";

export type SizeMode = "NORMAL" | "REDUCED" | "FROZEN" | string;

export type ShortlistCard = {
  id: string;
  match: string;
  selection: string;
  odds: number;
  stake: number;
  ev: number | null;
  grade: string;
  band: string;
  pModel: number | null;
  sizeMode: string | null;
  unit: number | null;
  rules: string | null;
  betId: string | null;
  result: string | null;
  status: "open" | "win" | "loss" | "refunded" | "abandoned" | "planned" | "unknown";
  statusReason: string;
  notes: string;
  sport?: string;
};

export function parsePlaceTheseMd(md: string): ShortlistCard[] {
  if (!md?.trim()) return [];
  const lines = md.split(/\r?\n/);
  const cards: ShortlistCard[] = [];
  const noteMap = new Map<string, string>();

  let inNotes = false;
  for (const line of lines) {
    if (line.startsWith("## Notes")) {
      inNotes = true;
      continue;
    }
    if (inNotes && line.startsWith("- ")) {
      const body = line.slice(2);
      const sep = body.indexOf(":");
      if (sep > 0) {
        const key = body.slice(0, sep).trim().toLowerCase();
        noteMap.set(key, body.slice(sep + 1).trim());
      }
    }
  }

  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.includes("Match") && line.includes("Selection")) continue;
    if (line.includes("---")) continue;
    if (line.includes("NO BETS")) continue;
    const parts = line
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    // # | Match | Selection | Odds | Stake | EV | Grade | Band
    if (parts.length < 7) continue;
    const n = Number(parts[0]);
    if (!Number.isFinite(n)) continue;
    const match = parts[1];
    const selection = parts[2];
    const odds = Number(parts[3]);
    const stake = Number(parts[4]);
    const ev = Number(parts[5]);
    const grade = parts[6] || "";
    const band = parts[7] || "";
    const noteKey = `${match} / ${selection}`.toLowerCase();
    const notes =
      noteMap.get(noteKey) ||
      [...noteMap.entries()].find(([k]) => k.includes(match.toLowerCase().slice(0, 18)))?.[1] ||
      "";
    const pm = notes.match(/p_model\s*=\s*([0-9.]+)/i);
    const sm = notes.match(/size_mode\s*=\s*([A-Za-z_]+)/i);
    const un = notes.match(/unit\s*=\s*([0-9.]+)/i);
    const rules = notes.match(/rules\s*=\s*([^\s;]+)/i);
    cards.push({
      id: `place-${n}-${match.slice(0, 20)}`,
      match,
      selection,
      odds: Number.isFinite(odds) ? odds : 0,
      stake: Number.isFinite(stake) ? stake : 0,
      ev: Number.isFinite(ev) ? ev : null,
      grade,
      band,
      pModel: pm ? Number(pm[1]) : null,
      sizeMode: sm ? sm[1].toUpperCase() : null,
      unit: un ? Number(un[1]) : null,
      rules: rules ? rules[1] : null,
      betId: null,
      result: null,
      status: "planned",
      statusReason: "On place slip — not yet matched to ledger",
      notes,
    });
  }
  return cards;
}

/** Merge place-slip shortlist with live ledger outcomes + stake decisions. */
export function buildShortlistCards(
  snapshot: TrackerSnapshot | null,
  bets: Bet[]
): ShortlistCard[] {
  if (!snapshot) return [];
  const fromPlace = parsePlaceTheseMd(snapshot.place_these || "");
  const decisions = snapshot.stake_decisions || [];
  const byMatchSel = new Map<string, Bet>();
  for (const b of bets) {
    const k = `${(b.match || "").toLowerCase()}|${(b.selection || "").toLowerCase()}`;
    // prefer newest
    byMatchSel.set(k, b);
  }

  // Also surface recent open + recent settled with stake_rec notes
  const extras: ShortlistCard[] = [];
  const recent = [...bets]
    .filter(
      (b) =>
        isOpenRisk(b.result) ||
        (isSettled(b.result) && /stake_rec|size_mode|rules=br_v2/i.test(b.notes || ""))
    )
    .slice(-24)
    .reverse();

  for (const b of recent) {
    const notes = b.notes || "";
    const pm = notes.match(/p_model\s*=\s*([0-9.]+)/i);
    const ev = notes.match(/EV\s*=\s*([+-]?[0-9.]+)/i);
    const sm = notes.match(/size_mode\s*=\s*([A-Za-z_]+)/i);
    const un = notes.match(/unit\s*=\s*([0-9.]+)/i);
    const rules = notes.match(/rules\s*=\s*([^\s;]+)/i);
    const { status, statusReason } = outcomeStatus(b, snapshot);
    extras.push({
      id: b.bet_id,
      match: b.match,
      selection: b.selection,
      odds: b.decimal_odds,
      stake: b.stake_nok,
      ev: ev ? Number(ev[1]) : null,
      grade: b.research_grade || "",
      band: b.odds_band || "",
      pModel: pm ? Number(pm[1]) : null,
      sizeMode: sm ? sm[1].toUpperCase() : null,
      unit: un ? Number(un[1]) : null,
      rules: rules ? rules[1] : null,
      betId: b.bet_id,
      result: b.result,
      status,
      statusReason,
      notes,
      sport: b.sport || "",
    });
  }

  const merged: ShortlistCard[] = [];
  const seen = new Set<string>();

  for (const c of fromPlace) {
    const k = `${c.match.toLowerCase()}|${c.selection.toLowerCase()}`;
    const bet = byMatchSel.get(k);
    if (bet) {
      const { status, statusReason } = outcomeStatus(bet, snapshot);
      merged.push({
        ...c,
        id: bet.bet_id,
        betId: bet.bet_id,
        result: bet.result,
        stake: bet.stake_nok || c.stake,
        status,
        statusReason,
        sport: bet.sport || c.sport || "",
      });
      seen.add(bet.bet_id);
    } else {
      merged.push(c);
    }
  }

  for (const e of extras) {
    if (e.betId && seen.has(e.betId)) continue;
    if (e.betId) seen.add(e.betId);
    // avoid duplicate planned+open
    const dup = merged.some(
      (m) =>
        m.match.toLowerCase() === e.match.toLowerCase() &&
        m.selection.toLowerCase() === e.selection.toLowerCase()
    );
    if (!dup) merged.push(e);
  }

  // Attach latest stake decision by bet_id
  for (const c of merged) {
    if (!c.betId) continue;
    const dec = [...decisions]
      .reverse()
      .find((d) => String(d.bet_id || "") === String(c.betId));
    if (dec) {
      if (c.sizeMode == null && dec.size_mode) c.sizeMode = String(dec.size_mode);
      if (c.unit == null && dec.active_unit_nok != null)
        c.unit = Number(dec.active_unit_nok);
      if (c.rules == null && dec.rule_bundle_version)
        c.rules = String(dec.rule_bundle_version);
    }
  }

  return merged.slice(0, 36);
}

function outcomeStatus(
  b: Bet,
  snapshot: TrackerSnapshot
): { status: ShortlistCard["status"]; statusReason: string } {
  const r = (b.result || "").toLowerCase();
  const risk = snapshot.risk || {};
  if (isOpenRisk(b.result)) {
    const mode = String(risk.size_mode || "NORMAL");
    if (mode === "FROZEN" || risk.stopped)
      return {
        status: "open",
        statusReason: "Open — book frozen/stopped after placement; ticket still live",
      };
    return {
      status: "open",
      statusReason: `Open — ${mode} · within open risk / remaining room at place time`,
    };
  }
  if (r === "win")
    return { status: "win", statusReason: "Passed — settled Win (process ok if stake_rec present)" };
  if (r === "loss")
    return { status: "loss", statusReason: "Settled Loss — edge process separate from outcome" };
  if (r === "refunded")
    return { status: "refunded", statusReason: "Refunded — P/L 0, sample counts" };
  if (r === "abandoned")
    return {
      status: "abandoned",
      statusReason: "Failed to place — Abandoned (risk freed, P/L 0)",
    };
  if (isSettled(b.result))
    return { status: "unknown", statusReason: `Settled ${b.result}` };
  return { status: "unknown", statusReason: b.result || "Unknown" };
}

export function sizeModeTone(mode: string | null | undefined): "profit" | "loss" | "pending" | "neutral" {
  const m = (mode || "").toUpperCase();
  if (m === "FROZEN") return "loss";
  if (m === "REDUCED") return "pending";
  if (m === "NORMAL") return "profit";
  return "neutral";
}

export function ddProgress(dd: number): { reducePct: number; freezePct: number; label: string } {
  const reduceAt = 0.15;
  const freezeAt = 0.25;
  const reducePct = Math.min(100, (dd / reduceAt) * 100);
  const freezePct = Math.min(100, (dd / freezeAt) * 100);
  let label = "Clear of soft DD";
  if (dd >= freezeAt) label = "At/above FREEZE (25%)";
  else if (dd >= reduceAt) label = `${((freezeAt - dd) * 100).toFixed(1)}pp to FREEZE`;
  else label = `${((reduceAt - dd) * 100).toFixed(1)}pp to REDUCED`;
  return { reducePct, freezePct, label };
}
