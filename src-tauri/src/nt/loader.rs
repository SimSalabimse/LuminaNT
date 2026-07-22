use super::git;
use super::models::*;
use super::paths;
use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

fn mtime_iso(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let dt: DateTime<Utc> = modified.into();
    Some(dt.to_rfc3339())
}

fn read_text(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

fn read_json_value(path: &Path) -> Value {
    match fs::read_to_string(path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or(json!({})),
        Err(_) => json!({}),
    }
}

fn list_files(dir: &Path, extensions: Option<&[&str]>) -> Vec<FileEntry> {
    let mut out = Vec::new();
    let Ok(rd) = fs::read_dir(dir) else {
        return out;
    };
    for entry in rd.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let is_dir = path.is_dir();
        if let Some(exts) = extensions {
            if !is_dir {
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if !exts.iter().any(|e| e.eq_ignore_ascii_case(&ext)) {
                    continue;
                }
            }
        }
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        out.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            size,
            modified: mtime_iso(&path),
            is_dir,
        });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    out
}

fn parse_jsonl(path: &Path) -> Vec<Value> {
    let text = read_text(path);
    text.lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect()
}

pub fn load_snapshot(root: &Path) -> AppResult<TrackerSnapshot> {
    let mut reasons = Vec::new();
    let valid = paths::looks_like_nt_repo(root);
    if !valid {
        reasons.push(
            "Folder does not look like an nt-betting-tracker root (need config.yaml + data/)".into(),
        );
    }

    let bets = paths::bets_csv(root);
    if !bets.is_file() {
        reasons.push("data/bets.csv not found".into());
    }

    let edges_path = paths::edges_jsonl(root);
    let evidence = list_files(&paths::evidence_dir(root), Some(&["json"]));
    let inbox = list_files(&paths::inbox_dir(root), None);
    let outbox = list_files(&paths::outbox_dir(root), None);

    let loaded_at = Utc::now().to_rfc3339();
    let git = git::status(root);

    // Prefer the *newer* of data/odds/latest.json vs artifacts/odds_structured.json
    // (CLI collector used to update only artifacts — stale latest.json made the UI show yesterday.)
    let odds_latest = paths::odds_latest_json(root);
    let odds_art = paths::odds_structured_json(root);
    let pick_odds = |a: &std::path::Path, b: &std::path::Path| -> Option<std::path::PathBuf> {
        let am = a
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok());
        let bm = b
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok());
        match (a.is_file(), b.is_file(), am, bm) {
            (true, true, Some(ta), Some(tb)) => {
                if ta >= tb {
                    Some(a.to_path_buf())
                } else {
                    Some(b.to_path_buf())
                }
            }
            (true, _, _, _) => Some(a.to_path_buf()),
            (_, true, _, _) => Some(b.to_path_buf()),
            _ => None,
        }
    };
    let odds_chosen = pick_odds(&odds_latest, &odds_art);
    let (odds_path, odds_json, odds_mtime) = if let Some(p) = odds_chosen {
        (
            Some(p.to_string_lossy().to_string()),
            read_text(&p),
            mtime_iso(&p),
        )
    } else {
        (None, String::new(), None)
    };

    Ok(TrackerSnapshot {
        meta: SnapshotMeta {
            repo_root: root.to_string_lossy().to_string(),
            valid,
            reasons,
            bets_path: bets.to_string_lossy().to_string(),
            bets_mtime: mtime_iso(&bets),
            state_mtime: mtime_iso(&paths::bankroll_json(root)),
            loaded_at,
        },
        bankroll: read_json_value(&paths::bankroll_json(root)),
        phase: read_json_value(&paths::phase_json(root)),
        risk: read_json_value(&paths::risk_json(root)),
        status_md: read_text(&paths::status_md(root)),
        config_raw: read_text(&paths::config_yaml(root)),
        bets_csv: read_text(&bets),
        edges: parse_jsonl(&edges_path),
        decisions: parse_jsonl(&paths::decisions_jsonl(root)),
        evidence_links: parse_jsonl(&paths::evidence_links_jsonl(root)),
        calibration: parse_jsonl(&paths::calibration_jsonl(root)),
        learning: read_json_value(&paths::learning_json(root)),
        learning_history: parse_jsonl(&paths::learning_history_jsonl(root)),
        learning_proposals: read_json_value(&paths::learning_proposals_json(root)),
        edges_summary_md: read_text(&paths::edges_summary_md(root)),
        phase_plan_md: read_text(&paths::phase_plan_md(root)),
        bankroll_plan_md: read_text(&paths::bankroll_plan_md(root)),
        evidence,
        inbox,
        outbox,
        place_these: read_text(&paths::place_these(root)),
        git,
        odds_structured_json: odds_json,
        odds_collected_at: odds_mtime,
        odds_source_path: odds_path,
        capital_segments: read_json_value(&paths::capital_segments_json(root)),
        stake_decisions: parse_jsonl(&paths::stake_decisions_jsonl(root)),
        control_signals: parse_jsonl(&paths::control_signals_jsonl(root)),
        settlement_reviews: parse_jsonl(&paths::settlement_reviews_jsonl(root)),
    })
}

pub fn read_file_text(path: &str) -> AppResult<String> {
    let p = PathBuf::from(path);
    if !p.is_file() {
        return Err(AppError::msg(format!("File not found: {path}")));
    }
    Ok(fs::read_to_string(p)?)
}

pub fn write_file_text(path: &str, content: &str) -> AppResult<()> {
    let p = PathBuf::from(path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(p, content)?;
    Ok(())
}

pub fn data_fingerprint(root: &Path) -> String {
    let mut parts = Vec::new();
    for p in [
        paths::bets_csv(root),
        paths::bankroll_json(root),
        paths::phase_json(root),
        paths::risk_json(root),
        paths::status_md(root),
        paths::edges_jsonl(root),
        paths::decisions_jsonl(root),
        paths::evidence_links_jsonl(root),
        paths::calibration_jsonl(root),
        paths::learning_json(root),
        paths::learning_history_jsonl(root),
        paths::learning_proposals_json(root),
        paths::place_these(root),
        paths::capital_segments_json(root),
        paths::stake_decisions_jsonl(root),
        paths::odds_structured_json(root),
        paths::odds_latest_json(root),
        paths::coverage_health_json(root),
        paths::control_signals_jsonl(root),
        paths::settlement_reviews_jsonl(root),
    ] {
        if let Ok(meta) = fs::metadata(&p) {
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            parts.push(format!("{}:{}:{}", p.display(), meta.len(), modified));
        }
    }
    parts.join("|")
}
