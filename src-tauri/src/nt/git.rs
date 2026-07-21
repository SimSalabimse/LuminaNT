use super::models::{CommandResult, GitStatus};
use crate::error::{AppError, AppResult};
use std::path::Path;
use std::process::Command;

fn run_git(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|e| format!("git not available: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn status(root: &Path) -> GitStatus {
    if !root.join(".git").exists() {
        return GitStatus {
            is_repo: false,
            branch: String::new(),
            dirty: false,
            ahead: 0,
            behind: 0,
            remote: String::new(),
            last_commit: String::new(),
            last_commit_msg: String::new(),
            summary: "Not a git repository".into(),
        };
    }

    let branch = run_git(root, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_else(|_| "—".into());
    let porcelain = run_git(root, &["status", "--porcelain"]).unwrap_or_default();
    let dirty = !porcelain.is_empty();

    // Local ahead/behind vs existing upstream tracking refs (no network).
    let counts = run_git(
        root,
        &[
            "rev-list",
            "--left-right",
            "--count",
            "HEAD...@{upstream}",
        ],
    )
    .unwrap_or_else(|_| "0\t0".into());

    let (ahead, behind) = parse_ahead_behind(&counts);
    let remote = run_git(root, &["remote", "get-url", "origin"]).unwrap_or_default();
    let last_commit = run_git(root, &["rev-parse", "--short", "HEAD"]).unwrap_or_default();
    let last_commit_msg = run_git(root, &["log", "-1", "--pretty=%s"]).unwrap_or_default();

    let mut parts = vec![format!("branch {branch}")];
    if dirty {
        parts.push("dirty".into());
    } else {
        parts.push("clean".into());
    }
    if behind > 0 {
        parts.push(format!("{behind} behind"));
    }
    if ahead > 0 {
        parts.push(format!("{ahead} ahead"));
    }

    GitStatus {
        is_repo: true,
        branch,
        dirty,
        ahead,
        behind,
        remote,
        last_commit,
        last_commit_msg,
        summary: parts.join(" · "),
    }
}

fn parse_ahead_behind(s: &str) -> (i32, i32) {
    // "ahead\tbehind" from rev-list --left-right --count HEAD...@{upstream}
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() >= 2 {
        let a = parts[0].parse().unwrap_or(0);
        let b = parts[1].parse().unwrap_or(0);
        return (a, b);
    }
    (0, 0)
}

pub fn pull(root: &Path) -> AppResult<CommandResult> {
    let output = Command::new("git")
        .args(["pull", "--ff-only"])
        .current_dir(root)
        .output()
        .map_err(|e| AppError::msg(format!("git pull failed to start: {e}")))?;

    Ok(CommandResult {
        ok: output.status.success(),
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        command: "git pull --ff-only".into(),
    })
}

pub fn fetch(root: &Path) -> AppResult<CommandResult> {
    let output = Command::new("git")
        .args(["fetch", "--prune"])
        .current_dir(root)
        .output()
        .map_err(|e| AppError::msg(format!("git fetch failed to start: {e}")))?;

    Ok(CommandResult {
        ok: output.status.success(),
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        command: "git fetch --prune".into(),
    })
}
