/**
 * PR5 / D14 board freshness unit tests.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateBoardFreshness,
  oddsMtimeFromInbox,
  stampBoardSticky,
} from "./boardFreshness";

describe("stampBoardSticky", () => {
  it("sets source board and normalizes path", () => {
    const s = stampBoardSticky({
      oddsPath: ".\\inbox\\current_odds_01.txt",
      oddsMtimeMs: 1_000,
      at: 2_000,
    });
    expect(s.source).toBe("board");
    expect(s.oddsPath).toBe("inbox/current_odds_01.txt");
    expect(s.oddsMtimeMs).toBe(1_000);
    expect(s.at).toBe(2_000);
  });
});

describe("evaluateBoardFreshness (D14)", () => {
  const at = 1_000_000;
  const oddsPath = "inbox/current_odds_01.txt";
  const sticky = stampBoardSticky({
    oddsPath,
    oddsMtimeMs: at - 5_000,
    at,
  });

  it("missing sticky → not fresh", () => {
    const r = evaluateBoardFreshness({
      sticky: null,
      oddsPath,
      currentOddsMtimeMs: at - 5_000,
    });
    expect(r.fresh).toBe(false);
    expect(r.label).toBe("missing");
  });

  it("path mismatch → not fresh", () => {
    const r = evaluateBoardFreshness({
      sticky,
      oddsPath: "inbox/other.txt",
      currentOddsMtimeMs: sticky.oddsMtimeMs,
    });
    expect(r.fresh).toBe(false);
    expect(r.label).toBe("path_mismatch");
  });

  it("odds newer than sticky.at → not fresh (D14)", () => {
    const r = evaluateBoardFreshness({
      sticky,
      oddsPath,
      currentOddsMtimeMs: at + 1,
    });
    expect(r.fresh).toBe(false);
    expect(r.label).toBe("odds_newer");
  });

  it("odds mtime advanced vs recorded → not fresh", () => {
    const r = evaluateBoardFreshness({
      sticky,
      oddsPath,
      currentOddsMtimeMs: (sticky.oddsMtimeMs ?? 0) + 10,
      nowMs: at + 100,
    });
    // still <= sticky.at but > sticky.oddsMtimeMs
    expect(r.fresh).toBe(false);
    expect(r.label).toBe("odds_newer");
  });

  it("same path + oddsMtime ≤ sticky.at → fresh", () => {
    const r = evaluateBoardFreshness({
      sticky,
      oddsPath,
      currentOddsMtimeMs: sticky.oddsMtimeMs,
      nowMs: at + 60_000,
    });
    expect(r.fresh).toBe(true);
    expect(r.label).toBe("fresh");
    // Design inequality: oddsMtime ≤ sticky.at
    expect(sticky.oddsMtimeMs!).toBeLessThanOrEqual(sticky.at);
  });

  it("unknown current mtime still fresh if path matches", () => {
    const r = evaluateBoardFreshness({
      sticky,
      oddsPath,
      currentOddsMtimeMs: null,
    });
    expect(r.fresh).toBe(true);
  });

  it("maxAgeMs expires sticky", () => {
    const r = evaluateBoardFreshness({
      sticky,
      oddsPath,
      currentOddsMtimeMs: sticky.oddsMtimeMs,
      maxAgeMs: 1_000,
      nowMs: at + 5_000,
    });
    expect(r.fresh).toBe(false);
    expect(r.label).toBe("expired");
  });
});

describe("oddsMtimeFromInbox", () => {
  it("resolves by basename", () => {
    const ms = oddsMtimeFromInbox("inbox/current_odds_01.txt", [
      { name: "current_odds_01.txt", modified: "2026-07-22T12:00:00.000Z" },
    ]);
    expect(ms).toBe(Date.parse("2026-07-22T12:00:00.000Z"));
  });
});
