import {
  FolderOpen,
  GitBranch,
  GitPullRequestArrow,
  Command,
  HelpCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { isTauri, pickFolder } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/layout/Kbd";
import { VIEW_META, workspaceOfView, WORKSPACES } from "@/lib/workspaces";
import { deriveRiskStatus } from "@/lib/riskStatus";

export function TopBar() {
  const settings = useAppStore((s) => s.settings);
  const setError = useAppStore((s) => s.setError);
  const view = useAppStore((s) => s.view);
  const toggleHelp = useAppStore((s) => s.toggleHelp);
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette);
  const snap = useDataStore((s) => s.snapshot);
  const refreshing = useDataStore((s) => s.refreshing);
  const loading = useDataStore((s) => s.loading);
  const refresh = useDataStore((s) => s.refresh);
  const connectRepo = useDataStore((s) => s.connectRepo);
  const pullGit = useDataStore((s) => s.pullGit);
  const fetchGit = useDataStore((s) => s.fetchGit);
  const filters = useDataStore((s) => s.filters);
  const clearForensic = useDataStore((s) => s.clearForensic);

  const git = snap?.git;
  const busy = refreshing || loading;
  const forensicActive =
    (filters.betIds?.length || 0) > 0 || (filters.forensicTrail?.length || 0) > 0;
  const meta = VIEW_META[view] || { label: view, blurb: "" };
  const wsId = workspaceOfView(view);
  const wsLabel =
    wsId === "system"
      ? "System"
      : WORKSPACES.find((w) => w.id === wsId)?.label ?? "";

  const onPick = async () => {
    try {
      if (!isTauri()) {
        setError(
          "Folder picker requires the desktop app. Use Demo Mode or run `npm run tauri:dev`."
        );
        return;
      }
      const path = await pickFolder();
      if (path) await connectRepo(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const pathLabel = settings.demoMode
    ? "Demo mode"
    : settings.repoPath
      ? settings.repoPath.replace(/\\/g, "/").split("/").slice(-2).join("/")
      : "No folder selected";

  return (
    <header className="h-[3.85rem] shrink-0 border-b border-white/[0.06] glass-strong flex items-center gap-3 px-4 relative z-10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent pointer-events-none" />

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="hidden md:flex flex-col min-w-0 pl-0.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            {wsLabel}
            {meta.blurb ? ` · ${meta.blurb}` : ""}
          </span>
          <span className="text-[15px] font-bold tracking-tight truncate leading-tight">
            {meta.label}
          </span>
        </div>

        <div className="h-7 w-px bg-white/[0.06] hidden md:block" />

        <Button variant="outline" size="sm" onClick={onPick} className="shrink-0 h-8">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Open</span>
        </Button>

        <div className="min-w-0 hidden lg:block">
          <div
            className="text-[11px] text-muted-foreground truncate font-mono max-w-[200px]"
            title={settings.repoPath}
          >
            {pathLabel}
          </div>
        </div>

        {git?.is_repo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1 font-mono text-[10px] max-w-[180px] truncate",
                  git.behind > 0 && "border-pending/40 text-pending"
                )}
              >
                <GitBranch className="h-3 w-3 shrink-0" />
                {git.branch}
                {git.behind > 0 && ` ↓${git.behind}`}
                {git.ahead > 0 && ` ↑${git.ahead}`}
                {git.dirty && " · dirty"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{git.summary}</p>
              <p className="text-xs text-muted-foreground">{git.last_commit_msg}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {(() => {
          if (!snap) return null;
          const st = deriveRiskStatus(snap.risk, snap.bankroll, snap.phase);
          if (st.canBet) return null;
          return (
            <Badge
              variant={st.gate === "FROZEN" || st.gate === "NO_ROOM" ? "warning" : "loss"}
              className="gap-1.5 text-[11px] h-7 px-2.5"
              title={st.reason}
            >
              <AlertTriangle className="h-3 w-3" />
              {st.betLabel}
              {st.sizeMode !== "LEGACY" && st.sizeMode !== "NORMAL" ? ` · ${st.sizeMode}` : ""}
            </Badge>
          );
        })()}

        {forensicActive && (
          <button
            type="button"
            onClick={() => clearForensic()}
            className="forensic-banner !py-1 !px-2.5 text-xs max-w-[260px] truncate"
            title="Clear forensic filter (Esc)"
          >
            <span className="font-semibold">Forensic</span>
            <span className="opacity-80">· {filters.betIds?.length || 0} ids</span>
            <span className="opacity-60 ml-1">Esc</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {isTauri() && git?.is_repo && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => fetchGit()}
                  className="h-8"
                >
                  Fetch
                </Button>
              </TooltipTrigger>
              <TooltipContent>git fetch</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => pullGit()}
                  className="h-8"
                >
                  <GitPullRequestArrow className="h-3.5 w-3.5" />
                  Pull
                </Button>
              </TooltipTrigger>
              <TooltipContent>git pull --ff-only</TooltipContent>
            </Tooltip>
          </>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleCommandPalette()}
            >
              <Command className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            Command palette <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleHelp()}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            Shortcuts <Kbd>?</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={busy || !snap}
              onClick={() =>
                refresh({ runNtRefresh: !settings.demoMode && isTauri() })
              }
              className="min-w-[112px] h-8"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-1.5">
            Reload data <Kbd>Ctrl</Kbd>
            <Kbd>R</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
