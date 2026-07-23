import { describe, expect, it } from "vitest";
import {
  openRiskBySportOption,
  preferOpenRiskBars,
  riskHeatmapOption,
} from "./charts";
import { colorForSport } from "./palette";

describe("preferOpenRiskBars", () => {
  it("forces bars when sports ≤ 3", () => {
    expect(preferOpenRiskBars(2, 2)).toBe(true);
    expect(preferOpenRiskBars(3, 4)).toBe(true);
    expect(preferOpenRiskBars(4, 2)).toBe(false);
  });

  it("forces bars when statuses ≤ 1 (single-status open risk)", () => {
    expect(preferOpenRiskBars(10, 1)).toBe(true);
    expect(preferOpenRiskBars(2, 1)).toBe(true);
    expect(preferOpenRiskBars(5, 0)).toBe(true);
  });
});

describe("openRiskBySportOption smoke", () => {
  it("builds bars for 2 sports · 1 status shape with outside labels", () => {
    const opt = openRiskBySportOption([
      { sport: "snooker", stake: 16, n: 1 },
      { sport: "esports", stake: 16, n: 1 },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (opt as any).series?.[0];
    expect(series?.type).toBe("bar");
    expect(series?.barMaxWidth).toBeLessThanOrEqual(28);
    expect(series?.label?.position).toBe("right");
    expect(series?.label?.show).toBe(true);
    // No Pending visualMap on bars
    expect((opt as { visualMap?: unknown }).visualMap).toBeUndefined();
    // Distinct sport colors (snooker teal vs esports indigo)
    expect(colorForSport("snooker")).not.toBe(colorForSport("esports"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colors = (series?.data as any[]).map((d) => d.itemStyle?.color);
    expect(new Set(colors).size).toBe(2);
  });
});

describe("riskHeatmapOption force-bars for single status", () => {
  it("returns bar series when only 1 status column", () => {
    const opt = riskHeatmapOption({
      sports: ["snooker", "esports"],
      statuses: ["Pending"],
      cells: [
        { sport: "snooker", status: "Pending", stake: 16, n: 1 },
        { sport: "esports", status: "Pending", stake: 16, n: 1 },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (opt as any).series?.[0];
    expect(series?.type).toBe("bar");
    expect(series?.barMaxWidth).toBeLessThanOrEqual(28);
  });
});
