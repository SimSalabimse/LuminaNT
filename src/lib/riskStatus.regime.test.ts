/**
 * PR1 fixture tests: isStaleRiskSchema + regimeProgressChip.
 * PR6: weeklyExploreQuotaChip (engine used/max + EV window).
 * Design A.4 — never map calibration_exit → Exploration 40.
 */
import { describe, expect, it } from "vitest";
import {
  deriveRiskStatus,
  isStaleRiskSchema,
  regimeChipLabel,
  regimeProgressChip,
  weeklyExploreQuotaChip,
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
  regime_explore_min_ev: 0.02,
  regime_explore_max_ev: 0.04,
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


describe("weeklyExploreQuotaChip", () => {
  it("surfaces engine used/max + EV window for fresh Exploration", () => {
    const chip = weeklyExploreQuotaChip(freshExploration);
    expect(chip).not.toBeNull();
    expect(chip!.used).toBe(0);
    expect(chip!.max).toBe(2);
    expect(chip!.quotaLabel).toBe("0/2");
    expect(chip!.label).toBe("Explore 0/2");
    expect(chip!.evWindowLabel).toBe("EV 2%–4%");
    expect(chip!.minEv).toBe(0.02);
    expect(chip!.maxEv).toBe(0.04);
    expect(chip!.derived).toBe(false);
  });

  it("hides when max is 0 (Survival / Normal package write)", () => {
    expect(weeklyExploreQuotaChip(survivalPackage)).toBeNull();
    expect(weeklyExploreQuotaChip(normalPackage)).toBeNull();
    expect(
      weeklyExploreQuotaChip({
        bankroll_regime: "exploration",
        regime_weekly_explore_max: 0,
        regime_weekly_explore_used: 0,
      })
    ).toBeNull();
  });

  it("hides when fields missing (stale or non-stale — no invent)", () => {
    expect(weeklyExploreQuotaChip(staleCalibration)).toBeNull();
    expect(
      weeklyExploreQuotaChip({
        capital_v2_enabled: true,
        bankroll_regime: "exploration",
        // no regime_weekly_explore_max
      })
    ).toBeNull();
    expect(
      weeklyExploreQuotaChip(
        {
          bankroll_regime: "exploration",
          // missing max
        },
        { stale: true }
      )
    ).toBeNull();
  });

  it("hides outside Exploration even if max > 0", () => {
    expect(
      weeklyExploreQuotaChip({
        bankroll_regime: "survival",
        regime_weekly_explore_max: 2,
        regime_weekly_explore_used: 1,
      })
    ).toBeNull();
  });

  it("defaults used to 0 when max present but used absent", () => {
    const chip = weeklyExploreQuotaChip({
      bankroll_regime: "exploration",
      regime_weekly_explore_max: 2,
    });
    expect(chip).not.toBeNull();
    expect(chip!.used).toBe(0);
    expect(chip!.quotaLabel).toBe("0/2");
    expect(chip!.evWindowLabel).toBeNull();
  });

  it("shows partial EV window when only min or max present", () => {
    expect(
      weeklyExploreQuotaChip({
        bankroll_regime: "exploration",
        regime_weekly_explore_max: 2,
        regime_weekly_explore_used: 1,
        regime_explore_min_ev: 0.02,
      })!.evWindowLabel
    ).toBe("EV ≥2%");
    expect(
      weeklyExploreQuotaChip({
        bankroll_regime: "exploration",
        regime_weekly_explore_max: 2,
        regime_weekly_explore_used: 1,
        regime_explore_max_ev: 0.04,
      })!.evWindowLabel
    ).toBe("EV ≤4%");
  });

  it("matches exploration via nested regime id", () => {
    const chip = weeklyExploreQuotaChip({
      regime: { id: "exploration" },
      regime_weekly_explore_max: 2,
      regime_weekly_explore_used: 1,
    });
    expect(chip).not.toBeNull();
    expect(chip!.label).toBe("Explore 1/2");
  });
});
