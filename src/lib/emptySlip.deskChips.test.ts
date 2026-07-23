/**
 * DeskStrip progressive chips: EV-RELAX + CFLOOR (+ COV) from engine fields only.
 */
import { describe, expect, it } from "vitest";
import type { ControlSignal, CoverageHealth } from "@/types";
import {
  activeForceCoverageSignals,
  coverageFloorChip,
  coverageStripChip,
  deskStripCoverageChips,
  tempEvRelaxChip,
} from "./emptySlip";
import {
  activeControlSignals,
  activeTempEvRelax,
  tempEvRelaxOverlay,
} from "./phaseRadar";

const NOW = Date.parse("2026-07-23T12:00:00Z");
const FUTURE = "2026-07-24T12:00:00Z";
const PAST = "2026-07-22T12:00:00Z";

describe("activeTempEvRelax", () => {
  it("returns empty when no signals", () => {
    expect(activeTempEvRelax(null, NOW)).toEqual([]);
    expect(activeTempEvRelax([], NOW)).toEqual([]);
  });

  it("picks non-expired temp_ev_relax with delta/line_keys", () => {
    const signals: ControlSignal[] = [
      {
        kind: "temp_ev_relax",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        delta_ev: 0.015,
        stake_mult: 0.8,
        line_keys: ["a|b|c", "x|y|z"],
        source: "empty_deep_queue",
      },
      {
        kind: "temp_gate_raise",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        sport: "football",
        min_ev_raise: 0.02,
      },
    ];
    const active = activeTempEvRelax(signals, NOW);
    expect(active).toHaveLength(1);
    expect(active[0].kind).toBe("temp_ev_relax");
    expect(active[0].delta_ev).toBe(0.015);
  });

  it("drops expired and sport-only revoke does not clear", () => {
    const signals: ControlSignal[] = [
      {
        kind: "temp_ev_relax",
        ts: "2026-07-21T10:00:00Z",
        expires_at: PAST,
        delta_ev: 0.02,
        line_keys: ["a"],
      },
      {
        kind: "temp_ev_relax",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        delta_ev: 0.01,
        stake_mult: 0.8,
        line_keys: ["b"],
      },
      {
        kind: "revoke",
        ts: "2026-07-23T11:00:00Z",
        sport: "football",
        reason: "sport only",
      },
    ];
    const active = activeTempEvRelax(signals, NOW);
    expect(active).toHaveLength(1);
    expect(active[0].line_keys).toEqual(["b"]);
  });

  it("clears on kind-scoped revoke", () => {
    const signals: ControlSignal[] = [
      {
        kind: "temp_ev_relax",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        delta_ev: 0.02,
        line_keys: ["a"],
      },
      {
        kind: "revoke",
        ts: "2026-07-23T11:00:00Z",
        revoke_kinds: ["temp_ev_relax"],
      },
    ];
    expect(activeTempEvRelax(signals, NOW)).toEqual([]);
  });
});

describe("tempEvRelaxChip / overlay", () => {
  it("returns null when inactive", () => {
    expect(tempEvRelaxChip([], NOW)).toBeNull();
    expect(tempEvRelaxOverlay([], NOW).active).toBe(false);
    expect(tempEvRelaxOverlay([], NOW).stake_mult).toBeNull();
  });

  it("surfaces delta, stake, expires, line count in tooltip", () => {
    const signals: ControlSignal[] = [
      {
        kind: "temp_ev_relax",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        delta_ev: 0.02,
        stake_mult: 0.8,
        line_keys: ["k1", "k2", "k3"],
        source: "coverage_floor_empty_queue",
      },
    ];
    const chip = tempEvRelaxChip(signals, NOW);
    expect(chip).not.toBeNull();
    expect(chip!.label).toBe("EV-RELAX");
    expect(chip!.tone).toBe("warn");
    expect(chip!.title).toContain("ΔEV −0.020");
    expect(chip!.title).toContain("stake×0.80");
    expect(chip!.title).toContain(FUTURE);
    expect(chip!.title).toContain("lines 3");
    expect(chip!.title).toContain("coverage_floor_empty_queue");
    expect(tempEvRelaxOverlay(signals, NOW).stake_mult).toBe(0.8);
  });

  it("omits stake× when engine did not stamp stake_mult (no invented 1.00)", () => {
    const signals: ControlSignal[] = [
      {
        kind: "temp_ev_relax",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        delta_ev: 0.015,
        line_keys: ["only-delta"],
        source: "empty_deep_queue",
      },
    ];
    const ov = tempEvRelaxOverlay(signals, NOW);
    expect(ov.active).toBe(true);
    expect(ov.stake_mult).toBeNull();
    const chip = tempEvRelaxChip(signals, NOW);
    expect(chip).not.toBeNull();
    expect(chip!.title).toContain("ΔEV −0.015");
    expect(chip!.title).not.toMatch(/stake×/);
    expect(chip!.title).not.toContain("1.00");
  });
});

describe("activeControlSignals (temp_gate_raise only + revoke hygiene)", () => {
  const gate: ControlSignal = {
    kind: "temp_gate_raise",
    ts: "2026-07-23T10:00:00Z",
    expires_at: FUTURE,
    sport: "football",
    market: "1x2",
    min_ev_raise: 0.02,
  };

  it("returns only temp_gate_raise (never temp_ev_relax / force)", () => {
    const signals: ControlSignal[] = [
      gate,
      {
        kind: "temp_ev_relax",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        delta_ev: 0.01,
        line_keys: ["a"],
      },
      {
        kind: "force_coverage_priority",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        sport: "coverage",
      },
    ];
    const active = activeControlSignals(signals, NOW);
    expect(active).toHaveLength(1);
    expect(active.every((s) => s.kind === "temp_gate_raise")).toBe(true);
  });

  it("revoke_kinds temp_ev_relax does not drop gates", () => {
    const signals: ControlSignal[] = [
      gate,
      {
        kind: "revoke",
        ts: "2026-07-23T11:00:00Z",
        revoke_kinds: ["temp_ev_relax"],
      },
    ];
    expect(activeControlSignals(signals, NOW)).toHaveLength(1);
  });

  it("revoke_kinds temp_gate_raise drops gates", () => {
    const signals: ControlSignal[] = [
      gate,
      {
        kind: "revoke",
        ts: "2026-07-23T11:00:00Z",
        revoke_kinds: ["temp_gate_raise"],
      },
    ];
    expect(activeControlSignals(signals, NOW)).toEqual([]);
  });

  it("signal_kind temp_ev_relax does not drop gates; signal_kind temp_gate_raise does", () => {
    expect(
      activeControlSignals(
        [
          gate,
          {
            kind: "revoke",
            ts: "2026-07-23T11:00:00Z",
            signal_kind: "temp_ev_relax",
          },
        ],
        NOW
      )
    ).toHaveLength(1);
    expect(
      activeControlSignals(
        [
          gate,
          {
            kind: "revoke",
            ts: "2026-07-23T11:00:00Z",
            signal_kind: "temp_gate_raise",
          },
        ],
        NOW
      )
    ).toEqual([]);
  });

  it("sport-only revoke still drops matching gate", () => {
    const signals: ControlSignal[] = [
      gate,
      {
        kind: "temp_gate_raise",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        sport: "tennis",
        min_ev_raise: 0.01,
      },
      {
        kind: "revoke",
        ts: "2026-07-23T11:00:00Z",
        sport: "football",
      },
    ];
    const active = activeControlSignals(signals, NOW);
    expect(active).toHaveLength(1);
    expect(active[0].sport).toBe("tennis");
  });
});

describe("coverageFloorChip", () => {
  it("null when coverage empty and no signals", () => {
    expect(coverageFloorChip(null, [], NOW)).toBeNull();
    expect(coverageFloorChip({}, [], NOW)).toBeNull();
  });

  it("shows CFLOOR from coverage_floor audit scaffolds", () => {
    const cov: CoverageHealth = {
      level: "ok",
      shortlist_with_deep_n: 2,
      coverage_floor: {
        enabled: true,
        scaffold_tagged_n: 4,
        sport_rotation_tagged_n: 1,
        deep_target_n_effective: 10,
      },
    };
    const chip = coverageFloorChip(cov, [], NOW);
    expect(chip).not.toBeNull();
    expect(chip!.label).toBe("CFLOOR");
    expect(chip!.title).toContain("scaffold tags 4");
    expect(chip!.title).toContain("sport rotation 1");
    expect(chip!.title).toContain("deep_target_n_effective 10");
  });

  it("shows CFLOOR when force_coverage_active", () => {
    const cov: CoverageHealth = {
      level: "warn",
      shortlist_with_deep_n: 0,
      force_coverage_active: true,
      force_coverage_signal: {
        target_odds_band: "1.85-2.60",
        expires_at: FUTURE,
      },
    };
    const chip = coverageFloorChip(cov, [], NOW);
    expect(chip).not.toBeNull();
    expect(chip!.title).toContain("force_coverage active");
    expect(chip!.title).toContain("1.85-2.60");
    expect(chip!.tone).toBe("warn");
  });

  it("shows CFLOOR from active force_coverage_priority signal", () => {
    const signals: ControlSignal[] = [
      {
        kind: "force_coverage_priority",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        sport: "coverage",
      },
    ];
    const chip = coverageFloorChip({ level: "ok", shortlist_n: 1 }, signals, NOW);
    expect(chip).not.toBeNull();
    expect(chip!.title).toContain("force_coverage active");
  });

  it("shows CFLOOR on warn/critical level pressure", () => {
    const warn = coverageFloorChip(
      { level: "warn", shortlist_with_deep_n: 1, updated_at: "2026-07-23" },
      [],
      NOW
    );
    expect(warn).not.toBeNull();
    expect(warn!.title).toContain("coverage warn");
    expect(warn!.tone).toBe("warn");

    const crit = coverageFloorChip(
      {
        level: "critical",
        empty_slip_risk: true,
        shortlist_with_deep_n: 0,
        updated_at: "2026-07-23",
      },
      [],
      NOW
    );
    expect(crit).not.toBeNull();
    expect(crit!.tone).toBe("loss");
    expect(crit!.title).toContain("empty_slip_risk");
  });

  it("stays quiet on ok level without floor activity", () => {
    expect(
      coverageFloorChip(
        { level: "ok", shortlist_with_deep_n: 4, updated_at: "2026-07-23" },
        [],
        NOW
      )
    ).toBeNull();
  });

  it("does not show CFLOOR for enabled-only floor with zero tags and ok level", () => {
    expect(
      coverageFloorChip(
        {
          level: "ok",
          shortlist_with_deep_n: 3,
          coverage_floor: { enabled: true, scaffold_tagged_n: 0 },
        },
        [],
        NOW
      )
    ).toBeNull();
  });
});

describe("coverageStripChip + deskStripCoverageChips", () => {
  it("COV chip when loaded", () => {
    const chip = coverageStripChip({
      level: "ok",
      shortlist_deep_pct: 0.67,
      shortlist_with_deep_n: 4,
    });
    expect(chip).not.toBeNull();
    expect(chip!.label).toBe("COV OK");
    expect(chip!.tone).toBe("ok");
    expect(chip!.title).toContain("67% deep");
  });

  it("null COV when not loaded", () => {
    expect(coverageStripChip(null)).toBeNull();
    expect(coverageStripChip({})).toBeNull();
  });

  it("stacks COV + CFLOOR + EV-RELAX when all active", () => {
    const chips = deskStripCoverageChips(
      {
        level: "warn",
        shortlist_with_deep_n: 1,
        shortlist_deep_pct: 0.2,
        updated_at: "2026-07-23",
        coverage_floor: { scaffold_tagged_n: 2, deep_target_n_effective: 12 },
      },
      [
        {
          kind: "temp_ev_relax",
          ts: "2026-07-23T10:00:00Z",
          expires_at: FUTURE,
          delta_ev: 0.015,
          stake_mult: 0.8,
          line_keys: ["a"],
        },
      ] as ControlSignal[],
      NOW
    );
    expect(chips.map((c) => c.label)).toEqual([
      "COV WARN",
      "CFLOOR",
      "EV-RELAX",
    ]);
  });

  it("activeForceCoverageSignals filters expired", () => {
    const signals: ControlSignal[] = [
      { kind: "force_coverage_priority", expires_at: PAST },
      { kind: "force_coverage_priority", expires_at: FUTURE },
    ];
    expect(activeForceCoverageSignals(signals, NOW)).toHaveLength(1);
  });

  it("activeForceCoverageSignals honors kind-scoped and global revokes", () => {
    const live: ControlSignal = {
      kind: "force_coverage_priority",
      ts: "2026-07-23T10:00:00Z",
      expires_at: FUTURE,
      sport: "coverage",
    };
    expect(
      activeForceCoverageSignals(
        [
          live,
          {
            kind: "revoke",
            ts: "2026-07-23T11:00:00Z",
            revoke_kinds: ["force_coverage_priority"],
          },
        ],
        NOW
      )
    ).toEqual([]);
    expect(
      activeForceCoverageSignals(
        [
          live,
          {
            kind: "revoke",
            ts: "2026-07-23T11:00:00Z",
            signal_kind: "force_coverage_priority",
          },
        ],
        NOW
      )
    ).toEqual([]);
    expect(
      activeForceCoverageSignals(
        [
          live,
          {
            kind: "revoke",
            ts: "2026-07-23T11:00:00Z",
            revoke_all: true,
          },
        ],
        NOW
      )
    ).toEqual([]);
    // temp_ev_relax kind revoke must not clear force coverage
    expect(
      activeForceCoverageSignals(
        [
          live,
          {
            kind: "revoke",
            ts: "2026-07-23T11:00:00Z",
            revoke_kinds: ["temp_ev_relax"],
          },
        ],
        NOW
      )
    ).toHaveLength(1);
  });

  it("CFLOOR drops force-from-signal after force_coverage_priority revoke", () => {
    const signals: ControlSignal[] = [
      {
        kind: "force_coverage_priority",
        ts: "2026-07-23T10:00:00Z",
        expires_at: FUTURE,
        sport: "coverage",
      },
      {
        kind: "revoke",
        ts: "2026-07-23T11:00:00Z",
        revoke_kinds: ["force_coverage_priority"],
      },
    ];
    // ok level, no floor audit, force only via signal → quiet after revoke
    expect(
      coverageFloorChip(
        { level: "ok", shortlist_n: 1, updated_at: "2026-07-23" },
        signals,
        NOW
      )
    ).toBeNull();
  });
});
