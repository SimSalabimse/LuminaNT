/**
 * Parse phase ladder from config.yaml (minimal, no full YAML dep).
 */

export interface PhaseLadderRow {
  id: string;
  label: string;
  enter_equity: number;
  enter_settled: number;
  stake_min: number;
  stake_max: number;
  max_bets_per_round: number;
  max_doubles_per_round: number;
  daily_risk_pct: number;
  daily_risk_floor: number;
  daily_risk_ceil: number;
  next: string | null;
}

function num(s: string | undefined, fallback = 0): number {
  if (s == null || s === "") return fallback;
  const n = Number(String(s).replace(/[^\d.+-eE]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Extract phases: block from config.yaml text */
export function parsePhasesFromConfig(yaml: string): PhaseLadderRow[] {
  if (!yaml) return [];
  const lines = yaml.split(/\r?\n/);
  const rows: PhaseLadderRow[] = [];
  let inPhases = false;
  let current: Partial<PhaseLadderRow> & { id?: string } | null = null;

  const flush = () => {
    if (current?.id) {
      rows.push({
        id: current.id,
        label: current.label || current.id,
        enter_equity: current.enter_equity ?? 0,
        enter_settled: current.enter_settled ?? 0,
        stake_min: current.stake_min ?? 0,
        stake_max: current.stake_max ?? 0,
        max_bets_per_round: current.max_bets_per_round ?? 0,
        max_doubles_per_round: current.max_doubles_per_round ?? 0,
        daily_risk_pct: current.daily_risk_pct ?? 0,
        daily_risk_floor: current.daily_risk_floor ?? 0,
        daily_risk_ceil: current.daily_risk_ceil ?? 0,
        next: current.next ?? null,
      });
    }
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    if (/^phases:\s*$/.test(line)) {
      inPhases = true;
      continue;
    }
    if (inPhases && /^[a-zA-Z_]/.test(line) && !line.startsWith(" ")) {
      // next top-level key
      flush();
      inPhases = false;
      continue;
    }
    if (!inPhases) continue;

    const phaseHead = line.match(/^\s{2}"?([^":\s]+)"?:\s*$/);
    if (phaseHead) {
      flush();
      current = { id: phaseHead[1] };
      continue;
    }
    if (!current) continue;

    const kv = line.match(/^\s{4}([a-z_]+):\s*(.+?)\s*(?:#.*)?$/i);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val === "null") {
      (current as Record<string, unknown>)[key] = null;
      continue;
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === "label" || key === "next") {
      (current as Record<string, unknown>)[key] = val;
    } else {
      (current as Record<string, unknown>)[key] = num(val);
    }
  }
  flush();
  return rows;
}

export function progressToNextPhase(
  equity: number,
  settled: number,
  currentId: string,
  ladder: PhaseLadderRow[]
): {
  current?: PhaseLadderRow;
  next?: PhaseLadderRow;
  equityGap: number;
  settledGap: number;
  equityProgress: number;
} {
  const idx = ladder.findIndex((p) => p.id === currentId);
  const current = idx >= 0 ? ladder[idx] : ladder[0];
  const next = idx >= 0 && idx < ladder.length - 1 ? ladder[idx + 1] : undefined;
  if (!next) {
    return { current, next: undefined, equityGap: 0, settledGap: 0, equityProgress: 1 };
  }
  const span = Math.max(1, next.enter_equity - (current?.enter_equity ?? 0));
  const done = Math.max(0, equity - (current?.enter_equity ?? 0));
  return {
    current,
    next,
    equityGap: Math.max(0, next.enter_equity - equity),
    settledGap: Math.max(0, next.enter_settled - settled),
    equityProgress: Math.min(1, Math.max(0, done / span)),
  };
}
