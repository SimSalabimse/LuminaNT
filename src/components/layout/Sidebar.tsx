import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  Crosshair,
  FileSearch,
  GraduationCap,
  Keyboard,
  LayoutDashboard,
  Map,
  Settings,
  Sparkles,
  Table2,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Command,
  FlaskConical,
  BookMarked,
  Radar,
  Dices,
  Wallet,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/types";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { deriveRiskStatus } from "@/lib/riskStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/layout/Kbd";
import {
  WORKSPACES,
  VIEW_META,
  workspaceOfView,
  type WorkspaceId,
} from "@/lib/workspaces";

const VIEW_ICONS: Record<ViewId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  performance: BarChart3,
  calibration: Crosshair,
  bets: Table2,
  odds: Dices,
  workflow: Workflow,
  plans: Map,
  capital: Wallet,
  shortlist: ListChecks,
  learnings: GraduationCap,
  evidence: FileSearch,
  agent: Bot,
  settings: Settings,
};

const WORKSPACE_ICONS: Record<Exclude<WorkspaceId, "system">, typeof LayoutDashboard> = {
  desk: LayoutDashboard,
  analyze: FlaskConical,
  ledger: BookMarked,
  odds: Dices,
  ops: Radar,
  research: GraduationCap,
};

const SUBVIEW_KEYS: Partial<Record<ViewId, string>> = {
  dashboard: "1",
  performance: "2",
  calibration: "3",
  bets: "4",
  shortlist: "5",
  capital: "7",
  odds: "6",
  workflow: "8",
  evidence: "9",
  agent: "a",
  settings: "0",
};

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const toggleHelp = useAppStore((s) => s.toggleHelp);
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette);
  const snap = useDataStore((s) => s.snapshot);
  const riskStatus = snap
    ? deriveRiskStatus(snap.risk, snap.bankroll, snap.phase)
    : null;
  const equity = riskStatus?.equity ?? snap?.bankroll?.equity_nok;
  const phase = snap?.phase?.phase_id;
  const canBet = riskStatus?.canBet;
  const betLabel = riskStatus?.betLabel;
  const sizeMode = riskStatus?.sizeMode;
  const pl = Number(snap?.bankroll?.realized_pl_nok) || 0;
  const activeWs = workspaceOfView(view);

  return (
    <aside
      className={cn(
        "h-full flex flex-col glass-rail shrink-0 transition-all duration-300 ease-premium relative z-20",
        collapsed ? "w-[78px]" : "w-[268px]"
      )}
    >
      <div className="absolute right-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent pointer-events-none" />

      {/* Brand */}
      <div className={cn("p-4 pt-5 flex items-center gap-3", collapsed && "justify-center px-2")}>
        <div className="relative shrink-0">
          <div className="h-11 w-11 rounded-2xl brand-orb flex items-center justify-center ring-1 ring-white/20 animate-float">
            <Sparkles className="h-5 w-5 text-slate-950 drop-shadow-sm" strokeWidth={2.25} />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-[hsl(230_50%_3%)] shadow-[0_0_12px_hsl(var(--primary))]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold tracking-tight text-[15px] leading-none">
              Lumina
              <span className="text-gradient-brand animate-gradient-shift bg-[length:200%_auto]">
                NT
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 tracking-[0.16em] uppercase font-semibold">
              Forensic desk
            </div>
          </div>
        )}
      </div>

      {/* Live equity */}
      {!collapsed && snap && (
        <div className="mx-3 mb-3 rounded-xl border border-white/[0.08] bg-card p-3.5">
          <div className="relative">
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] font-semibold">
              Live equity
            </div>
            <div className="mt-2 text-[1.65rem] font-bold tabular-nums tracking-tight leading-none text-foreground">
              {equity != null ? Number(equity).toFixed(2) : "—"}
              <span className="text-xs text-muted-foreground font-medium ml-1.5">NOK</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {sizeMode && sizeMode !== "LEGACY" && (
                <span
                  className={cn(
                    "chip !py-0.5 !px-1.5 text-[10px] font-bold",
                    sizeMode === "NORMAL" && "!text-profit !border-profit/30 !bg-profit/10",
                    sizeMode === "REDUCED" && "!text-pending !border-pending/30 !bg-pending/10",
                    sizeMode === "FROZEN" && "!text-loss !border-loss/30 !bg-loss/10"
                  )}
                >
                  {sizeMode}
                </span>
              )}
              <span className="chip !py-0.5 !px-1.5 text-[10px] !border-primary/25">
                {phase ?? "—"}
              </span>
              <span
                className={cn(
                  "chip !py-0.5 !px-1.5 text-[10px] tabular-nums font-semibold",
                  pl > 0 && "!text-profit !border-profit/30 !bg-profit/10",
                  pl < 0 && "!text-loss !border-loss/30 !bg-loss/10"
                )}
              >
                {pl > 0 ? "+" : ""}
                {pl.toFixed(1)}
              </span>
              <span
                className={cn(
                  "chip !py-0.5 !px-1.5 text-[10px] ml-auto font-semibold",
                  canBet
                    ? "!text-profit !border-profit/30 !bg-profit/10"
                    : "!text-loss !border-loss/30 !bg-loss/10"
                )}
                title={riskStatus?.reason}
              >
                {betLabel ?? (canBet ? "BET YES" : "BET NO")}
              </span>
            </div>
          </div>
        </div>
      )}

      {collapsed && snap && (
        <div className="flex justify-center mb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-10 w-10 rounded-xl glass flex items-center justify-center ring-1 ring-primary/20">
                <Activity className="h-4 w-4 text-primary" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {equity != null ? `${Number(equity).toFixed(2)} NOK` : "—"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Workspaces + sub-views */}
      <nav className="flex-1 px-2.5 space-y-3 overflow-y-auto pb-2 mask-fade-b">
        {WORKSPACES.map((ws) => {
          const WsIcon = WORKSPACE_ICONS[ws.id as Exclude<WorkspaceId, "system">];
          const wsActive = activeWs === ws.id;
          const multi = ws.views.length > 1;

          if (collapsed) {
            return (
              <Tooltip key={ws.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setWorkspace(ws.id)}
                    className={cn(
                      "w-full flex items-center justify-center rounded-xl px-2 py-2.5 transition-all relative",
                      wsActive
                        ? "text-primary nav-active-glow"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                    )}
                  >
                    {wsActive && (
                      <motion.div
                        layoutId="nav-active-bar"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-gradient-to-b from-primary via-accent to-violet shadow-[0_0_14px_hsl(var(--primary))]"
                        transition={{ type: "spring", stiffness: 420, damping: 30 }}
                      />
                    )}
                    <WsIcon className="h-[18px] w-[18px]" strokeWidth={wsActive ? 2.1 : 1.7} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{ws.label}</p>
                  <p className="text-xs text-muted-foreground">{ws.blurb}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <div key={ws.id}>
              <button
                type="button"
                onClick={() => setWorkspace(ws.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors",
                  wsActive
                    ? "text-primary"
                    : "text-muted-foreground/70 hover:text-muted-foreground"
                )}
              >
                <WsIcon className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">{ws.label}</span>
                {ws.key && <Kbd className="opacity-30">{ws.key}</Kbd>}
              </button>

              {/* Sub-views (always show when expanded for multi; single-view workspaces show one item) */}
              <div className={cn("mt-0.5 space-y-0.5", multi ? "ml-1" : "")}>
                {ws.views.map((vid) => {
                  const active = view === vid;
                  const Icon = VIEW_ICONS[vid];
                  const meta = VIEW_META[vid];
                  const key = SUBVIEW_KEYS[vid];
                  return (
                    <button
                      key={vid}
                      type="button"
                      onClick={() => setView(vid)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 relative group",
                        active
                          ? "text-primary nav-active-glow"
                          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="nav-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary"
                          transition={{ type: "spring", stiffness: 420, damping: 30 }}
                        />
                      )}
                      <Icon
                        className="h-4 w-4 relative z-10 shrink-0"
                        strokeWidth={active ? 2.1 : 1.7}
                      />
                      <span className="relative z-10 font-medium flex-1 text-left tracking-tight text-[13px]">
                        {meta.label}
                      </span>
                      {key && (
                        <Kbd className="relative z-10 opacity-25 group-hover:opacity-70 transition-opacity">
                          {key}
                        </Kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* System */}
        <div className="pt-1 border-t border-white/[0.05]">
          {!collapsed && (
            <div className="px-3 mb-1 section-label opacity-50">System</div>
          )}
          {(["settings"] as ViewId[]).map((vid) => {
            const active = view === vid;
            const Icon = VIEW_ICONS[vid];
            const btn = (
              <button
                key={vid}
                type="button"
                onClick={() => setView(vid)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all relative group",
                  active
                    ? "text-primary nav-active-glow"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active-bar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-primary"
                  />
                )}
                <Icon className="h-[18px] w-[18px] relative z-10" strokeWidth={active ? 2.1 : 1.7} />
                {!collapsed && (
                  <>
                    <span className="relative z-10 font-medium flex-1 text-left">Settings</span>
                    <Kbd className="opacity-25 group-hover:opacity-70">0</Kbd>
                  </>
                )}
              </button>
            );
            if (collapsed) {
              return (
                <Tooltip key={vid}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </div>
      </nav>

      <div className="p-2.5 border-t border-white/[0.05] space-y-0.5">
        <button
          type="button"
          onClick={() => toggleCommandPalette()}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <Command className="h-3.5 w-3.5 text-primary/80" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left font-medium">Command</span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleHelp()}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <Keyboard className="h-3.5 w-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left font-medium">Shortcuts</span>
              <Kbd>?</Kbd>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.04] transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
