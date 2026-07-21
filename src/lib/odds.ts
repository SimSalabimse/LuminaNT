/**
 * NT Oddsen collection helpers — structured JSON → table lines.
 * Separate from placed bets (ledger).
 */
import type {
  OddsCollection,
  OddsEvent,
  OddsFilters,
  OddsLine,
  OddsTimeWindow,
} from "@/types";

export function emptyOddsFilters(): OddsFilters {
  return {
    search: "",
    sports: [],
    leagues: [],
    timeWindow: "all",
    minOdds: "",
    maxOdds: "",
    markets: [],
  };
}

function slugPart(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function selectionLabel(market: string, outcome: string): string {
  const m = (market || "").trim();
  const o = (outcome || "").trim();
  if (!m) return o;
  // Hub-style: market is "Vinner" → "Vinner: Team"
  if (/^vinner/i.test(m) || m.toLowerCase() === "hub") {
    return `Vinner: ${o}`;
  }
  return `${m}: ${o}`;
}

export function flattenEvents(events: OddsEvent[]): OddsLine[] {
  const lines: OddsLine[] = [];
  for (const ev of events) {
    const eventId = String(ev.idfoevent || slugPart(ev.event) || "evt");
    const match = (ev.event || `${ev.home} vs ${ev.away}`).replace(/\s*-\s*/g, " vs ");
    for (const mk of ev.markets || []) {
      for (const out of mk.outcomes || []) {
        const odds = Number(out.odds);
        if (!Number.isFinite(odds) || odds <= 1) continue;
        const sel = selectionLabel(mk.market, out.outcome);
        const id = `${eventId}|${slugPart(mk.market)}|${slugPart(out.outcome)}|${odds}`;
        lines.push({
          id,
          event_id: eventId,
          match,
          home: ev.home || "",
          away: ev.away || "",
          sport: ev.sport || "unknown",
          league: ev.competition || "",
          kickoff: ev.kickoff || "",
          kickoff_iso: ev.kickoff_iso || "",
          market: mk.market || "",
          selection: out.outcome || "",
          selection_label: sel,
          decimal_odds: odds,
          implied_prob: odds > 1 ? 1 / odds : 0,
          sport_source: ev.sport_source,
          sport_confidence: ev.sport_confidence,
        });
      }
    }
  }
  return lines;
}

export function parseOddsStructuredJson(
  raw: string,
  meta?: {
    source?: string;
    collected_at?: string | null;
  }
): OddsCollection {
  const loaded_at = new Date().toISOString();
  let events: OddsEvent[] = [];
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) {
      events = parsed as OddsEvent[];
    } else if (parsed && Array.isArray(parsed.events)) {
      events = parsed.events as OddsEvent[];
    }
  } catch {
    events = [];
  }
  const lines = flattenEvents(events);
  return {
    source: meta?.source || "odds_structured.json",
    collected_at: meta?.collected_at ?? null,
    loaded_at,
    n_events: events.length,
    n_lines: lines.length,
    events,
    lines,
  };
}

export function emptyOddsCollection(): OddsCollection {
  return {
    source: "",
    collected_at: null,
    loaded_at: new Date().toISOString(),
    n_events: 0,
    n_lines: 0,
    events: [],
    lines: [],
  };
}

function parseKickoffMs(line: OddsLine): number | null {
  const iso = line.kickoff_iso || line.kickoff;
  if (!iso) return null;
  // "2026-07-18 12:30" or ISO
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");
  const withTz =
    /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}+02:00`;
  const t = Date.parse(withTz);
  return Number.isFinite(t) ? t : null;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function inTimeWindow(line: OddsLine, window: OddsTimeWindow, now = new Date()): boolean {
  if (window === "all") return true;
  const ms = parseKickoffMs(line);
  if (ms == null) return false;
  const kick = new Date(ms);
  const today0 = startOfLocalDay(now);
  const tomorrow0 = new Date(today0);
  tomorrow0.setDate(tomorrow0.getDate() + 1);
  const dayAfter0 = new Date(tomorrow0);
  dayAfter0.setDate(dayAfter0.getDate() + 1);

  if (window === "next_3h") {
    const end = now.getTime() + 3 * 60 * 60 * 1000;
    return ms >= now.getTime() - 5 * 60 * 1000 && ms <= end;
  }
  if (window === "today") {
    return kick >= today0 && kick < tomorrow0;
  }
  if (window === "tomorrow") {
    return kick >= tomorrow0 && kick < dayAfter0;
  }
  if (window === "today_tomorrow") {
    return kick >= today0 && kick < dayAfter0;
  }
  return true;
}

export function filterOddsLines(lines: OddsLine[], f: OddsFilters): OddsLine[] {
  const q = (f.search || "").trim().toLowerCase();
  const minO = f.minOdds ? Number(f.minOdds) : null;
  const maxO = f.maxOdds ? Number(f.maxOdds) : null;

  return lines.filter((line) => {
    if (f.sports.length && !f.sports.includes(line.sport)) return false;
    if (f.leagues.length && !f.leagues.includes(line.league)) return false;
    if (f.markets.length && !f.markets.includes(line.market)) return false;
    if (minO != null && Number.isFinite(minO) && line.decimal_odds < minO) return false;
    if (maxO != null && Number.isFinite(maxO) && line.decimal_odds > maxO) return false;
    if (!inTimeWindow(line, f.timeWindow)) return false;
    if (q) {
      const hay = [
        line.match,
        line.selection_label,
        line.market,
        line.sport,
        line.league,
        line.home,
        line.away,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function uniqueOddsField(lines: OddsLine[], field: keyof OddsLine): string[] {
  const set = new Set<string>();
  for (const l of lines) {
    const v = String(l[field] || "").trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Format kickoff for table: time only if today, else date + time. */
export function formatKickoffDisplay(
  line: OddsLine,
  now = new Date()
): { primary: string; secondary?: string } {
  const ms = parseKickoffMs(line);
  if (ms == null) {
    return { primary: line.kickoff || "—" };
  }
  const d = new Date(ms);
  const time = d.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const today0 = startOfLocalDay(now);
  const tomorrow0 = new Date(today0);
  tomorrow0.setDate(tomorrow0.getDate() + 1);
  if (d >= today0 && d < tomorrow0) {
    return { primary: time, secondary: "Today" };
  }
  const date = d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
  });
  return { primary: time, secondary: date };
}

export function sortOddsLines(
  lines: OddsLine[],
  col: string,
  desc: boolean
): OddsLine[] {
  const dir = desc ? -1 : 1;
  const sorted = [...lines];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "kickoff": {
        const am = parseKickoffMs(a) ?? 0;
        const bm = parseKickoffMs(b) ?? 0;
        cmp = am - bm;
        break;
      }
      case "sport":
        cmp = a.sport.localeCompare(b.sport) || a.league.localeCompare(b.league);
        break;
      case "match":
        cmp = a.match.localeCompare(b.match);
        break;
      case "selection":
        cmp = a.selection_label.localeCompare(b.selection_label);
        break;
      case "odds":
        cmp = a.decimal_odds - b.decimal_odds;
        break;
      case "implied":
        cmp = a.implied_prob - b.implied_prob;
        break;
      default:
        cmp = a.match.localeCompare(b.match);
    }
    return cmp * dir;
  });
  return sorted;
}

/** Markdown note for research shortlist / agent handoff */
export function researchHandoffNote(line: OddsLine): string {
  return [
    `# Research shortlist item`,
    ``,
    `- **Match:** ${line.match}`,
    `- **Selection:** ${line.selection_label}`,
    `- **Odds:** ${line.decimal_odds.toFixed(2)}`,
    `- **Implied:** ${(line.implied_prob * 100).toFixed(1)}%`,
    `- **Sport:** ${line.sport}`,
    `- **League:** ${line.league}`,
    `- **Kick-off:** ${line.kickoff_iso || line.kickoff}`,
    `- **Event id:** ${line.event_id}`,
    ``,
    `Added from LuminaNT Odds workspace. Write evidence pack + honest p_model before recommend.`,
  ].join("\n");
}

export const DEMO_ODDS_STRUCTURED: OddsEvent[] = [
  {
    idfoevent: "demo-1",
    event: "Viking - Sandefjord",
    sport: "Football",
    competition: "Norge - Eliteserien",
    kickoff: "2026-07-18 18:00",
    kickoff_iso: "2026-07-18T18:00:00+02:00",
    home: "Viking",
    away: "Sandefjord",
    markets: [
      {
        market: "Vinner",
        outcomes: [
          { outcome: "Viking", odds: 1.28 },
          { outcome: "Uavgjort", odds: 5.7 },
          { outcome: "Sandefjord", odds: 8.8 },
        ],
      },
      {
        market: "Handikap 3-veis 0:1",
        outcomes: [
          { outcome: "Viking -1", odds: 1.75 },
          { outcome: "Uavgjort -1", odds: 3.9 },
          { outcome: "Sandefjord +1", odds: 3.55 },
        ],
      },
      {
        market: "Totalt antall mål - Over/Under 2.5",
        outcomes: [
          { outcome: "Over 2.5", odds: 1.37 },
          { outcome: "Under 2.5", odds: 2.95 },
        ],
      },
    ],
  },
  {
    idfoevent: "demo-2",
    event: "Rock, Josh - Woodhouse, Luke",
    sport: "Darts",
    competition: "World Matchplay - International",
    kickoff: "2026-07-18 20:00",
    kickoff_iso: "2026-07-18T20:00:00+02:00",
    home: "Rock, Josh",
    away: "Woodhouse, Luke",
    markets: [
      {
        market: "Vinner",
        outcomes: [
          { outcome: "Rock, Josh", odds: 1.7 },
          { outcome: "Woodhouse, Luke", odds: 2.05 },
        ],
      },
    ],
  },
  {
    idfoevent: "demo-3",
    event: "AIK - GAIS",
    sport: "Football",
    competition: "Sverige - Allsvenskan",
    kickoff: "2026-07-18 15:00",
    kickoff_iso: "2026-07-18T15:00:00+02:00",
    home: "AIK",
    away: "GAIS",
    markets: [
      {
        market: "Totalt antall mål - over/under 2.5",
        outcomes: [
          { outcome: "Over 2.5", odds: 1.75 },
          { outcome: "Under 2.5", odds: 1.95 },
        ],
      },
    ],
  },
];
