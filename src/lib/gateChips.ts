/**
 * Derive shortlist / case-file process gate chips from notes + grade + size_mode.
 * Grade colors come from shared gradeTone() — keep in sync with SimpleModeCard.
 */
import type { ControlSignal } from "@/types";
import { gradeTone } from "@/lib/resolveReasoningChain";

export type GateChip = {
  id: string;
  label: string;
  tone: "ok" | "warn" | "loss" | "neutral" | "primary";
};

export function deriveGateChips(input: {
  grade?: string | null;
  sizeMode?: string | null;
  notes?: string | null;
  statusReason?: string | null;
  processGateRaise?: number | null;
  sport?: string | null;
  activeSignals?: ControlSignal[] | null;
  highOddsStress?: boolean | null;
}): GateChip[] {
  const chips: GateChip[] = [];
  const notes = `${input.notes || ""} ${input.statusReason || ""}`;
  const g = (input.grade || "").toUpperCase();
  if (g) {
    chips.push({
      id: "grade",
      label: `Grade ${g}`,
      tone: gradeTone(g).tone,
    });
  }
  const sm = (input.sizeMode || "").toUpperCase();
  if (sm && sm !== "LEGACY") {
    chips.push({
      id: "mode",
      label: sm,
      tone: sm === "NORMAL" ? "ok" : sm === "REDUCED" ? "warn" : "loss",
    });
  }
  // Active ControlSignal temp_gate for this sport
  const sp = (input.sport || "").toLowerCase();
  const hit = (input.activeSignals || []).find(
    (s) =>
      s.kind === "temp_gate_raise" &&
      sp &&
      String(s.sport || "").toLowerCase() === sp
  );
  if (hit || (input.processGateRaise ?? 0) > 0) {
    chips.push({
      id: "temp_gate",
      label: hit
        ? `temp_gate +${hit.min_ev_raise ?? "?"}`
        : "temp_gate",
      tone: "warn",
    });
    if (hit?.force_confirmed_lineup) {
      chips.push({ id: "xi", label: "XI confirmed", tone: "warn" });
    }
  }
  if (/process_gate|process_error|process\+/i.test(notes)) {
    chips.push({ id: "process", label: "Process+EV", tone: "warn" });
  }
  if (/script_conflict|script /i.test(notes)) {
    chips.push({ id: "script", label: "Script", tone: "warn" });
  }
  if (/soft correlation|max .* league|kickoff window|board_penalty|corr/i.test(notes)) {
    chips.push({ id: "board", label: "board_penalty", tone: "warn" });
  }
  if (input.highOddsStress) {
    chips.push({ id: "hi_block", label: "Hi-odds blocked", tone: "loss" });
  }
  if (/EXPLORE/i.test(notes)) {
    chips.push({ id: "explore", label: "Explore", tone: "primary" });
  }
  if (/HIGH_ODDS/i.test(notes)) {
    chips.push({ id: "high", label: "High odds", tone: "warn" });
  }
  if (chips.length === 0) {
    chips.push({ id: "ok", label: "Gate OK", tone: "neutral" });
  }
  return chips.slice(0, 6);
}
