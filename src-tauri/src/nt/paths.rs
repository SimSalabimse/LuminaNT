use std::path::{Path, PathBuf};

pub fn bets_csv(root: &Path) -> PathBuf {
    root.join("data").join("bets.csv")
}

pub fn bankroll_json(root: &Path) -> PathBuf {
    root.join("data").join("state").join("bankroll.json")
}

pub fn phase_json(root: &Path) -> PathBuf {
    root.join("data").join("state").join("phase.json")
}

pub fn risk_json(root: &Path) -> PathBuf {
    root.join("data").join("state").join("risk.json")
}

pub fn capital_segments_json(root: &Path) -> PathBuf {
    root.join("data").join("state").join("capital_segments.json")
}

pub fn stake_decisions_jsonl(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("stake_decisions.jsonl")
}

pub fn status_md(root: &Path) -> PathBuf {
    root.join("data").join("state").join("status.md")
}

pub fn learning_json(root: &Path) -> PathBuf {
    root.join("data").join("state").join("learning.json")
}

pub fn learning_history_jsonl(root: &Path) -> PathBuf {
    root.join("data").join("state").join("learning_history.jsonl")
}

pub fn learning_proposals_json(root: &Path) -> PathBuf {
    root.join("data").join("state").join("learning_proposals.json")
}

pub fn settlement_reviews_jsonl(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("settlement_reviews.jsonl")
}

pub fn control_signals_jsonl(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("control_signals.jsonl")
}

pub fn coverage_health_json(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("coverage_health.json")
}

/// Deep queue composition SSOT (`data/state/deep_queue.json`, D17).
pub fn deep_queue_json(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("deep_queue.json")
}

pub fn edges_summary_md(root: &Path) -> PathBuf {
    root.join("data").join("state").join("edges_summary.md")
}

pub fn edges_jsonl(root: &Path) -> PathBuf {
    root.join("data").join("edges.jsonl")
}

pub fn decisions_jsonl(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("bet_decisions.jsonl")
}

pub fn evidence_links_jsonl(root: &Path) -> PathBuf {
    root.join("data")
        .join("state")
        .join("evidence_links.jsonl")
}

pub fn calibration_jsonl(root: &Path) -> PathBuf {
    root.join("data").join("state").join("calibration.jsonl")
}

pub fn config_yaml(root: &Path) -> PathBuf {
    root.join("config.yaml")
}

pub fn evidence_dir(root: &Path) -> PathBuf {
    root.join("evidence")
}

pub fn inbox_dir(root: &Path) -> PathBuf {
    root.join("inbox")
}

pub fn outbox_dir(root: &Path) -> PathBuf {
    root.join("outbox")
}

pub fn place_these(root: &Path) -> PathBuf {
    root.join("outbox").join("PLACE_THESE.md")
}

/// Structured multi-sport odds snapshot (collector overwrite target).
pub fn odds_structured_json(root: &Path) -> PathBuf {
    root.join("artifacts").join("odds_structured.json")
}

/// Optional durable copy under data/odds (future collections).
pub fn odds_latest_json(root: &Path) -> PathBuf {
    root.join("data").join("odds").join("latest.json")
}

pub fn odds_collections_dir(root: &Path) -> PathBuf {
    root.join("data").join("odds").join("collections")
}

pub fn phase_plan_md(root: &Path) -> PathBuf {
    root.join("docs").join("PHASE_PLAN.md")
}

pub fn bankroll_plan_md(root: &Path) -> PathBuf {
    root.join("docs").join("BANKROLL_PLAN.md")
}

/// True when the folder looks like an nt-betting-tracker root.
pub fn looks_like_nt_repo(root: &Path) -> bool {
    root.join("config.yaml").is_file()
        && (root.join("data").join("bets.csv").is_file()
            || root.join("nt").is_dir()
            || root.join("data").is_dir())
}
