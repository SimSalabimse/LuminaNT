/**
 * Derive shortlist / case-file process gate chips from notes + grade + size_mode.
 */
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
}): GateChip[] {
  const chips: GateChip[] = [];
  const notes = `${input.notes || ""} ${input.statusReason || ""}`;
  const g = (input.grade || "").toUpperCase();
  if (g) {
    chips.push({
      id: "grade",
      label: `Grade ${g}`,
      tone: g === "A" ? "ok" : g === "B" ? "primary" : g === "C" ? "warn" : "loss",
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
  if (/process_gate|process_error|process\+/i.test(notes) || (input.processGateRaise ?? 0) > 0) {
    chips.push({ id: "process", label: "Process+EV", tone: "warn" });
  }
  if (/script_conflict|script /i.test(notes)) {
    chips.push({ id: "script", label: "Script", tone: "warn" });
  }
  if (/soft correlation|max .* league|kickoff window/i.test(notes)) {
    chips.push({ id: "corr", label: "Corr cap", tone: "warn" });
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
