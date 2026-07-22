/**
 * PR1 fixture tests: isStaleRiskSchema + regimeProgressChip.
 * Design A.4 — never map calibration_exit → Exploration 40.
 */
import { describe, expect, it } from "vitest";
import {
  deriveRiskStatus,
  isStaleRiskSchema,
  regimeChipLabel,
  regimeProgressChip,
} from "./riskStatus";

const staleCalibration = {
  capital_v2_enabled: true,
  bankroll_regime: "calibration",
  bankroll_regime_label: "Calibration",
  regime_open_risk_cap_nok: 40,
  regime_min_ev: 0.06,
  regime: {
    id: "calibration",
    progress: { settled: 0, calibration_exit: 30 },
  },
};

const freshExploration = {
  capital_v2_enabled: true,
  bankroll_regime: "exploration",
  bankroll_regime_label: "Exploration",
  regime_open_risk_cap_nok: 50,
  regime_min_ev: 0.04,
  regime_weekly_explore_max: 2,
  regime_weekly_explore_used: 0,
  regime_settled_count: 12,
  regime: {
    id: "exploration",
    equity_nok: 520,
    progress: {
      settled: 12,
      exploration_exit: 40,
      survival_exit: 100,
      exploration_exit_equity: 650,
      survival_exit_equity: 800,
    },
  },
};

const survivalPackage = {
  capital_v2_enabled: true,
  bankroll_regime: "survival",
  bankroll_regime_label: "Survival",
  regime_open_risk_cap_nok: 50,
  regime_min_ev: 0.075,
  regime_weekly_explore_max: 0,
  regime: {
    id: "survival",
    progress: {
      settled: 50,
      exploration_exit: 40,
      survival_exit: 100,
      exploration_exit_equity: 650,
      survival_exit_equity: 800,
    },
  },
};

const normalPackage = {
  capital_v2_enabled: true,
  bankroll_regime: "normal",
  bankroll_regime_label: "Normal",
  regime_weekly_explore_max: 0,
  regime: {
    id: "normal",
    progress: {
      settled: 120,
      exploration_exit: 40,
      survival_exit: 100,
    },
  },
};

describe("isStaleRiskSchema", () => {
  it("flags pre-package calibration + calibration_exit", () => {
    expect(isStaleRiskSchema(staleCalibration)).toBe(true);
  });

  it("flags calibration id even when capital_v2 is off", () => {
    expect(
      isStaleRiskSchema({
        capital_v2_enabled: false,
        bankroll_regime: "calibration",
      })
    ).toBe(true);
  });

  it("flags regime present without weekly explore max", () => {
    expect(
      isStaleRiskSchema({
        capital_v2_enabled: true,
        bankroll_regime: "exploration",
        // no regime_weekly_explore_max
      })
    ).toBe(true);
  });

  it("flags progress with only calibration_exit (legacy)", () => {
    expect(
      isStaleRiskSchema({
        capital_v2_enabled: true,
        bankroll_regime: "exploration",
        regime_weekly_explore_max: 2,
        regime: { progress: { settled: 5, calibration_exit: 30 } },
      })
    ).toBe(true);
  });

  it("does NOT flag incomplete package progress without calibration_exit", () => {
    // Design A.4: progress branch only when calibration_exit present
    expect(
      isStaleRiskSchema({
        capital_v2_enabled: true,
        bankroll_regime: "exploration",
        regime_weekly_explore_max: 2,
        regime: { progress: { settled: 5 } },
      })
    ).toBe(false);
  });

  it("fresh exploration / survival / normal are not stale", () => {
    expect(isStaleRiskSchema(freshExploration)).toBe(false);
    expect(isStaleRiskSchema(survivalPackage)).toBe(false);
    expect(isStaleRiskSchema(normalPackage)).toBe(false);
  });

  it("capital_v2 off without calibration is not stale", () => {
    expect(
      isStaleRiskSchema({ capital_v2_enabled: false, bankroll_regime: "normal" })
    ).toBe(false);
  });
});

describe("regimeProgressChip", () => {
  it("returns null when stale (never maps calibration_exit → 40)", () => {
    expect(regimeProgressChip(staleCalibration)).toBeNull();
    expect(
      regimeProgressChip(staleCalibration, { stale: true })
    ).toBeNull();
  });

  it("uses package exploration_exit for fresh Exploration", () => {
    const chip = regimeProgressChip(freshExploration);
    expect(chip).not.toBeNull();
    expect(chip!.exitSettled).toBe(40);
    expect(chip!.settled).toBe(12);
    expect(chip!.label).toContain("12/40");
  });

  it("hides chip for normal even when progress keys exist", () => {
    expect(regimeProgressChip(normalPackage)).toBeNull();
  });

  it("returns null when exploration_exit missing (fail-closed display)", () => {
    expect(
      regimeProgressChip({
        capital_v2_enabled: true,
        bankroll_regime: "exploration",
        regime_weekly_explore_max: 2,
        regime: { progress: { settled: 5 } },
      })
    ).toBeNull();
  });
});

describe("deriveRiskStatus regime fields", () => {
  it("aliases calibration label without rewriting caps", () => {
    const s = deriveRiskStatus(staleCalibration);
    expect(s.staleRiskSchema).toBe(true);
    expect(s.bankrollRegime).toBe("calibration");
    expect(s.bankrollRegimeLabel).toBe("Exploration (legacy)");
    expect(s.regimeOpenCap).toBe(40);
    expect(s.regimeMinEv).toBe(0.06);
  });

  it("surfaces raw package exploration fields", () => {
    const s = deriveRiskStatus(freshExploration);
    expect(s.staleRiskSchema).toBe(false);
    expect(s.bankrollRegime).toBe("exploration");
    expect(s.regimeOpenCap).toBe(50);
    expect(s.regimeMinEv).toBe(0.04);
  });
});

describe("regimeChipLabel", () => {
  it("uses short stable alias for legacy calibration", () => {
    expect(regimeChipLabel("Exploration (legacy)", "calibration")).toBe(
      "Expl. (legacy)"
    );
  });

  it("keeps full Exploration label", () => {
    expect(regimeChipLabel("Exploration", "exploration")).toBe("Exploration");
  });
});
