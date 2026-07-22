export type ViewId =
  | "dashboard"
  | "performance"
  | "calibration"
  | "bets"
  | "odds"
  | "workflow"
  | "learnings"
  | "plans"
  | "capital"
  | "shortlist"
  | "evidence"
  | "agent"
  | "settings";

/** Engine ledger result taxonomy (nt/bets_io.VALID_RESULTS + legacy aliases). */
export type BetResult =
  | "Win"
  | "Loss"
  | "Pending"
  | "ConfirmedPlaced"
  | "Refunded"
  | "Abandoned"
  | "Void"
  | "Push"
  | string;

export interface Bet {
  bet_id: string;
  date: string;
  match: string;
  selection: string;
  decimal_odds: number;
  stake_nok: number;
  result: BetResult;
  p_l_nok: number;
  payout_nok: number;
  sport: string;
  market_type: string;
  /** Canonical family: Totals, BTTS, Match result, … (derived at parse) */
  market_family?: string;
  odds_band: string;
  research_grade: string;
  phase: string;
  notes: string;
  source: string;
  created_at: string;
  updated_at: string;
  /** Extra columns from enhanced local ledgers */
  [key: string]: string | number | boolean | null | undefined;
}

export interface BankrollState {
  baseline_nok?: number;
  realized_pl_nok?: number;
  equity_nok?: number;
  pending_at_risk_nok?: number;
  liquid_nok?: number;
  settled_count?: number;
  pending_count?: number;
  era_archive_bets?: number;
  post_archive_bets?: number;
  total_bets?: number;
  era_start?: string;
  updated_at?: string;
  formula?: string;
  [key: string]: unknown;
}

export interface PhaseStateScores {
  equity_score?: number;
  dd_score?: number;
  process_error_rate_14d?: number;
  calibration_score?: number;
  open_risk_concentration?: number;
  learning_health?: number;
  process_health_score?: number;
  high_odds_stress_block?: boolean;
  force_process_health?: boolean;
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PhaseState {
  phase_id?: string;
  label?: string;
  stake_min?: number;
  stake_max?: number;
  max_bets_per_round?: number;
  max_doubles_per_round?: number;
  daily_risk_pct?: number;
  daily_risk_floor?: number;
  daily_risk_ceil?: number;
  next?: string | null;
  equity_phase?: string;
  count_phase?: string;
  rolling_roi?: number;
  peak_equity_nok?: number;
  drawdown_from_peak_pct?: number;
  reasons?: string[];
  equity_nok?: number;
  settled_count?: number;
  phase_model?: string;
  phase_state?: PhaseStateScores;
  size_mode_floor?: string | null;
  research_only?: boolean;
  high_odds_stress_block?: boolean;
  process_health_until?: string | null;
  process_health_action?: string | null;
  process_health_reason?: string | null;
  [key: string]: unknown;
}

/** Engine regime.progress (package schema). Never map calibration_exit → exploration_exit. */
export interface RegimeProgress {
  settled?: number;
  /** Package: settled target to leave Exploration */
  exploration_exit?: number;
  /** Package: settled target to leave Survival */
  survival_exit?: number;
  exploration_exit_equity?: number;
  survival_exit_equity?: number;
  /** Stale pre-package key only — do not treat as Exploration 40 */
  calibration_exit?: number;
  [key: string]: unknown;
}

/** Nested regime object from evaluate_bankroll_regime (risk.regime). */
export interface BankrollRegimeDetail {
  id?: string;
  label?: string;
  min_ev?: number | null;
  open_risk_cap_nok?: number | null;
  progress?: RegimeProgress;
  schema_version?: number;
  [key: string]: unknown;
}

export interface RiskState {
  date?: string;
  equity_nok?: number;
  phase_id?: string;
  daily_risk_cap_nok?: number;
  daily_risk_pct?: number;
  open_pending_risk_nok?: number;
  remaining_risk_nok?: number;
  today_realized_pl_nok?: number;
  stop_day_loss_limit_nok?: number;
  stopped?: boolean;
  can_bet?: boolean;
  reasons?: string[];
  formula?: string;
  size_mode?: string;
  size_mode_capital?: string;
  size_mode_floor?: string | null;
  research_only?: boolean;
  high_odds_stress_block?: boolean;
  phase_health?: Record<string, unknown>;
  /**
   * Early-bankroll regime id from engine (nt/bankroll_regime).
   * Package law: Exploration → Survival → Normal.
   * Legacy disk may still say `calibration` — treat as stale (never silent rename of caps).
   */
  bankroll_regime?: string;
  bankroll_regime_label?: string;
  regime?: BankrollRegimeDetail;
  /** Engine open-risk cap under Exploration/Survival — display only, never invent */
  regime_open_risk_cap_nok?: number | null;
  regime_min_ev?: number | null;
  regime_settled_count?: number;
  /** Engine risk merge fields (nt/risk.py _merge_bankroll_regime) */
  regime_weekly_explore_used?: number;
  regime_weekly_explore_max?: number;
  regime_week_id?: string;
  regime_explore_min_ev?: number | null;
  regime_explore_max_ev?: number | null;
  [key: string]: unknown;
}

/** ControlSignals JSONL row (temp_gate_raise or revoke). */
export interface ControlSignal {
  kind?: string;
  ts?: string;
  expires_at?: string;
  ttl_days?: number;
  sport?: string;
  market?: string | null;
  min_ev_raise?: number;
  force_confirmed_lineup?: boolean;
  source?: string;
  bet_id?: string | null;
  process_root_cause?: string | null;
  revoke_all?: boolean;
  actor?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface SettlementReview {
  bet_id?: string;
  ts?: string;
  variance_class?: string;
  research_quality_retro?: string;
  process_root_cause?: string;
  score?: string;
  factors?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Research Coverage Health (`data/state/coverage_health.json`). */
export interface CoverageHealth {
  schema_version?: number;
  source?: string;
  updated_at?: string;
  shortlist_n?: number;
  /** SSOT for empty-slip deep-pack gate (not bare `deep_n`). */
  shortlist_with_deep_n?: number;
  shortlist_deep_pct?: number;
  deep_n?: number;
  deep_survivable_n?: number;
  deep_survivable_pct?: number;
  mid_unresearched_n?: number;
  empty_slip_risk?: boolean;
  level?: "ok" | "warn" | "critical" | string;
  reasons?: string[];
  force_coverage_active?: boolean;
  force_coverage_signal?: {
    target_odds_band?: string;
    min_deep_packs?: number;
    prefer?: string[];
    expires_at?: string;
    sources?: string[];
  } | null;
  soft_gate?: boolean;
  [key: string]: unknown;
}

/**
 * Deep queue composition object (`deep_queue_composition` in deep_queue.json).
 * Shares are 0–1 floats from the engine — never invent on the client.
 */
export interface DeepQueueComposition {
  n?: number;
  preferred_n?: number;
  short_main_n?: number;
  preferred_share?: number;
  short_main_share?: number;
  meets_preferred_floor?: boolean;
  meets_short_main_cap?: boolean;
  [key: string]: unknown;
}

/** One deep-queue line from `data/state/deep_queue.json`. */
export interface DeepQueueLine {
  match?: string;
  selection?: string;
  decimal_odds?: number;
  preferred?: boolean;
  short_main?: boolean;
  sport?: string;
  reason?: string;
  prior_ev?: number;
  market_family?: string;
  [key: string]: unknown;
}

/**
 * Deep queue SSOT (`data/state/deep_queue.json`, D17).
 * Preferred ≥55% / short-main ≤25% bars read preferred_share / short_main_share only.
 */
export interface DeepQueueState {
  schema_version?: number;
  updated_at?: string;
  source?: string;
  odds_path?: string;
  day?: string;
  /** Convenience mirrors of composition shares (0–1). */
  preferred_share?: number;
  short_main_share?: number;
  deep_queue_composition?: DeepQueueComposition;
  deep_queue?: DeepQueueLine[];
  [key: string]: unknown;
}

export interface GitStatus {
  is_repo: boolean;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  remote: string;
  last_commit: string;
  last_commit_msg: string;
  summary: string;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  modified?: string | null;
  is_dir: boolean;
}

export interface SnapshotMeta {
  repo_root: string;
  valid: boolean;
  reasons: string[];
  bets_path: string;
  bets_mtime?: string | null;
  state_mtime?: string | null;
  loaded_at: string;
}

export interface DecisionRecord {
  bet_id?: string;
  p_model?: number;
  ev?: number;
  grade?: string;
  market_key?: string;
  market_type?: string;
  explore?: boolean;
  learning_stake_mult?: number;
  learning_ev_boost?: number;
  evidence_path?: string;
  evidence_match?: string;
  p_model_source?: string;
  reasons?: string[];
  notes?: string;
  implied_prob?: number;
  backfill?: boolean;
  recovered_from_notes?: boolean;
  [key: string]: unknown;
}

/** One flattened NT Oddsen selection line (not a placed bet). */
export interface OddsLine {
  id: string;
  event_id: string;
  match: string;
  home: string;
  away: string;
  sport: string;
  league: string;
  kickoff: string;
  kickoff_iso: string;
  market: string;
  selection: string;
  /** Full selection label as used by recommend/evidence (market: outcome) */
  selection_label: string;
  decimal_odds: number;
  implied_prob: number;
  sport_source?: string;
  sport_confidence?: string;
}

export interface OddsEvent {
  idfoevent: string;
  event: string;
  sport: string;
  competition: string;
  kickoff: string;
  kickoff_iso: string;
  home: string;
  away: string;
  markets: Array<{
    market: string;
    outcomes: Array<{ outcome: string; odds: number }>;
  }>;
  sport_source?: string;
  sport_confidence?: string;
  sport_cue?: string;
  idfosporttype?: string;
}

export interface OddsCollection {
  /** Source path(s) used for this collection */
  source: string;
  collected_at: string | null;
  loaded_at: string;
  n_events: number;
  n_lines: number;
  events: OddsEvent[];
  lines: OddsLine[];
}

export type OddsTimeWindow =
  | "all"
  | "next_3h"
  | "today"
  | "today_tomorrow"
  | "tomorrow";

export interface OddsFilters {
  search: string;
  sports: string[];
  leagues: string[];
  timeWindow: OddsTimeWindow;
  minOdds: string;
  maxOdds: string;
  markets: string[];
}

export interface TrackerSnapshot {
  meta: SnapshotMeta;
  bankroll: BankrollState;
  phase: PhaseState;
  risk: RiskState;
  status_md: string;
  config_raw: string;
  bets_csv: string;
  edges: EdgeRecord[];
  /** Latest process dossiers (bet_decisions.jsonl), newest wins per bet_id on client */
  decisions?: DecisionRecord[];
  evidence_links?: Array<{ bet_id?: string; evidence_path?: string; confidence?: number; [key: string]: unknown }>;
  calibration?: Array<{ bet_id?: string; p_model?: number; y?: number; brier?: number; result?: string; [key: string]: unknown }>;
  learning: LearningState;
  learning_history: LearningHistoryPoint[];
  /** Settlement-review proposals for accept/reject */
  learning_proposals?: {
    updated_at?: string;
    proposals?: LearningProposal[];
    last_batch_summary?: Record<string, unknown>;
    last_narrative?: string[];
    [key: string]: unknown;
  };
  edges_summary_md: string;
  phase_plan_md: string;
  bankroll_plan_md: string;
  evidence: FileEntry[];
  inbox: FileEntry[];
  outbox: FileEntry[];
  place_these: string;
  git: GitStatus;
  /** Raw structured odds JSON (artifacts/odds_structured.json) */
  odds_structured_json?: string;
  odds_collected_at?: string | null;
  odds_source_path?: string | null;
  /** capital_v2 state file (secure, freeze, snapshots, transfers) */
  capital_segments?: Record<string, unknown>;
  /** stake_decisions.jsonl records */
  stake_decisions?: Array<Record<string, unknown>>;
  /** ControlSignals (temp_gate_raise + revokes) */
  control_signals?: ControlSignal[];
  /** Settlement reviews (process_error, packet meta) */
  settlement_reviews?: SettlementReview[];
  /**
   * Coverage Health (`data/state/coverage_health.json`).
   * Loaded by Tauri snapshot path; missing file → empty object (fail-closed UX).
   */
  coverage_health?: CoverageHealth | Record<string, unknown> | null;
  /**
   * Deep queue composition SSOT (`data/state/deep_queue.json`, D17).
   * Missing file → empty object from loader; panels must null-safe (no invented %).
   */
  deep_queue?: DeepQueueState | Record<string, unknown> | null;
}

export interface LearningBucket {
  stake_mult?: number;
  ev_boost?: number;
  blocked?: boolean;
  status?: string;
  confidence?: number;
  n?: number;
  roi?: number;
  roi_blended?: number;
  roi_recent?: number;
  roi_short?: number;
  roi_long?: number;
  roi_layered?: number;
  n_recent?: number;
  pl?: number;
  winrate?: number;
  stake?: number;
  layers?: {
    short?: { n?: number; roi?: number };
    medium?: { n?: number; roi?: number };
    long?: { n?: number; roi?: number };
    recommend_blend?: number;
    triple_blend?: number;
  };
  [key: string]: unknown;
}

export interface LearningProposal {
  id: string;
  kind: "sport" | "market" | "band" | string;
  name: string;
  status: "pending" | "accepted" | "rejected" | "modified" | string;
  created_at?: string;
  current?: { stake_mult?: number; ev_boost?: number; n?: number };
  proposed?: { stake_mult?: number; ev_boost?: number };
  delta?: { stake_mult?: number; ev_boost?: number };
  layers?: {
    short_roi?: number;
    medium_roi?: number;
    long_roi?: number;
    blended?: number;
    confidence?: number;
  };
  reason?: string;
  source?: string;
  [key: string]: unknown;
}

export interface LearningState {
  enabled?: boolean;
  updated_at?: string;
  previous_updated_at?: string;
  version?: number;
  config_snapshot?: Record<string, unknown>;
  sports?: Record<string, LearningBucket>;
  markets?: Record<string, LearningBucket>;
  bands?: Record<string, LearningBucket>;
  lessons?: Array<string | { level?: string; text?: string; message?: string; [key: string]: unknown }>;
  recent_settlements?: Array<Record<string, unknown>>;
  multiplier_moves?: Array<Record<string, unknown>>;
  summary?: {
    n_settled?: number;
    era_roi?: number;
    era_pl?: number;
    n_sports_active?: number;
    n_blocked_sports?: number;
    n_moves?: number;
    /** Strings or objects like { name, n, roi_blended, stake_mult, status } */
    best_sports?: Array<string | Record<string, unknown>>;
    worst_sports?: Array<string | Record<string, unknown>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LearningHistoryPoint {
  ts?: string;
  n_settled?: number;
  era_roi?: number;
  n_moves?: number;
  sports?: Record<string, Partial<LearningBucket>>;
  markets?: Record<string, Partial<LearningBucket>>;
  bands?: Record<string, Partial<LearningBucket>>;
  [key: string]: unknown;
}

export interface EdgeRecord {
  ts?: string;
  bet_id?: string;
  match?: string;
  selection?: string;
  odds?: number;
  odds_band?: string;
  result?: string;
  p_l?: number;
  grade?: string;
  phase?: string;
  note?: string | null;
  [key: string]: unknown;
}

export interface CommandResult {
  ok: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  command: string;
}

export interface ForensicTrailItem {
  dim: string;
  value: string;
  label: string;
}

export interface BetFilters {
  search: string;
  results: string[];
  sports: string[];
  phases: string[];
  grades: string[];
  marketTypes: string[];
  oddsBands: string[];
  dateFrom: string;
  dateTo: string;
  oddsMin: string;
  oddsMax: string;
  stakeMin: string;
  stakeMax: string;
  /** Forensic drill-down: exact bet_ids from chart aggregation (grain law) */
  betIds: string[];
  /** Human-readable trail for breadcrumb */
  forensicTrail: ForensicTrailItem[];
}

export interface DerivedMetrics {
  equity: number;
  baseline: number;
  totalPl: number;
  settledCount: number;
  pendingCount: number;
  wins: number;
  losses: number;
  winRate: number;
  roi: number;
  totalStaked: number;
  avgOdds: number;
  avgStake: number;
  currentStreak: { type: "W" | "L" | "—"; count: number };
  bestDay: { date: string; pl: number } | null;
  worstDay: { date: string; pl: number } | null;
  highOddsCount: number;
  highOddsPl: number;
}

export interface EquityPoint {
  /** Calendar day for the series (settlement Oslo or match — see equityCurve mode). */
  date: string;
  /** Running high-water mark of equity (optional, filled by equityCurve). */
  hwm?: number;
  /** Drawdown fraction from HWM at this point (0–1). */
  drawdownPct?: number;
  equity: number;
  pl: number;
  cumulativePl: number;
  bets: number;
}

export interface BreakdownRow {
  key: string;
  count: number;
  wins: number;
  losses: number;
  pl: number;
  staked: number;
  roi: number;
  winRate: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  toolCalls?: AgentToolCall[];
}

export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export type AiProvider = "xai" | "openai" | "anthropic";

export interface AppSettings {
  repoPath: string;
  pythonCmd: string;
  autoWatch: boolean;
  watchIntervalMs: number;
  aiProvider: AiProvider;
  aiApiKey: string;
  aiModel: string;
  demoMode: boolean;
}
