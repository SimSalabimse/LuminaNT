use crate::error::AppResult;
use crate::nt::{cli, git, loader, models::*, paths};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn health_check() -> String {
    "ok".into()
}

#[tauri::command]
pub fn get_repo_root(state: State<'_, AppState>) -> Option<String> {
    state.repo().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_repo_root(path: String, state: State<'_, AppState>) -> AppResult<TrackerSnapshot> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(crate::error::AppError::msg(format!(
            "Not a directory: {path}"
        )));
    }
    state.set_repo(p.clone());
    loader::load_snapshot(&p)
}

#[tauri::command]
pub fn validate_repo(path: String) -> bool {
    paths::looks_like_nt_repo(&PathBuf::from(path))
}

#[tauri::command]
pub fn load_snapshot(state: State<'_, AppState>) -> AppResult<TrackerSnapshot> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    loader::load_snapshot(&root)
}

#[tauri::command]
pub fn get_data_fingerprint(state: State<'_, AppState>) -> AppResult<String> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    Ok(loader::data_fingerprint(&root))
}

#[tauri::command]
pub fn read_text_file(path: String, state: State<'_, AppState>) -> AppResult<String> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    let safe = paths::resolve_under_root(&root, &path)
        .map_err(crate::error::AppError::msg)?;
    loader::read_file_text(&safe.to_string_lossy())
}

#[tauri::command]
pub fn write_text_file(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    let safe = paths::resolve_under_root(&root, &path)
        .map_err(crate::error::AppError::msg)?;
    loader::write_file_text(&safe.to_string_lossy(), &content)
}

#[tauri::command]
pub fn run_nt_command(
    args: Vec<String>,
    state: State<'_, AppState>,
) -> AppResult<CommandResult> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    let python = state.python();
    cli::run_nt(&root, &python, &args)
}

#[tauri::command]
pub fn get_git_status(state: State<'_, AppState>) -> AppResult<GitStatus> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    Ok(git::status(&root))
}

#[tauri::command]
pub fn git_pull(state: State<'_, AppState>) -> AppResult<CommandResult> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    git::pull(&root)
}

#[tauri::command]
pub fn git_fetch(state: State<'_, AppState>) -> AppResult<CommandResult> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    git::fetch(&root)
}

#[tauri::command]
pub fn set_python_cmd(cmd: String, state: State<'_, AppState>) {
    state.set_python(cmd);
}

#[tauri::command]
pub fn get_python_cmd(state: State<'_, AppState>) -> String {
    state.python()
}

#[tauri::command]
pub fn list_inbox(state: State<'_, AppState>) -> AppResult<Vec<FileEntry>> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    let snap = loader::load_snapshot(&root)?;
    Ok(snap.inbox)
}

#[tauri::command]
pub fn write_inbox_file(
    filename: String,
    content: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    // Strip any directory components first, then allowlist-check final path.
    let name = PathBuf::from(&filename)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "upload.txt".into());
    let rel = format!("inbox/{name}");
    let path = paths::resolve_under_root(&root, &rel).map_err(crate::error::AppError::msg)?;
    loader::write_file_text(&path.to_string_lossy(), &content)?;
    Ok(path.to_string_lossy().to_string())
}

/// Run multi-sport NT odds collector, then mirror structured JSON into data/odds/.
#[tauri::command]
pub fn collect_odds(state: State<'_, AppState>) -> AppResult<CommandResult> {
    let root = state
        .repo()
        .ok_or_else(|| crate::error::AppError::msg("No repo folder selected"))?;
    let python = state.python();
    let script = root.join("artifacts").join("multi_sport_collector.py");
    if !script.is_file() {
        return Err(crate::error::AppError::msg(
            "artifacts/multi_sport_collector.py not found in tracker root",
        ));
    }
    let display = format!(
        "{} {}",
        python,
        script.file_name().unwrap_or_default().to_string_lossy()
    );
    let output = std::process::Command::new(&python)
        .arg(&script)
        .current_dir(&root)
        .env("PYTHONUTF8", "1")
        .output()
        .map_err(|e| {
            crate::error::AppError::msg(format!("Failed to run odds collector: {e}"))
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let ok = output.status.success();

    // Mirror structured odds into data/odds for durable UI model
    if ok {
        let src = paths::odds_structured_json(&root);
        if src.is_file() {
            let dest_dir = root.join("data").join("odds");
            let _ = std::fs::create_dir_all(&dest_dir);
            let _ = std::fs::create_dir_all(paths::odds_collections_dir(&root));
            let latest = paths::odds_latest_json(&root);
            let _ = std::fs::copy(&src, &latest);
            // Timestamped collection snapshot
            let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let snap = paths::odds_collections_dir(&root)
                .join(format!("odds_{stamp}.json"));
            let _ = std::fs::copy(&src, &snap);
        }
    }

    Ok(CommandResult {
        ok,
        exit_code: output.status.code().unwrap_or(-1),
        stdout,
        stderr,
        command: display,
    })
}
