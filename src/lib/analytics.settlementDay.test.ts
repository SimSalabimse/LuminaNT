/**
 * PR12: settlement-day forensic drill + chart day axis coherence.
 */
import { describe, expect, it } from "vitest";
import type { Bet } from "@/types";
import {
  betCalendarDay,
  betIdsForDim,
  calendarHeatmap,
  dailyPl,
  equityCurve,
  filterBets,
  emptyFilters,
} from "./analytics";

function bet(partial: Partial<Bet> & Pick<Bet, "bet_id" | "date" | "result">): Bet {
  return {
    match: "A vs B",
    selection: "Over 2.5",
    decimal_odds: 2.0,
    stake_nok: 10,
    p_l_nok: 10,
    payout_nok: 20,
    sport: "Football",
    market_type: "Totals",
    odds_band: "1.8-2.2",
    research_grade: "B",
    phase: "2",
    notes: "",
    source: "live",
    created_at: partial.date + "T10:00:00Z",
    updated_at: partial.updated_at || partial.date + "T22:00:00Z",
    ...partial,
  };
}

describe("betCalendarDay", () => {
  it("match mode uses ticket kickoff date", () => {
    const b = bet({
      bet_id: "1",
      date: "2026-03-14",
      result: "Win",
      updated_at: "2026-03-14T23:30:00Z",
    });
    expect(betCalendarDay(b, "match")).toBe("2026-03-14");
  });

  it("settlement mode uses Europe/Oslo day from updated_at", () => {
    const b = bet({
      bet_id: "1",
      date: "2026-03-14",
      result: "Win",
      // 23:30 UTC = 00:30 next day Oslo (CET)
      updated_at: "2026-03-14T23:30:00Z",
    });
    expect(betCalendarDay(b, "settlement")).toBe("2026-03-15");
  });
});

describe("settlement-day forensic grain (PR12)", () => {
  const bets: Bet[] = [
    bet({
      bet_id: "match-only",
      date: "2026-03-15",
      result: "Win",
      p_l_nok: 5,
      updated_at: "2026-03-14T12:00:00Z",
    }),
    bet({
      bet_id: "settle-day",
      date: "2026-03-14",
      result: "Loss",
      p_l_nok: -10,
      updated_at: "2026-03-14T23:30:00Z",
    }),
    bet({
      bet_id: "both",
      date: "2026-03-15",
      result: "Win",
      p_l_nok: 8,
      updated_at: "2026-03-15T10:00:00Z",
    }),
  ];

  it("betIdsForDim(date) default settlement does not use match date", () => {
    const ids = betIdsForDim(bets, "date", "2026-03-15");
    expect(ids.sort()).toEqual(["both", "settle-day"]);
    expect(ids).not.toContain("match-only");
  });

  it("betIdsForDim(date, match) keeps kickoff day grain", () => {
    const ids = betIdsForDim(bets, "date", "2026-03-15", {
      dateMode: "match",
    });
    expect(ids.sort()).toEqual(["both", "match-only"]);
    expect(ids).not.toContain("settle-day");
  });

  it("dailyPl settlement buckets match forensic ids", () => {
    const rows = dailyPl(bets, "settlement");
    const day = rows.find((r) => r.date === "2026-03-15");
    expect(day).toBeTruthy();
    expect(day!.pl).toBe(-2); // -10 + 8
    const ids = betIdsForDim(bets, "date", "2026-03-15", {
      dateMode: "settlement",
    });
    const grainPl = bets
      .filter((b) => ids.includes(b.bet_id))
      .reduce((s, b) => s + b.p_l_nok, 0);
    expect(grainPl).toBe(day!.pl);
  });

  it("equityCurve settlement day keys match dailyPl", () => {
    const eq = equityCurve(bets, 500, "settlement");
    const daily = dailyPl(bets, "settlement");
    expect(eq.map((p) => p.date)).toEqual(daily.map((r) => r.date));
  });

  it("calendarHeatmap default is settlement day", () => {
    const heat = calendarHeatmap(bets);
    const cell = heat.find((h) => h.date === "2026-03-15");
    expect(cell?.count).toBe(2);
    expect(cell?.pl).toBe(-2);
  });

  it("filterBets with settlement betIds is not gutted by match dateFrom/To", () => {
    const ids = betIdsForDim(bets, "date", "2026-03-15", {
      dateMode: "settlement",
    });
    const wrong = filterBets(bets, {
      ...emptyFilters(),
      betIds: ids,
      dateFrom: "2026-03-15",
      dateTo: "2026-03-15",
    });
    expect(wrong.map((b) => b.bet_id).sort()).not.toEqual(ids.sort());

    const right = filterBets(bets, {
      ...emptyFilters(),
      betIds: ids,
      dateFrom: "",
      dateTo: "",
    });
    expect(right.map((b) => b.bet_id).sort()).toEqual(ids.sort());
  });
});
