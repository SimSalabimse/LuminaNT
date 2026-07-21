use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub ok: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub dirty: bool,
    pub ahead: i32,
    pub behind: i32,
    pub remote: String,
    pub last_commit: String,
    pub last_commit_msg: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: Option<String>,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMeta {
    pub repo_root: String,
    pub valid: bool,
    pub reasons: Vec<String>,
    pub bets_path: String,
    pub bets_mtime: Option<String>,
    pub state_mtime: Option<String>,
    pub loaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerSnapshot {
    pub meta: SnapshotMeta,
    pub bankroll: Value,
    pub phase: Value,
    pub risk: Value,
    pub status_md: String,
    pub config_raw: String,
    pub bets_csv: String,
    pub edges: Vec<Value>,
    pub decisions: Vec<Value>,
    pub evidence_links: Vec<Value>,
    pub calibration: Vec<Value>,
    pub learning: Value,
    pub learning_history: Vec<Value>,
    /// Pending accept/reject proposals from settlement review
    #[serde(default)]
    pub learning_proposals: Value,
    pub edges_summary_md: String,
    pub phase_plan_md: String,
    pub bankroll_plan_md: String,
    pub evidence: Vec<FileEntry>,
    pub inbox: Vec<FileEntry>,
    pub outbox: Vec<FileEntry>,
    pub place_these: String,
    pub git: GitStatus,
    /// Raw JSON array from artifacts/odds_structured.json (or data/odds/latest.json)
    #[serde(default)]
    pub odds_structured_json: String,
    #[serde(default)]
    pub odds_collected_at: Option<String>,
    #[serde(default)]
    pub odds_source_path: Option<String>,
    /// capital_v2 segments (secure, freeze, day/week snapshots, transfers)
    #[serde(default)]
    pub capital_segments: Value,
    /// Append-only stake decision audit lines
    #[serde(default)]
    pub stake_decisions: Vec<Value>,
}
