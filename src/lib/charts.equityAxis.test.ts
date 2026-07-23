import { describe, expect, it } from "vitest";
import {
  drawdownAxisMax,
  equityAxisBounds,
  isSparseCategoryCount,
  sparseCategoryAxis,
} from "@/lib/charts";

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

describe("sparseCategoryAxis", () => {
  it("pads a single day so the series is not glued left", () => {
    const ax = sparseCategoryAxis(["2026-07-23"]);
    expect(ax.sparse).toBe(true);
    expect(ax.boundaryGap).toBe(true);
    expect(ax.data.length).toBe(5); // 2 blank + 1 + 2 blank
    expect(ax.data.filter(Boolean)).toEqual(["2026-07-23"]);
    expect(ax.seriesIndex(0)).toBe(2);
    // No zoom slider when sparse
    const zoom = ax.dataZoom as { type?: string }[];
    expect(zoom.some((z) => z.type === "slider")).toBe(false);
    const padded = ax.padSeries([499.2], null as unknown as number);
    expect(padded).toEqual([null, null, 499.2, null, null]);
  });

  it("does not pad long histories", () => {
    const days = Array.from({ length: 14 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
    const ax = sparseCategoryAxis(days);
    expect(ax.sparse).toBe(false);
    expect(ax.data).toEqual(days);
    expect(ax.boundaryGap).toBe(false);
    const zoom = ax.dataZoom as { type?: string }[];
    expect(zoom.some((z) => z.type === "slider")).toBe(true);
  });

  it("isSparseCategoryCount threshold", () => {
    expect(isSparseCategoryCount(1)).toBe(true);
    expect(isSparseCategoryCount(7)).toBe(true);
    expect(isSparseCategoryCount(8)).toBe(false);
  });
});
