mod commands;
mod error;
mod nt;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::get_repo_root,
            commands::set_repo_root,
            commands::validate_repo,
            commands::load_snapshot,
            commands::get_data_fingerprint,
            commands::read_text_file,
            commands::write_text_file,
            commands::run_nt_command,
            commands::get_git_status,
            commands::git_pull,
            commands::git_fetch,
            commands::set_python_cmd,
            commands::get_python_cmd,
            commands::list_inbox,
            commands::write_inbox_file,
            commands::collect_odds,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LuminaNT");
}
