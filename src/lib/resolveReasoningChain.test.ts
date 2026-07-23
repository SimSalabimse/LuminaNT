import { describe, expect, it } from "vitest";
import type { ReasoningChain } from "@/types";
import {
  chainCompleteness,
  gradeTone,
  haircutEvOf,
  isNearMissOrRejected,
  isRecommendedKind,
  listNearMissChains,
  resolveReasoningChain,
  simpleModeSummary,
  stakeNokOf,
  trafficLightFromChain,
  unitNokOf,
  whyNotText,
  whyThisText,
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

/** Appendix A — live engine pick shape */
const appendixA: ReasoningChain = {
  schema_version: 1,
  kind: "pick",
  match: "van Duijvenbode, Dirk vs Anderson, Gary",
  selection: "Runde handikap 3.5: van Duijvenbode, Dirk +3.5",
  decimal_odds: 1.85,
  grade: "B",
  p_model: 0.6,
  haircut: 0.03,
  ev: 0.1095,
  ev_after_haircut: 0.0545,
  stake_nok: 16.0,
  bet_id: null,
  controls: { size_mode: "NORMAL", unit_nok: 12.0, explore: true },
  reasons: ["explore market:Handicap n=1"],
  light: { verdict: "pass", promotion_score: 157.6 },
};

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

  it("fallthrough: betId miss + matching match/selection → hit", () => {
    const live: ReasoningChain[] = [
      {
        ...appendixA,
        reasoning_chain_id: "rc_live_pick",
        bet_id: null,
      },
    ];
    const hit = resolveReasoningChain(live, {
      betId: "pending-not-yet-acked",
      match: appendixA.match,
      selection: appendixA.selection,
    });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe("pick");
    expect(hit?.reasoning_chain_id).toBe("rc_live_pick");
  });
});

describe("isRecommendedKind", () => {
  it("includes pick and recommended aliases", () => {
    expect(isRecommendedKind("pick")).toBe(true);
    expect(isRecommendedKind("recommended")).toBe(true);
    expect(isRecommendedKind("placed")).toBe(true);
    expect(isRecommendedKind("place")).toBe(true);
    expect(isRecommendedKind("accepted")).toBe(true);
    expect(isRecommendedKind("near_miss")).toBe(false);
    expect(isRecommendedKind(null)).toBe(false);
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

  it("maps decision tokens when kind is absent", () => {
    expect(trafficLightFromChain({ decision: "place" })).toBe("green");
    expect(trafficLightFromChain({ decision: "blocked" })).toBe("red");
    expect(trafficLightFromChain({ kind: "near_miss" })).toBe("amber");
  });

  it("kind pick → green; never gray for pick", () => {
    expect(trafficLightFromChain(appendixA)).toBe("green");
    expect(trafficLightFromChain({ kind: "pick" })).toBe("green");
  });

  it("near_miss with light.verdict pass stays amber (never green from verdict)", () => {
    expect(
      trafficLightFromChain({
        kind: "near_miss",
        light: { verdict: "pass" },
        reject_reason: "below min EV",
      })
    ).toBe("amber");
  });
});

describe("haircutEvOf / unitNokOf / stakeNokOf", () => {
  it("reads ev_after_haircut when haircut_ev missing", () => {
    expect(haircutEvOf(appendixA)).toBeCloseTo(0.0545);
    expect(haircutEvOf({ haircut_ev: 0.042 })).toBeCloseTo(0.042);
    expect(haircutEvOf({ ev: 0.1 })).toBeNull(); // never invent from raw ev
    expect(haircutEvOf(null)).toBeNull();
  });

  it("reads unit from controls.unit_nok", () => {
    expect(unitNokOf(appendixA)).toBe(12);
    expect(unitNokOf({ unit_nok: 10 })).toBe(10);
    expect(unitNokOf({})).toBeNull();
  });

  it("reads stake_nok", () => {
    expect(stakeNokOf(appendixA)).toBe(16);
  });
});

describe("chainCompleteness", () => {
  it("Appendix A pick with p_model + ev_after_haircut + stake → full", () => {
    const c = chainCompleteness(appendixA);
    expect(c.status).toBe("full");
    expect(c.missing).toEqual([]);
    expect(c.banner).toBeNull();
  });

  it("missing summary does not Partial", () => {
    const noSummary = { ...appendixA };
    delete (noSummary as { summary?: string }).summary;
    expect(chainCompleteness(noSummary).status).toBe("full");
  });

  it("missing p_model on pick → Partial includes p_model", () => {
    const c = chainCompleteness({
      kind: "pick",
      ev_after_haircut: 0.05,
      stake_nok: 10,
    });
    expect(c.status).toBe("partial");
    expect(c.missing).toContain("p_model");
  });

  it("near_miss is never partial banner", () => {
    expect(
      chainCompleteness({ kind: "near_miss", reject_reason: "x" }).status
    ).toBe("full");
  });

  it("absent chain", () => {
    expect(chainCompleteness(null).status).toBe("absent");
  });
});

describe("simpleModeSummary + why* + near-miss list", () => {
  it("prefers engine summary", () => {
    expect(simpleModeSummary(chains[0])).toContain("mid-odds");
    expect(simpleModeSummary(null)).toMatch(/No reasoning chain/i);
  });

  it("Appendix A summary from reasons — not bare pick / UNKNOWN", () => {
    const s = simpleModeSummary(appendixA);
    expect(s.toLowerCase()).toContain("explore");
    expect(s.toLowerCase()).not.toBe("pick");
    expect(s).not.toMatch(/UNKNOWN/i);
  });

  it("why this from reasons; why not empty OK for picks", () => {
    expect(whyThisText(appendixA)).toContain("explore");
    expect(whyNotText(appendixA)).toBe("");
  });

  it("why not from reject_reason for near_miss", () => {
    expect(
      whyNotText({
        kind: "near_miss",
        reject_reason: "under min-EV floor",
      })
    ).toBe("under min-EV floor");
  });

  it("lists near_miss and rejected_* only", () => {
    const list = listNearMissChains(chains);
    expect(list).toHaveLength(2);
    expect(list.every(isNearMissOrRejected)).toBe(true);
    expect(list[0].kind).toBe("near_miss");
  });

  it("does not list pick in near-miss list", () => {
    expect(listNearMissChains([appendixA, ...chains])).toHaveLength(2);
  });
});

describe("gradeTone", () => {
  it("maps A/B/C/other", () => {
    expect(gradeTone("A").tone).toBe("ok");
    expect(gradeTone("B").tone).toBe("primary");
    expect(gradeTone("C").tone).toBe("warn");
    expect(gradeTone("D").tone).toBe("loss");
    expect(gradeTone(null).tone).toBe("neutral");
  });
});
