import { describe, expect, it } from "vitest";
import { drawdownAxisMax, equityAxisBounds } from "@/lib/charts";

describe("equityAxisBounds", () => {
  it("does not micro-zoom into a 0.80 NOK band around 500 baseline", () => {
    // Live early-era shape: one settlement day 499.20, HWM 500
    const b = equityAxisBounds([499.2], [500], 500);
    const span = b.max - b.min;
    expect(span).toBeGreaterThanOrEqual(25);
    expect(b.min).toBeLessThanOrEqual(499.2);
    expect(b.max).toBeGreaterThanOrEqual(500);
    // Baseline visible with room — not [499.20, 500.00]
    expect(b.min).toBeLessThan(495);
  });

  it("widens for large drawdowns without clamping to tiny pad", () => {
    const b = equityAxisBounds([400, 520], [520], 500);
    expect(b.min).toBeLessThanOrEqual(400);
    expect(b.max).toBeGreaterThanOrEqual(520);
  });
});

describe("drawdownAxisMax", () => {
  it("uses a tight axis when DD is near zero (not a flat 12% band)", () => {
    expect(drawdownAxisMax([0.16])).toBe(2);
    expect(drawdownAxisMax([0])).toBe(2);
  });

  it("expands for real DD", () => {
    expect(drawdownAxisMax([2.1])).toBe(5);
    expect(drawdownAxisMax([4.2])).toBe(10);
    expect(drawdownAxisMax([11])).toBeGreaterThanOrEqual(12);
  });
});
