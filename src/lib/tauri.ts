import type { CommandResult, GitStatus, TrackerSnapshot } from "@/types";

let tauriAvailable: boolean | null = null;

export function isTauri(): boolean {
  if (tauriAvailable != null) return tauriAvailable;
  tauriAvailable =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  return tauriAvailable;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(`Tauri command "${cmd}" unavailable in browser mode`);
  }
  const { invoke: inv } = await import("@tauri-apps/api/core");
  return inv<T>(cmd, args);
}

export async function healthCheck(): Promise<string> {
  return invoke<string>("health_check");
}

export async function setRepoRoot(path: string): Promise<TrackerSnapshot> {
  return invoke<TrackerSnapshot>("set_repo_root", { path });
}

export async function getRepoRoot(): Promise<string | null> {
  return invoke<string | null>("get_repo_root");
}

export async function validateRepo(path: string): Promise<boolean> {
  return invoke<boolean>("validate_repo", { path });
}

export async function loadSnapshot(): Promise<TrackerSnapshot> {
  return invoke<TrackerSnapshot>("load_snapshot");
}

export async function getDataFingerprint(): Promise<string> {
  return invoke<string>("get_data_fingerprint");
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  return invoke("write_text_file", { path, content });
}

export async function runNtCommand(args: string[]): Promise<CommandResult> {
  return invoke<CommandResult>("run_nt_command", { args });
}

export async function getGitStatus(): Promise<GitStatus> {
  return invoke<GitStatus>("get_git_status");
}

export async function gitPull(): Promise<CommandResult> {
  return invoke<CommandResult>("git_pull");
}

export async function gitFetch(): Promise<CommandResult> {
  return invoke<CommandResult>("git_fetch");
}

export async function setPythonCmd(cmd: string): Promise<void> {
  return invoke("set_python_cmd", { cmd });
}

export async function getPythonCmd(): Promise<string> {
  return invoke<string>("get_python_cmd");
}

export async function writeInboxFile(filename: string, content: string): Promise<string> {
  return invoke<string>("write_inbox_file", { filename, content });
}

/** Run multi-sport Norsk Tipping odds collector + mirror into data/odds. */
export async function collectOdds(): Promise<CommandResult> {
  return invoke<CommandResult>("collect_odds");
}

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select nt-betting-tracker root folder",
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}
