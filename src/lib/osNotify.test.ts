/**
 * D18 OS notify transition / debounce unit tests.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateOsNotifyTransitions,
  isCoverageCriticalLevel,
  osNotifyCopy,
  OS_NOTIFY_DEBOUNCE_MS,
  type OsNotifyTrackedState,
} from "./osNotify";

const base = {
  demoMode: false,
  notifyCoverageCritical: true,
  notifyStaleRisk: true,
  nowMs: 1_000_000,
};

describe("isCoverageCriticalLevel", () => {
  it("matches critical case-insensitively", () => {
    expect(isCoverageCriticalLevel("critical")).toBe(true);
    expect(isCoverageCriticalLevel("CRITICAL")).toBe(true);
    expect(isCoverageCriticalLevel(" warn ")).toBe(false);
    expect(isCoverageCriticalLevel(null)).toBe(false);
    expect(isCoverageCriticalLevel(undefined)).toBe(false);
  });
});

describe("evaluateOsNotifyTransitions", () => {
  it("first observation baselines without firing (even if already critical)", () => {
    const r = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "critical",
      staleRiskSchema: true,
      prev: null,
    });
    expect(r.fire).toEqual([]);
    expect(r.next).toEqual({ coverageCritical: true, staleRisk: true });
  });

  it("fires once on rising edge to coverage critical", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "critical",
      staleRiskSchema: false,
      prev,
    });
    expect(r.fire).toEqual(["coverage_critical"]);
    expect(r.next.coverageCritical).toBe(true);
  });

  it("does not re-fire while still critical", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: true,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "critical",
      staleRiskSchema: false,
      prev,
      lastFiredAt: { coverage_critical: base.nowMs - 1_000 },
    });
    expect(r.fire).toEqual([]);
  });

  it("fires again after recovery then re-critical (outside debounce)", () => {
    const afterOk: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "critical",
      staleRiskSchema: false,
      prev: afterOk,
      lastFiredAt: {
        coverage_critical: base.nowMs - OS_NOTIFY_DEBOUNCE_MS - 1,
      },
    });
    expect(r.fire).toEqual(["coverage_critical"]);
  });

  it("debounces rapid critical re-entry", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "critical",
      staleRiskSchema: false,
      prev,
      lastFiredAt: { coverage_critical: base.nowMs - 5_000 },
    });
    expect(r.fire).toEqual([]);
  });

  it("fires stale risk on rising edge only when enabled", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const on = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "ok",
      staleRiskSchema: true,
      prev,
    });
    expect(on.fire).toEqual(["stale_risk"]);

    const off = evaluateOsNotifyTransitions({
      ...base,
      notifyStaleRisk: false,
      coverageLevel: "ok",
      staleRiskSchema: true,
      prev,
    });
    expect(off.fire).toEqual([]);
  });

  it("respects notifyCoverageCritical off", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      notifyCoverageCritical: false,
      coverageLevel: "critical",
      staleRiskSchema: false,
      prev,
    });
    expect(r.fire).toEqual([]);
  });

  it("demo mode is silent even when flags on and edge rises", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      demoMode: true,
      coverageLevel: "critical",
      staleRiskSchema: true,
      prev,
    });
    expect(r.fire).toEqual([]);
    // still advances next so we do not backlog fires after leaving demo
    expect(r.next).toEqual({ coverageCritical: true, staleRisk: true });
  });

  it("can fire both kinds on the same evaluation", () => {
    const prev: OsNotifyTrackedState = {
      coverageCritical: false,
      staleRisk: false,
    };
    const r = evaluateOsNotifyTransitions({
      ...base,
      coverageLevel: "critical",
      staleRiskSchema: true,
      prev,
    });
    expect(r.fire).toEqual(["coverage_critical", "stale_risk"]);
  });
});

describe("osNotifyCopy", () => {
  it("has no bet-detail fields in body", () => {
    for (const kind of ["coverage_critical", "stale_risk"] as const) {
      const { title, body } = osNotifyCopy(kind);
      expect(title.length).toBeGreaterThan(0);
      expect(body).not.toMatch(/odds|stake|selection|bet_id/i);
    }
  });
});
