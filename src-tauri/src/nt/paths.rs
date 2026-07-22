use std::fs;
use std::path::{Component, Path, PathBuf};

/// Lexically collapse `.` / `..` without touching the filesystem.
fn normalize_lexically(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in path.components() {
        match c {
            Component::Prefix(_) | Component::RootDir => {
                out.push(c.as_os_str());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    out.push(Component::ParentDir.as_os_str());
                }
            }
            Component::Normal(s) => out.push(s),
        }
    }
    out
}

/// True when `path` is `root` or a descendant (component-wise prefix).
fn is_under_root(path: &Path, root: &Path) -> bool {
    let mut path_comps = path.components();
    for rc in root.components() {
        match path_comps.next() {
            Some(pc) if pc == rc => continue,
            _ => return false,
        }
    }
    true
}

/// Resolve a user-supplied path so it is absolute and **strictly under** `root`.
///
/// - Relative paths are joined onto the canonical repo root.
/// - Absolute paths must still resolve under the root (no escape).
/// - Uses lexical normalization plus `canonicalize` of the longest existing prefix
///   so writes to not-yet-created files are still guarded.
pub fn resolve_under_root(root: &Path, user_path: &str) -> Result<PathBuf, String> {
    if user_path.trim().is_empty() {
        return Err("Empty path".into());
    }

    let root_canon = fs::canonicalize(root).map_err(|e| {
        format!(
            "Cannot resolve tracker root {}: {e}",
            root.display()
        )
    })?;

    let raw = PathBuf::from(user_path);
    let candidate = if raw.is_absolute() {
        raw
    } else {
        root_canon.join(&raw)
    };

    let lex = normalize_lexically(&candidate);

    // Resolve filesystem path: canonicalize longest existing ancestor, then re-append tail.
    let mut suffix: Vec<std::ffi::OsString> = Vec::new();
    let mut cur = lex.clone();
    if !cur.exists() {
        loop {
            let name = cur
                .file_name()
                .ok_or_else(|| format!("Invalid path: {user_path}"))?
                .to_os_string();
            if name == "." || name == ".." {
                return Err(format!("Path traversal not allowed: {user_path}"));
            }
            suffix.push(name);
            cur = cur
                .parent()
                .ok_or_else(|| format!("Invalid path: {user_path}"))?
                .to_path_buf();
            if cur.exists() || cur.as_os_str().is_empty() {
                break;
            }
        }
    }

    if !cur.exists() {
        return Err(format!(
            "Path not under tracker root (missing ancestor): {user_path}"
        ));
    }

    let mut resolved = fs::canonicalize(&cur).map_err(|e| {
        format!("Cannot resolve path {}: {e}", cur.display())
    })?;
    for part in suffix.into_iter().rev() {
        resolved.push(part);
    }

    // Re-normalize after push (no `..` expected in suffix) and enforce prefix.
    let resolved = normalize_lexically(&resolved);
    if !is_under_root(&resolved, &root_canon) {
        return Err(format!(
            "Path escapes tracker root: {user_path} → {} (root {})",
            resolved.display(),
            root_canon.display()
        ));
    }

    Ok(resolved)
}

#[cfg(test)]
mod path_allowlist_tests {
    use super::*;
    use std::fs;

    #[test]
    fn allows_path_under_root() {
        let dir = std::env::temp_dir().join(format!(
            "luminant_allowlist_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("inbox")).unwrap();
        let root = fs::canonicalize(&dir).unwrap();

        let p = resolve_under_root(&root, "inbox/foo.txt").unwrap();
        assert!(is_under_root(&p, &root));
        assert!(p.ends_with("foo.txt"));

        let abs = root.join("inbox").join("bar.txt");
        let p2 = resolve_under_root(&root, &abs.to_string_lossy()).unwrap();
        assert!(is_under_root(&p2, &root));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_escape_with_dotdot() {
        let dir = std::env::temp_dir().join(format!(
            "luminant_allowlist_esc_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("inbox")).unwrap();
        let root = fs::canonicalize(&dir).unwrap();

        let err = resolve_under_root(&root, "inbox/../../outside.txt").unwrap_err();
        assert!(
            err.contains("escapes") || err.contains("traversal") || err.contains("not under"),
            "unexpected err: {err}"
        );

        let _ = fs::remove_dir_all(&dir);
    }
}

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
