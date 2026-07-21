use super::models::CommandResult;
use crate::error::{AppError, AppResult};
use std::path::Path;
use std::process::Command;

/// Run an NT CLI command in the tracker root.
///
/// On Windows, `python -m nt` is broken because `nt` is a built-in module.
/// Prefer `python run_nt.py <args>` when `run_nt.py` exists (see tracker README).
pub fn run_nt(root: &Path, python: &str, args: &[String]) -> AppResult<CommandResult> {
    let run_nt_py = root.join("run_nt.py");
    let use_run_nt = run_nt_py.is_file();

    let (program, cmd_args, display) = if use_run_nt {
        let mut a = vec![run_nt_py.to_string_lossy().to_string()];
        a.extend(args.iter().cloned());
        let display = format!("{} run_nt.py {}", python, args.join(" "));
        (python.to_string(), a, display)
    } else {
        // Non-Windows / older layout fallback
        let mut a = vec!["-m".to_string(), "nt".to_string()];
        a.extend(args.iter().cloned());
        let display = format!("{} {}", python, a.join(" "));
        (python.to_string(), a, display)
    };

    let output = Command::new(&program)
        .args(&cmd_args)
        .current_dir(root)
        .env("PYTHONUTF8", "1")
        .output()
        .map_err(|e| {
            AppError::msg(format!(
                "Failed to run `{display}`: {e}. Set Python path in Settings if needed."
            ))
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    // Helpful hint if someone still hits the Windows builtin shadowing
    let mut stderr_out = stderr;
    if !output.status.success()
        && stderr_out.contains("No code object available for nt")
        && !use_run_nt
    {
        stderr_out.push_str(
            "\nHint: On Windows use run_nt.py (tracker root). `python -m nt` hits the builtin `nt` module.",
        );
    }

    Ok(CommandResult {
        ok: output.status.success(),
        exit_code,
        stdout,
        stderr: stderr_out,
        command: display,
    })
}
