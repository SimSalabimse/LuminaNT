import { describe, expect, it } from "vitest";
import type { ReasoningChain } from "@/types";
import {
  isNearMissOrRejected,
  listNearMissChains,
  resolveReasoningChain,
  simpleModeSummary,
  trafficLightFromChain,
} from "./resolveReasoningChain";

const chains: ReasoningChain[] = [
  {
    reasoning_chain_id: "rc1",
    bet_id: "bet-aaa",
    match: "Alpha vs Beta",
    selection: "Over 2.5",
    day: "2026-07-22",
    kind: "recommended",
    traffic_light: "green",
    summary: "Clear mid-odds totals edge.",
    decision: "place",
  },
  {
    reasoning_chain_id: "rc2",
    bet_id: null,
    match: "Gamma vs Delta",
    selection: "BTTS Yes",
    day: "2026-07-22",
    kind: "near_miss",
    traffic_light: "amber",
    summary: "Near-miss under min-EV.",
  },
  {
    reasoning_chain_id: "rc3",
    match: "Epsilon vs Zeta",
    selection: "Home",
    day: "2026-07-21",
    kind: "rejected_low_odds",
    decision: "reject",
  },
];

describe("resolveReasoningChain", () => {
  it("joins by bet_id first", () => {
    const hit = resolveReasoningChain(chains, { betId: "bet-aaa" });
    expect(hit?.reasoning_chain_id).toBe("rc1");
  });

  it("joins by reasoning_chain_id", () => {
    const hit = resolveReasoningChain(chains, {
      reasoningChainId: "rc2",
    });
    expect(hit?.kind).toBe("near_miss");
  });

  it("joins by match + selection + day", () => {
    const hit = resolveReasoningChain(chains, {
      match: "Gamma vs Delta",
      selection: "BTTS Yes",
      day: "2026-07-22",
    });
    expect(hit?.reasoning_chain_id).toBe("rc2");
  });

  it("joins by match + selection when day missing", () => {
    const hit = resolveReasoningChain(chains, {
      match: "Epsilon vs Zeta",
      selection: "Home",
    });
    expect(hit?.kind).toBe("rejected_low_odds");
  });

  it("returns null when no match", () => {
    expect(
      resolveReasoningChain(chains, {
        betId: "missing",
        match: "Nope",
        selection: "x",
      })
    ).toBeNull();
  });

  it("tolerates empty / null chains", () => {
    expect(resolveReasoningChain(null, { betId: "x" })).toBeNull();
    expect(resolveReasoningChain([], { betId: "x" })).toBeNull();
  });
});

describe("trafficLightFromChain", () => {
  it("maps green / amber / red / gray", () => {
    expect(trafficLightFromChain(chains[0])).toBe("green");
    expect(trafficLightFromChain(chains[1])).toBe("amber");
    expect(trafficLightFromChain(chains[2])).toBe("red");
    expect(trafficLightFromChain(null)).toBe("gray");
    expect(trafficLightFromChain({})).toBe("gray");
  });

  it("maps decision tokens", () => {
    expect(trafficLightFromChain({ decision: "place" })).toBe("green");
    expect(trafficLightFromChain({ decision: "blocked" })).toBe("red");
    expect(trafficLightFromChain({ kind: "near_miss" })).toBe("amber");
  });
});

describe("simpleModeSummary + near-miss list", () => {
  it("prefers engine summary", () => {
    expect(simpleModeSummary(chains[0])).toContain("mid-odds");
    expect(simpleModeSummary(null)).toMatch(/No reasoning chain/i);
  });

  it("lists near_miss and rejected_* only", () => {
    const list = listNearMissChains(chains);
    expect(list).toHaveLength(2);
    expect(list.every(isNearMissOrRejected)).toBe(true);
    expect(list[0].kind).toBe("near_miss");
  });
});
