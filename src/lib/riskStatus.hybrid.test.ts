/**
 * PR-4: hybrid half-step phase chip, continuous unit, secure skim status.
 * Engine fields only — never invent progress, unit, or skim tiers.
 */
import { describe, expect, it } from "vitest";
import {
  deriveRiskStatus,
  hybridPhaseChip,
  secureSkimStatus,
  unitSizeChip,
  unitSourceHint,
} from "./riskStatus";

const hybrid1APlus = {
  capital_v2_enabled: true,
  equity_nok: 550.99,
  phase_id: "1A+",
  phase_hard_id: "1A",
  progress_inside_phase: 0.27475,
  unit_size_nok: 12,
  unit_size_source: "phase_continuous",
  unit_size_ladder_nok: 12,
  unit_size_continuous_nok: 12,
  phase_continuous_enabled: true,
  secure_nok: 0,
  can_bet: true,
  stopped: false,
  remaining_risk_nok: 13.59,
  open_pending_risk_nok: 34,
  riskable_liquid_nok: 516.99,
  size_mode: "NORMAL",
};

const hybridPhase = {
  phase_id: "1A+",
  phase_hard_id: "1A",
  label: "Protect+",
  progress_inside_phase: 0.27475,
  phase_continuous_enabled: true,
  unit_size_nok: 12,
  unit_size_source: "phase_continuous",
  next: "1B",
};

describe("hybridPhaseChip", () => {
  it("preserves half-step phase_id 1A+ and shows progress", () => {
    const chip = hybridPhaseChip(hybrid1APlus, hybridPhase);
    expect(chip.phaseId).toBe("1A+");
    expect(chip.phaseHardId).toBe("1A");
    expect(chip.progress).toBeCloseTo(0.27475, 5);
    expect(chip.progressPct).toBe(27);
    expect(chip.label).toBe("1A+ · 27%");
    expect(chip.hardGateLabel).toBe("gates 1A");
    expect(chip.detail).toContain("1A+");
    expect(chip.detail).toContain("next 1B");
  });

  it("hides hard gate when same as display id", () => {
    const chip = hybridPhaseChip(
      { phase_id: "2", phase_hard_id: "2", progress_inside_phase: 0.5 },
      { phase_id: "2", phase_hard_id: "2", progress_inside_phase: 0.5 }
    );
    expect(chip.phaseId).toBe("2");
    expect(chip.phaseHardId).toBeNull();
    expect(chip.hardGateLabel).toBeNull();
    expect(chip.label).toBe("2 · 50%");
  });

  it("does not invent progress when field missing", () => {
    const chip = hybridPhaseChip({ phase_id: "1A" }, { phase_id: "1A" });
    expect(chip.phaseId).toBe("1A");
    expect(chip.progress).toBeNull();
    expect(chip.progressPct).toBe(0);
    expect(chip.label).toBe("1A");
  });

  it("prefers phase over risk for display id", () => {
    const chip = hybridPhaseChip(
      { phase_id: "1A", progress_inside_phase: 0.1 },
      { phase_id: "1A+", phase_hard_id: "1A", progress_inside_phase: 0.5 }
    );
    expect(chip.phaseId).toBe("1A+");
    expect(chip.progress).toBeCloseTo(0.5);
  });

  it("clamps progress to 0–1", () => {
    const chip = hybridPhaseChip(
      { phase_id: "1B+", progress_inside_phase: 1.5 },
      null
    );
    expect(chip.progress).toBe(1);
    expect(chip.progressPct).toBe(100);
  });
});

describe("unitSizeChip", () => {
  it("surfaces continuous unit from engine fields", () => {
    const chip = unitSizeChip(hybrid1APlus, hybridPhase);
    expect(chip.unit).toBe(12);
    expect(chip.source).toBe("phase_continuous");
    expect(chip.sourceHint).toBe("continuous");
    expect(chip.continuous).toBe(12);
    expect(chip.ladder).toBe(12);
  });

  it("notes when continuous and ladder differ", () => {
    const chip = unitSizeChip({
      unit_size_nok: 14,
      unit_size_source: "phase_continuous",
      unit_size_continuous_nok: 14,
      unit_size_ladder_nok: 12,
      phase_continuous_enabled: true,
    });
    expect(chip.unit).toBe(14);
    expect(chip.note).toContain("continuous 14");
    expect(chip.note).toContain("ladder 12");
  });

  it("labels ladder source", () => {
    const chip = unitSizeChip({
      unit_size_nok: 12,
      unit_size_source: "unit_ladder",
      unit_size_ladder_nok: 12,
    });
    expect(chip.sourceHint).toBe("ladder");
    expect(chip.note).toMatch(/ladder/i);
  });

  it("defaults unit to 10 only when missing (legacy fallback)", () => {
    const chip = unitSizeChip({});
    expect(chip.unit).toBe(10);
    expect(chip.source).toBeNull();
  });
});

describe("secureSkimStatus", () => {
  it("shows empty secure with no transfers", () => {
    const s = secureSkimStatus({ secure_nok: 0 }, { secure_transfers: [] });
    expect(s.secure).toBe(0);
    expect(s.lastTier).toBeNull();
    expect(s.label).toMatch(/empty/i);
  });

  it("reads last transfer tier from capital_segments (Variant A soft)", () => {
    const s = secureSkimStatus(
      { secure_nok: 45 },
      {
        secure_nok: 45,
        secure_lock_settled_count: 80,
        secure_transfers: [
          {
            ts: "2026-07-20T10:00:00Z",
            transferred_nok: 20,
            tier: "soft",
            secure_after_nok: 20,
          },
          {
            ts: "2026-07-22T12:00:00Z",
            transferred_nok: 25,
            tier: "soft",
            secure_after_nok: 45,
          },
        ],
      }
    );
    expect(s.secure).toBe(45);
    expect(s.lastTier).toBe("soft");
    expect(s.lastTransferNok).toBe(25);
    expect(s.lastTs).toContain("2026-07-22");
    expect(s.lockSettledCount).toBe(80);
    expect(s.label).toContain("soft");
  });

  it("surfaces hard tier without inventing amount", () => {
    const s = secureSkimStatus(
      { secure_nok: 90 },
      {
        secure_transfers: [
          { tier: "hard", transferred_nok: 60, ts: "2026-07-23T01:00:00Z" },
        ],
      }
    );
    expect(s.lastTier).toBe("hard");
    expect(s.lastTransferNok).toBe(60);
  });

  it("does not invent tier when transfers lack tier field", () => {
    const s = secureSkimStatus(
      { secure_nok: 10 },
      {
        secure_transfers: [{ transferred_nok: 10, ts: "2026-07-01T00:00:00Z" }],
      }
    );
    expect(s.lastTier).toBeNull();
    expect(s.lastTransferNok).toBe(10);
  });
});

describe("deriveRiskStatus hybrid fields", () => {
  it("surfaces phase_id 1A+, hard id, progress, unit source", () => {
    const s = deriveRiskStatus(hybrid1APlus, { equity_nok: 550.99 }, hybridPhase);
    expect(s.phaseId).toBe("1A+");
    expect(s.phaseHardId).toBe("1A");
    expect(s.progressInsidePhase).toBeCloseTo(0.27475, 5);
    expect(s.unit).toBe(12);
    expect(s.unitSource).toBe("phase_continuous");
  });

  it("null hard id when equal to display", () => {
    const s = deriveRiskStatus(
      { phase_id: "1B", phase_hard_id: "1B", unit_size_nok: 13 },
      undefined,
      { phase_id: "1B", phase_hard_id: "1B" }
    );
    expect(s.phaseId).toBe("1B");
    expect(s.phaseHardId).toBeNull();
  });
});

describe("unitSourceHint", () => {
  it("maps engine sources", () => {
    expect(unitSourceHint("phase_continuous")).toBe("continuous");
    expect(unitSourceHint("unit_ladder")).toBe("ladder");
    expect(unitSourceHint(null)).toBe("unit");
  });
});
