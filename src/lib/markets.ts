/**
 * Canonical market families — mirrors nt-betting-tracker `infer_market`.
 * Always prefer selection text so empty/raw market_type does not create junk buckets.
 * Totals are split Over/Under when the side is clear.
 */

export type MarketFamily =
  | "BTTS"
  | "DNB"
  | "Handicap"
  | "Set handicap"
  | "Map handicap"
  | "Map totals"
  | "Map totals Over"
  | "Map totals Under"
  | "Player props"
  | "Clean sheet"
  | "Correct score"
  | "Place / outright"
  | "Motorsport"
  | "Totals"
  | "Totals Over"
  | "Totals Under"
  | "Match result"
  | "Combo"
  | "Other";

function totalsSide(selection: string): "Over" | "Under" | null {
  const sel = (selection || "").toLowerCase();
  if (
    /(?<![/\w])under\s*[\d,.]/.test(sel) ||
    /(?<![/\w])under\s+(?:\d|mål|goals?|games?|points?|corners?)/.test(sel)
  ) {
    return "Under";
  }
  if (
    /(?<![/\w])over\s*[\d,.]/.test(sel) ||
    /(?<![/\w])over\s+(?:\d|mål|goals?|games?|points?|corners?)/.test(sel)
  ) {
    return "Over";
  }
  if (/:\s*under\b/.test(sel)) return "Under";
  if (/:\s*over\b/.test(sel)) return "Over";
  const hasUnder = /(?<![/\w])under\b/.test(sel);
  const hasOver = /(?<![/\w])over\b/.test(sel);
  if (hasUnder && !hasOver) return "Under";
  if (hasOver && !hasUnder) return "Over";
  return null;
}

export function inferMarketFamily(selection: string, marketType = ""): MarketFamily {
  const sel = (selection || "").trim();
  const selL = sel.toLowerCase();
  const s = `${selL} ${(marketType || "").toLowerCase()}`.trim();

  if (s.includes("begge lag") || s.includes("btts") || s.includes("both teams")) {
    return "BTTS";
  }
  if (s.includes("holder nullen") || s.includes("clean sheet") || s.includes("clean-sheet")) {
    return "Clean sheet";
  }
  if (
    s.includes("correct score") ||
    s.includes("riktig resultat") ||
    s.includes("korrekt resultat")
  ) {
    return "Correct score";
  }
  if (s.includes("tilbakebetales") || s.includes("dnb") || s.includes("draw no bet")) {
    return "DNB";
  }

  if (s.includes("kart") || /\bmaps?\b/.test(s)) {
    if (s.includes("total") || s.includes("over") || s.includes("under") || s.includes("totalt")) {
      const side = totalsSide(sel);
      if (side === "Over") return "Map totals Over";
      if (side === "Under") return "Map totals Under";
      return "Map totals";
    }
    return "Map handicap";
  }

  if (
    /[+-]\s?\d+(?:[.,]\d+)?\s*sets?\b/.test(selL) ||
    (selL.includes("sets") && /[+-]\s?\d/.test(selL))
  ) {
    return "Set handicap";
  }

  if (
    s.includes("handikap") ||
    s.includes("handicap") ||
    s.includes("asian") ||
    /[+-]\s?\d+(?:[.,]\d+)?(?:\s*(?:sets?|maps?|games?))?\s*$/.test(selL) ||
    /\s[+-]\s?\d+(?:[.,]\d+)?\s*(?:\(|$)/.test(selL) ||
    /^[a-zæøå0-9 .'/-]+\s+[+-]\s?\d+(?:[.,]\d+)?$/.test(selL)
  ) {
    return "Handicap";
  }

  if (
    s.includes("scorer") ||
    s.includes("to score") ||
    s.includes("målscorer") ||
    s.includes("anytime")
  ) {
    return "Player props";
  }

  if (
    /\btopp?\s*\d/.test(s) ||
    s.includes("topp ") ||
    /\btop\s*\d/.test(s) ||
    s.includes("outright") ||
    s.includes("rytter") ||
    s.includes("best leadout")
  ) {
    return "Place / outright";
  }

  if (
    s.includes("safety car") ||
    s.includes("raskeste runde") ||
    s.includes("fastest lap") ||
    s.includes("formel 1") ||
    s.includes("f1 ")
  ) {
    return "Motorsport";
  }

  const isTotals =
    s.includes("totalt") ||
    s.includes("over/under") ||
    s.includes("over under") ||
    s.includes(" o/u") ||
    /(?<![/\w])over\b/.test(s) ||
    /(?<![/\w])under\b/.test(s) ||
    (s.includes("total") &&
      (s.includes("mål") ||
        s.includes("goal") ||
        s.includes("game") ||
        s.includes("point") ||
        s.includes("corner")));

  if (isTotals) {
    const side = totalsSide(sel);
    if (side === "Over") return "Totals Over";
    if (side === "Under") return "Totals Under";
    return "Totals";
  }

  if (
    s.includes("to win") ||
    s.includes("vinner") ||
    s.includes("seier") ||
    s.includes("winner") ||
    ["uavgjort", "draw", "x", "1", "2", "1x2"].includes(selL) ||
    selL.startsWith("hub") ||
    (s.includes("uavgjort") && !s.includes("tilbakebetales")) ||
    s.includes(" win")
  ) {
    return "Match result";
  }
  if (s.includes("win")) {
    return "Match result";
  }

  if (sel && !/\d/.test(selL)) {
    if (sel.includes(",")) return "Place / outright";
    const words = selL.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 5 && !selL.includes(" vs ") && !` ${selL} `.includes(" - ")) {
      return "Match result";
    }
  }

  const mt = (marketType || "").trim();
  if (mt === "HUB") return "Match result";
  if (mt === "Combo") return "Combo";
  const known: MarketFamily[] = [
    "BTTS",
    "Totals",
    "Totals Over",
    "Totals Under",
    "Match result",
    "DNB",
    "Handicap",
    "Map totals",
    "Map totals Over",
    "Map totals Under",
    "Map handicap",
    "Set handicap",
    "Player props",
    "Clean sheet",
    "Correct score",
    "Place / outright",
    "Motorsport",
  ];
  if ((known as string[]).includes(mt)) return mt as MarketFamily;
  return "Other";
}

/** Short label for UI */
export function marketFamilyLabel(family: string): string {
  const map: Record<string, string> = {
    BTTS: "BTTS",
    DNB: "DNB",
    Handicap: "Handicap / spread",
    "Set handicap": "Set handicap",
    "Map handicap": "Map handicap",
    "Map totals": "Map totals",
    "Map totals Over": "Map totals Over",
    "Map totals Under": "Map totals Under",
    "Player props": "Player props",
    "Clean sheet": "Clean sheet",
    "Correct score": "Correct score",
    "Place / outright": "Place / outright",
    Motorsport: "Motorsport",
    Totals: "Totals (O/U)",
    "Totals Over": "Totals Over",
    "Totals Under": "Totals Under",
    "Match result": "Match result / ML",
    Combo: "Combo",
    Other: "Other",
    "(empty)": "(empty)",
  };
  return map[family] || family;
}

/** Guess sport when column empty (common NT ledger gaps). */
export function inferSport(sport: string, match: string, selection: string): string {
  const sp = (sport || "").trim().toLowerCase();
  if (sp && sp !== "unknown" && sp !== "other") return sp;
  const blob = `${match} ${selection}`.toLowerCase();
  if (
    blob.includes("safety car") ||
    blob.includes("raskeste runde") ||
    blob.includes("fastest lap") ||
    blob.includes("formel") ||
    blob.includes("f1 ")
  ) {
    return "f1";
  }
  if (blob.includes("vinner:") || blob.includes("sett") || blob.includes("games handikap") || blob.includes("sets")) {
    return "tennis";
  }
  if (blob.includes("kart") || blob.includes("maps") || blob.includes("cs2") || blob.includes("dota")) {
    return "esports";
  }
  if (
    blob.includes("btts") ||
    blob.includes("begge lag") ||
    blob.includes("totalt antall mål") ||
    blob.includes("to win") ||
    blob.includes("uavgjort") ||
    blob.includes(" vs ")
  ) {
    return sp === "other" ? sp : "football";
  }
  return sp || "unknown";
}
