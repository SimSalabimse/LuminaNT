import Papa from "papaparse";
import type { Bet } from "@/types";
import { inferMarketFamily, inferSport } from "@/lib/markets";

const NUMERIC_FIELDS = new Set([
  "decimal_odds",
  "stake_nok",
  "p_l_nok",
  "payout_nok",
]);

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function cleanStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function parseBetsCsv(csv: string): Bet[] {
  if (!csv || !csv.trim()) return [];

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors?.length) {
    // Keep going — partial ledgers still useful
    console.warn("CSV parse warnings", parsed.errors.slice(0, 5));
  }

  return (parsed.data || [])
    .filter((row) => row && (row.bet_id || row.date || row.match))
    .map((row) => {
      const selection = cleanStr(row.selection);
      const market_type = cleanStr(row.market_type);
      const match = cleanStr(row.match);
      const sportRaw = cleanStr(row.sport);
      const bet: Bet = {
        bet_id: cleanStr(row.bet_id),
        date: cleanStr(row.date),
        match,
        selection,
        decimal_odds: toNumber(row.decimal_odds),
        stake_nok: toNumber(row.stake_nok),
        result: cleanStr(row.result) || "Pending",
        p_l_nok: toNumber(row.p_l_nok),
        payout_nok: toNumber(row.payout_nok),
        sport: inferSport(sportRaw, match, selection),
        market_type,
        market_family: inferMarketFamily(selection, market_type),
        odds_band: cleanStr(row.odds_band),
        research_grade: cleanStr(row.research_grade),
        phase: cleanStr(row.phase),
        notes: cleanStr(row.notes),
        source: cleanStr(row.source),
        created_at: cleanStr(row.created_at),
        updated_at: cleanStr(row.updated_at),
      };

      // Preserve extra columns from enhanced local versions
      for (const [k, v] of Object.entries(row)) {
        if (k in bet) continue;
        if (NUMERIC_FIELDS.has(k)) {
          bet[k] = toNumber(v);
        } else {
          bet[k] = cleanStr(v);
        }
      }

      return bet;
    });
}

export function uniqueValues(bets: Bet[], key: keyof Bet | string): string[] {
  const set = new Set<string>();
  for (const b of bets) {
    const v = cleanStr(b[key as keyof Bet] as string);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
