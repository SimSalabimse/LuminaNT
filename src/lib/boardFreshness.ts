/**
 * D14 board freshness — Ops board-first gate.
 *
 * Sticky is set only after a successful `nt research board` for a given odds
 * path. Recommend (live) should refuse unless:
 *   - sticky.source === "board"
 *   - sticky.oddsPath matches the current odds path
 *   - current odds mtime is not newer than sticky.at
 *     (equivalently sticky.oddsMtimeMs ≤ sticky.at when both known)
 *
 * Empty / missing sticky → not fresh (fail-closed). Dry-run recommend may
 * still run for inspection; Ops UI warns and requires explicit override for
 * live recommend when stale.
 */

export type BoardStickySource = "board";

export type BoardSticky = {
  source: BoardStickySource;
  /** Odds path used for the board run (e.g. inbox/current_odds_01.txt) */
  oddsPath: string;
  /**
   * Odds file mtime in ms when board ran (from snapshot.inbox when known).
   * Null when mtime was unavailable at board time.
   */
  oddsMtimeMs: number | null;
  /** Wall-clock ms when sticky was stamped after successful board. */
  at: number;
};

export type BoardFreshnessInput = {
  sticky: BoardSticky | null | undefined;
  oddsPath: string;
  /** Current odds file mtime in ms, or null if unknown */
  currentOddsMtimeMs: number | null;
  /** Optional max age of sticky (ms). Default: no age cap (mtime-only). */
  maxAgeMs?: number | null;
  /** Now override for tests */
  nowMs?: number;
};

export type BoardFreshnessResult = {
  fresh: boolean;
  reason: string;
  /** Human label for Ops banner */
  label: "fresh" | "stale" | "missing" | "path_mismatch" | "odds_newer" | "expired";
};

function normPath(p: string): string {
  return String(p || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

/**
 * Parse FileEntry.modified (ISO or locale string) → ms, or null.
 */
export function parseOddsMtimeMs(modified: string | null | undefined): number | null {
  if (!modified) return null;
  const t = Date.parse(String(modified));
  return Number.isFinite(t) ? t : null;
}

/**
 * Find inbox entry mtime for an odds path like `inbox/foo.txt`.
 */
export function oddsMtimeFromInbox(
  oddsPath: string,
  inbox: Array<{ name: string; modified?: string | null }> | null | undefined
): number | null {
  if (!inbox?.length) return null;
  const path = normPath(oddsPath);
  const base = path.includes("/") ? path.split("/").pop()! : path;
  const hit = inbox.find((f) => f.name === base || normPath(`inbox/${f.name}`) === path);
  return hit ? parseOddsMtimeMs(hit.modified) : null;
}

export function stampBoardSticky(opts: {
  oddsPath: string;
  oddsMtimeMs?: number | null;
  at?: number;
}): BoardSticky {
  const at = opts.at ?? Date.now();
  const oddsMtimeMs =
    opts.oddsMtimeMs != null && Number.isFinite(opts.oddsMtimeMs)
      ? Number(opts.oddsMtimeMs)
      : null;
  return {
    source: "board",
    oddsPath: normPath(opts.oddsPath),
    oddsMtimeMs,
    at,
  };
}

/**
 * D14: fresh iff sticky from board for same path and odds not newer than board.
 */
export function evaluateBoardFreshness(input: BoardFreshnessInput): BoardFreshnessResult {
  const sticky = input.sticky;
  const oddsPath = normPath(input.oddsPath);
  const now = input.nowMs ?? Date.now();

  if (!sticky || sticky.source !== "board") {
    return {
      fresh: false,
      reason: "No board sticky — run research board for this odds file first.",
      label: "missing",
    };
  }

  if (normPath(sticky.oddsPath) !== oddsPath) {
    return {
      fresh: false,
      reason: `Board sticky is for ${sticky.oddsPath}, not ${oddsPath}. Re-run research board.`,
      label: "path_mismatch",
    };
  }

  // oddsMtime ≤ sticky.at is the design inequality (odds not modified after board).
  if (
    sticky.oddsMtimeMs != null &&
    Number.isFinite(sticky.oddsMtimeMs) &&
    sticky.oddsMtimeMs > sticky.at
  ) {
    // Corrupt sticky (mtime after stamp) — treat as stale.
    return {
      fresh: false,
      reason: "Invalid board sticky (oddsMtime > sticky.at).",
      label: "stale",
    };
  }

  const cur = input.currentOddsMtimeMs;
  if (cur != null && Number.isFinite(cur)) {
    // Odds file modified after board stamp → stale
    if (cur > sticky.at) {
      return {
        fresh: false,
        reason: "Odds file is newer than the last research board — re-run board.",
        label: "odds_newer",
      };
    }
    // Odds mtime advanced vs what we recorded at board time
    if (sticky.oddsMtimeMs != null && cur > sticky.oddsMtimeMs) {
      return {
        fresh: false,
        reason: "Odds mtime changed since research board — re-run board.",
        label: "odds_newer",
      };
    }
  }

  const maxAge = input.maxAgeMs;
  if (maxAge != null && maxAge > 0 && now - sticky.at > maxAge) {
    return {
      fresh: false,
      reason: "Board sticky expired — re-run research board.",
      label: "expired",
    };
  }

  return {
    fresh: true,
    reason: "Board sticky fresh for this odds path.",
    label: "fresh",
  };
}
