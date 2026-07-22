/**
 * HV v3 empty-slip taxonomy — starvation_kind mapping + funnel fallback.
 */
import { describe, expect, it } from "vitest";
import {
  classifyEmptySlip,
  emptySlipInputFromCoverage,
  funnelFromCoverage,
  isCoverageHealthLoaded,
  mapStarvationKind,
  type EmptySlipInput,
} from "./emptySlip";

function base(over: Partial<EmptySlipInput> = {}): EmptySlipInput {
  return {
    placeEmpty: true,
    level: "ok",
    empty_slip_risk: false,
    shortlist_with_deep_n: 4,
    shortlist_n: 6,
    coverageLoaded: true,
    ...over,
  };
}

describe("mapStarvationKind", () => {
  it("clearability_miss → isSuccess=false, kind clearability_miss", () => {
    const r = mapStarvationKind("clearability_miss", base());
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("clearability_miss");
    expect(r!.isSuccess).toBe(false);
    expect(r!.primaryCta.view).toBe("shortlist");
  });

  it("honest_no_edge → isSuccess=true", () => {
    const r = mapStarvationKind("honest_no_edge", base());
    expect(r!.kind).toBe("honest_no_edge");
    expect(r!.isSuccess).toBe(true);
  });

  it("coverage_critical → process_miss, isSuccess=false", () => {
    const r = mapStarvationKind("coverage_critical", base({ level: "critical" }));
    expect(r!.kind).toBe("process_miss");
    expect(r!.isSuccess).toBe(false);
  });

  it("research_starvation → no_research", () => {
    const r = mapStarvationKind("research_starvation", base({ shortlist_with_deep_n: 0 }));
    expect(r!.kind).toBe("no_research");
    expect(r!.isSuccess).toBe(false);
  });

  it("risk_block → risk_block, isSuccess=false", () => {
    const r = mapStarvationKind("risk_block", base());
    expect(r!.kind).toBe("risk_block");
    expect(r!.isSuccess).toBe(false);
    expect(r!.primaryCta.view).toBe("capital");
  });

  it("none / empty → null (fall through)", () => {
    expect(mapStarvationKind("none", base())).toBeNull();
    expect(mapStarvationKind("", base())).toBeNull();
    expect(mapStarvationKind(null, base())).toBeNull();
  });
});

describe("classifyEmptySlip — engine starvation_kind priority", () => {
  it("prefers clearability_miss over ok+deep celebrate path", () => {
    const r = classifyEmptySlip(
      base({
        level: "ok",
        shortlist_with_deep_n: 8,
        starvation_kind: "clearability_miss",
        funnel: { n_raw_ev_pass: 0, second_pass_ran: false, second_pass_completed: false },
      })
    );
    expect(r.kind).toBe("clearability_miss");
    expect(r.isSuccess).toBe(false);
    expect(r.starvation_kind).toBe("clearability_miss");
  });

  it("honest_no_edge from engine even when level empty", () => {
    const r = classifyEmptySlip(
      base({
        level: "",
        starvation_kind: "honest_no_edge",
        funnel: {
          n_raw_ev_pass: 0,
          second_pass_ran: true,
          second_pass_completed: true,
        },
      })
    );
    expect(r.kind).toBe("honest_no_edge");
    expect(r.isSuccess).toBe(true);
  });

  it("coverage_critical engine kind maps process_miss", () => {
    const r = classifyEmptySlip(
      base({
        level: "critical",
        starvation_kind: "coverage_critical",
        empty_slip_risk: true,
      })
    );
    expect(r.kind).toBe("process_miss");
    expect(r.isSuccess).toBe(false);
  });

  it("has_picks short-circuits before starvation_kind", () => {
    const r = classifyEmptySlip(
      base({
        placeEmpty: false,
        starvation_kind: "clearability_miss",
      })
    );
    expect(r.kind).toBe("has_picks");
    expect(r.isSuccess).toBe(false);
  });
});

describe("classifyEmptySlip — legacy fallback without starvation_kind", () => {
  it("ok + deep → honest_no_edge", () => {
    const r = classifyEmptySlip(base({ starvation_kind: null }));
    expect(r.kind).toBe("honest_no_edge");
    expect(r.isSuccess).toBe(true);
  });

  it("ok + deep + n_raw_ev_pass=0 + second_pass incomplete → clearability_miss", () => {
    const r = classifyEmptySlip(
      base({
        starvation_kind: null,
        funnel: {
          n_raw_ev_pass: 0,
          second_pass_ran: false,
          second_pass_completed: false,
        },
      })
    );
    expect(r.kind).toBe("clearability_miss");
    expect(r.isSuccess).toBe(false);
  });

  it("critical level → process_miss", () => {
    const r = classifyEmptySlip(
      base({ level: "critical", starvation_kind: undefined })
    );
    expect(r.kind).toBe("process_miss");
    expect(r.isSuccess).toBe(false);
  });

  it("warn → process_miss_soft", () => {
    const r = classifyEmptySlip(base({ level: "warn" }));
    expect(r.kind).toBe("process_miss_soft");
    expect(r.isSuccess).toBe(false);
  });

  it("coverage not loaded → coverage_unavailable", () => {
    const r = classifyEmptySlip(
      base({
        coverageLoaded: false,
        level: "",
        shortlist_with_deep_n: 0,
      })
    );
    expect(r.kind).toBe("coverage_unavailable");
    expect(r.isSuccess).toBe(false);
  });

  it("zero deep packs → no_research", () => {
    const r = classifyEmptySlip(
      base({ shortlist_with_deep_n: 0, level: "ok" })
    );
    expect(r.kind).toBe("no_research");
    expect(r.isSuccess).toBe(false);
  });
});

describe("emptySlipInputFromCoverage + funnel", () => {
  it("reads starvation_kind and top-level funnel fields", () => {
    const input = emptySlipInputFromCoverage(true, {
      level: "ok",
      shortlist_with_deep_n: 5,
      shortlist_n: 8,
      empty_slip_risk: false,
      starvation_kind: "clearability_miss",
      n_raw_ev_pass: 0,
      median_raw_ev: -0.04,
      clearable_track_share: 0,
      second_pass_ran: false,
    });
    expect(input.starvation_kind).toBe("clearability_miss");
    expect(input.funnel?.n_raw_ev_pass).toBe(0);
    expect(input.funnel?.median_raw_ev).toBe(-0.04);
    expect(input.funnel?.clearable_track_share).toBe(0);
    expect(input.funnel?.second_pass_ran).toBe(false);

    const r = classifyEmptySlip(input);
    expect(r.kind).toBe("clearability_miss");
    expect(r.isSuccess).toBe(false);
  });

  it("reads nested funnel block", () => {
    const f = funnelFromCoverage({
      level: "ok",
      funnel: {
        n_raw_ev_pass: 2,
        median_raw_ev: 0.03,
        clearable_track_share: 0.25,
        second_pass_ran: true,
      },
    });
    expect(f?.n_raw_ev_pass).toBe(2);
    expect(f?.second_pass_ran).toBe(true);
    expect(f?.clearable_track_share).toBe(0.25);
  });

  it("isCoverageHealthLoaded true when only starvation_kind present", () => {
    expect(isCoverageHealthLoaded({ starvation_kind: "honest_no_edge" })).toBe(
      true
    );
    expect(isCoverageHealthLoaded({})).toBe(false);
    expect(isCoverageHealthLoaded(null)).toBe(false);
  });
});
