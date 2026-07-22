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
    bankroll: bankroll as TrackerSnapshot["bankroll"],
    phase: phase as TrackerSnapshot["phase"],
    // Prefer file-based package shape (public/demo-data/risk.json); fill gaps only.
    risk: {
      capital_v2_enabled: true,
      size_mode: "NORMAL",
      size_mode_capital: "NORMAL",
      secure_nok: 0,
      unit_size_nok: 10,
      riskable_liquid_nok: 500,
      working_equity_nok: 500,
      equity_nok: 500,
      drawdown_from_peak: 0,
      portfolio_open_room_nok: 80,
      daily_loss_limit_nok: 20,
      weekly_loss_limit_nok: 40,
      week_realized_pl_nok: 0,
      bankroll_regime: "exploration",
      bankroll_regime_label: "Exploration",
      regime_open_risk_cap_nok: 50,
      regime_min_ev: 0.04,
      regime_weekly_explore_used: 0,
      regime_weekly_explore_max: 2,
      regime_explore_min_ev: 0.02,
      regime_explore_max_ev: 0.04,
      regime_week_id: "2026-W30",
      totalgrense_enabled: true,
      totalgrense_active: false,
      totalgrense_buffer_nok: 5000,
      ...(risk as TrackerSnapshot["risk"]),
    },
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
      day_snapshot: { oslo_date: "2026-07-21", liquid_start_nok: 500, unit_size_nok: 10 },
      week_snapshot: { week_id: "2026-W30", liquid_start_nok: 500, unit_size_nok: 10 },
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
