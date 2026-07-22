import type { TrackerSnapshot } from "@/types";
import { DEMO_ODDS_STRUCTURED } from "@/lib/odds";

/**
 * Lazy-load bundled demo snapshots so Vite can serve them in browser mode.
 */
async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchJson<T>(url: string): Promise<T | Record<string, never>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Package-shaped Exploration training law (mirrors public/demo-data/*.json). */
const DEMO_PACKAGE_BANKROLL: TrackerSnapshot["bankroll"] = {
  baseline_nok: 500,
  realized_pl_nok: 0,
  equity_nok: 500,
  pending_at_risk_nok: 10,
  liquid_nok: 490,
  settled_count: 0,
  pending_count: 1,
  era_archive_bets: 0,
  post_archive_bets: 1,
  total_bets: 1,
  era_start: "2026-07-22",
  updated_at: "2026-07-22T15:42:36Z",
  formula:
    "equity = baseline + sum(terminal P/L in data/bets.csv); open_risk = Pending+ConfirmedPlaced; Abandoned excluded from risk",
};

const DEMO_PACKAGE_PHASE: TrackerSnapshot["phase"] = {
  phase_id: "1A",
  label: "Protect",
  stake_min: 10,
  stake_max: 12,
  max_bets_per_round: 4,
  max_doubles_per_round: 0,
  daily_risk_pct: 0.08,
  daily_risk_floor: 30,
  daily_risk_ceil: 42,
  next: "1B",
  equity_phase: "1A",
  count_phase: "1A",
  rolling_roi: undefined,
  peak_equity_nok: 500,
  drawdown_from_peak_pct: 0,
  reasons: [
    "equity_phase=1A (equity 500.00)",
    "count_phase=1A (settled 0)",
    "peak_equity=500.00",
  ],
  equity_nok: 500,
  settled_count: 0,
  high_odds_stress_block: true,
  research_only: false,
};

/** Fail-soft risk when risk.json is missing — same package numbers as frozen file. */
const DEMO_PACKAGE_RISK: TrackerSnapshot["risk"] = {
  date: "2026-07-22",
  equity_nok: 500,
  phase_id: "1A",
  daily_risk_cap_nok: 40,
  daily_risk_pct: 0.08,
  open_pending_risk_nok: 10,
  remaining_risk_nok: 30,
  today_realized_pl_nok: 0,
  stop_day_loss_limit_nok: 20,
  stopped: false,
  can_bet: true,
  reasons: ["REGIME note: exploration: settled 0 < 40 and equity 500 < 650"],
  capital_v2_enabled: true,
  size_mode: "NORMAL",
  size_mode_capital: "NORMAL",
  secure_nok: 0,
  unit_size_nok: 10,
  riskable_liquid_nok: 490,
  working_equity_nok: 500,
  drawdown_from_peak: 0,
  portfolio_open_room_nok: 78.2,
  portfolio_open_risk_cap_nok: 88.2,
  portfolio_open_max_pct: 0.18,
  daily_loss_limit_nok: 20,
  weekly_loss_limit_nok: 40,
  week_realized_pl_nok: 0,
  min_stake_nok: 10,
  freeze_manual: false,
  dd_frozen: false,
  bankroll_regime: "exploration",
  bankroll_regime_label: "Exploration",
  regime_open_risk_cap_nok: 50,
  regime_min_ev: 0.04,
  regime_prefer_mid_odds: true,
  regime_settled_count: 0,
  regime_week_id: "2026-W30",
  regime_weekly_explore_used: 0,
  regime_weekly_explore_max: 2,
  regime_explore_min_ev: 0.02,
  regime_explore_max_ev: 0.04,
  regime: {
    enabled: true,
    id: "exploration",
    label: "Exploration",
    min_ev: 0.04,
    open_risk_cap_nok: 50,
    prefer_mid_odds: true,
    mid_odds_lo: 1.85,
    mid_odds_hi: 2.5,
    settled_count: 0,
    equity_nok: 500,
    weekly_explore_max: 2,
    explore_min_ev: 0.02,
    explore_max_ev: 0.04,
    progress: {
      settled: 0,
      exploration_exit: 40,
      survival_exit: 100,
      exploration_exit_equity: 650,
      survival_exit_equity: 800,
    },
  },
  totalgrense_enabled: true,
  totalgrense_active: false,
  totalgrense_buffer_nok: 5000,
  daily_totalgrense_remaining: null,
  monthly_totalgrense_remaining: null,
  totalgrense: {
    enabled: true,
    active: false,
    residual_buffer_nok: 5000,
    oslo_day: "2026-07-22",
    oslo_month: "2026-07",
    schema_version: 1,
  },
};

export async function loadDemoSnapshot(): Promise<TrackerSnapshot> {
  const base = "/demo-data";
  const [
    bets_csv,
    bankroll,
    phase,
    risk,
    status_md,
    edgesRaw,
    config_raw,
    place_these,
  ] = await Promise.all([
    fetchText(`${base}/bets.csv`),
    fetchJson(`${base}/bankroll.json`),
    fetchJson(`${base}/phase.json`),
    fetchJson(`${base}/risk.json`),
    fetchText(`${base}/status.md`),
    fetchText(`${base}/edges.jsonl`),
    fetchText(`${base}/config.yaml`),
    fetchText(`${base}/PLACE_THESE.md`),
  ]);

  const edges = edgesRaw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // File-based SSOT wins; package constants fill gaps / empty fetch.
  const bankrollMerged = {
    ...DEMO_PACKAGE_BANKROLL,
    ...(bankroll as TrackerSnapshot["bankroll"]),
  };
  const phaseMerged = {
    ...DEMO_PACKAGE_PHASE,
    ...(phase as TrackerSnapshot["phase"]),
  };
  const riskMerged = {
    ...DEMO_PACKAGE_RISK,
    ...(risk as TrackerSnapshot["risk"]),
  };

  return {
    meta: {
      repo_root: "(demo mode)",
      valid: true,
      reasons: ["Loaded bundled demo snapshot from public/demo-data"],
      bets_path: "demo-data/bets.csv",
      bets_mtime: new Date().toISOString(),
      state_mtime: new Date().toISOString(),
      loaded_at: new Date().toISOString(),
    },
    bankroll: bankrollMerged,
    phase: phaseMerged,
    risk: riskMerged,
    status_md,
    config_raw,
    bets_csv,
    edges: edges as TrackerSnapshot["edges"],
    decisions: [],
    evidence_links: [],
    calibration: [],
    learning: {},
    learning_history: [],
    learning_proposals: { proposals: [] },
    capital_segments: {
      secure_nok: 0,
      freeze: { active: false },
      secure_transfers: [],
      freeze_audit: [],
      day_snapshot: {
        oslo_date: "2026-07-22",
        liquid_start_nok: 500,
        unit_size_nok: 10,
      },
      week_snapshot: {
        week_id: "2026-W30",
        liquid_start_nok: 500,
        unit_size_nok: 10,
      },
    },
    stake_decisions: [],
    control_signals: [],
    settlement_reviews: [],
    edges_summary_md: "",
    phase_plan_md: "",
    bankroll_plan_md: "",
    evidence: [
      {
        name: "example.json",
        path: "demo-data/example_evidence.json",
        size: 0,
        modified: null,
        is_dir: false,
      },
    ],
    inbox: [],
    outbox: [
      {
        name: "PLACE_THESE.md",
        path: "demo-data/PLACE_THESE.md",
        size: place_these.length,
        modified: null,
        is_dir: false,
      },
    ],
    place_these,
    git: {
      is_repo: false,
      branch: "demo",
      dirty: false,
      ahead: 0,
      behind: 0,
      remote: "",
      last_commit: "",
      last_commit_msg: "Demo snapshot",
      summary: "Demo mode — not connected to git",
    },
    odds_structured_json: JSON.stringify(DEMO_ODDS_STRUCTURED),
    odds_collected_at: new Date().toISOString(),
    odds_source_path: "demo/odds_structured.json",
  };
}
