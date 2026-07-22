/**
 * Run-stake room parsers — engine fields only (no invented caps).
 */
import { describe, expect, it } from "vitest";
import {
  parseRunStakeFromPlaceThese,
  resolveRunStakeRoom,
  runStakeChipLabel,
  runStakeFromRecord,
} from "./runStake";
import type { TrackerSnapshot } from "@/types";

const PLACE_MD = `# Bets to place — 2026-07-22

Phase **1A** | Equity **500.00** | Remaining risk **40.00** / cap **40.00**

Run stake: used **30** / cap **40** (equity cap **100**, remaining risk **40**) · binding: **phase_remaining**

| # | Match | Selection | Odds | Stake NOK | EV | Grade | Band |
|---|-------|-----------|------|-----------|----|-------|------|
| 1 | A vs B | Home | 2.00 | 10 | 0.05 | B | 1.8-2.2 |
`;

describe("parseRunStakeFromPlaceThese", () => {
  it("parses used/cap/binding from engine PLACE markdown", () => {
    const r = parseRunStakeFromPlaceThese(PLACE_MD);
    expect(r).not.toBeNull();
    expect(r!.used_nok).toBe(30);
    expect(r!.cap_nok).toBe(40);
    expect(r!.equity_cap_nok).toBe(100);
    expect(r!.remaining_risk_nok).toBe(40);
    expect(r!.binding).toBe("phase_remaining");
    expect(r!.source).toBe("place_these");
  });

  it("returns null when no run stake line", () => {
    expect(parseRunStakeFromPlaceThese("# empty\n")).toBeNull();
    expect(parseRunStakeFromPlaceThese(null)).toBeNull();
  });
});

describe("runStakeFromRecord", () => {
  it("reads flat run_stake_* keys", () => {
    const r = runStakeFromRecord(
      {
        run_stake_cap_nok: 40,
        run_stake_used_nok: 0,
        run_stake_binding: "equity_pct",
      },
      "risk"
    );
    expect(r!.cap_nok).toBe(40);
    expect(r!.used_nok).toBe(0);
    expect(r!.binding).toBe("equity_pct");
    expect(r!.source).toBe("risk");
  });

  it("reads nested run_stake object", () => {
    const r = runStakeFromRecord(
      {
        run_stake: {
          run_stake_cap_nok: 50,
          run_stake_used_nok: 10,
          run_stake_binding: "regime_open",
        },
      },
      "stake_decisions"
    );
    expect(r!.cap_nok).toBe(50);
    expect(r!.binding).toBe("regime_open");
  });
});

describe("resolveRunStakeRoom priority", () => {
  it("prefers PLACE_THESE over risk", () => {
    const snap = {
      place_these: PLACE_MD,
      risk: {
        run_stake_cap_nok: 99,
        run_stake_used_nok: 1,
        run_stake_binding: "other",
      },
      stake_decisions: [],
    } as unknown as TrackerSnapshot;
    const r = resolveRunStakeRoom(snap);
    expect(r!.cap_nok).toBe(40);
    expect(r!.source).toBe("place_these");
  });

  it("falls back to stake_decisions then risk", () => {
    const snap = {
      place_these: "",
      stake_decisions: [
        {
          run_stake_cap_nok: 40,
          run_stake_used_nok: 20,
          run_stake_binding: "phase_remaining",
        },
      ],
      risk: {},
    } as unknown as TrackerSnapshot;
    const r = resolveRunStakeRoom(snap);
    expect(r!.used_nok).toBe(20);
    expect(r!.source).toBe("stake_decisions");
  });
});

describe("runStakeChipLabel", () => {
  it("formats used/cap/binding", () => {
    expect(
      runStakeChipLabel({
        cap_nok: 40,
        used_nok: 30,
        binding: "phase_remaining",
        source: "place_these",
      })
    ).toBe("Run 30/40 · phase_remaining");
  });
});
