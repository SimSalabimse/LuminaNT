import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DeskStrip } from "@/components/layout/DeskStrip";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { Onboarding } from "@/components/layout/Onboarding";
import { HelpOverlay } from "@/components/layout/HelpOverlay";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AmbientOrbs } from "@/components/layout/AmbientOrbs";
import { Dashboard } from "@/views/Dashboard";
import { Analyze } from "@/views/Analyze";
import { BetsExplorer } from "@/views/BetsExplorer";
import { Ops } from "@/views/Ops";
import { CapitalPlan } from "@/views/CapitalPlan";
import { Research } from "@/views/Research";
import { Odds } from "@/views/Odds";
import { Settings } from "@/views/Settings";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { isTauri } from "@/lib/tauri";
import { attachGlobalKeyboard } from "@/lib/keyboard";
import { useOsNotifications } from "@/hooks/use-os-notifications";
import { cn } from "@/lib/utils";
import { X, Loader2 } from "lucide-react";

function ToastHost() {
  const toast = useAppStore((s) => s.toast);
  const setToast = useAppStore((s) => s.setToast);
  const lastError = useAppStore((s) => s.lastError);
  const setError = useAppStore((s) => s.setError);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            className="pointer-events-auto glass-strong rounded-2xl px-4 py-3 text-sm shadow-glow border-primary/30 holo-border"
          >
            {toast}
          </motion.div>
        )}
        {lastError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto glass-strong rounded-2xl px-4 py-3 text-sm border-loss/40 text-loss flex gap-2"
          >
            <span className="flex-1 break-words">{lastError}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ViewRouter() {
  const view = useAppStore((s) => s.view);
  switch (view) {
    case "dashboard":
      return <Dashboard />;
    case "performance":
    case "calibration":
      return <Analyze />;
    case "bets":
      return <BetsExplorer />;
    case "odds":
      return <Odds />;
    case "capital":
    case "plans":
      return <CapitalPlan />;
    case "workflow":
      return <Ops />;
    case "shortlist":
    case "learnings":
    case "evidence":
    case "agent":
      return <Research />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

export default function App() {
  const snapshot = useDataStore((s) => s.snapshot);
  const connectRepo = useDataStore((s) => s.connectRepo);
  const checkFingerprint = useDataStore((s) => s.checkFingerprint);
  const settings = useAppStore((s) => s.settings);
  const view = useAppStore((s) => s.view);
  const loading = useDataStore((s) => s.loading);

  // D18 — opt-in OS toasts for COV CRITICAL / stale risk (demo no-op)
  useOsNotifications();

  useEffect(() => {
    if (!isTauri()) return;
    if (snapshot) return;
    if (settings.demoMode) {
      useDataStore.getState().loadDemo();
      return;
    }
    if (settings.repoPath) {
      connectRepo(settings.repoPath).catch(() => {
        /* onboarding will show */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.autoWatch || !snapshot || settings.demoMode || !isTauri()) return;
    const id = window.setInterval(() => {
      checkFingerprint().catch(() => undefined);
    }, settings.watchIntervalMs || 4000);
    return () => clearInterval(id);
  }, [
    settings.autoWatch,
    settings.watchIntervalMs,
    settings.demoMode,
    snapshot,
    checkFingerprint,
  ]);

  useEffect(() => attachGlobalKeyboard(), []);

  if (!snapshot) {
    return (
      <div className="h-full w-full min-h-screen bg-background relative">
        <AmbientOrbs />
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-sm text-muted-foreground relative z-10">
            <div className="h-12 w-12 rounded-2xl brand-orb flex items-center justify-center animate-pulse-glow">
              <Loader2 className="h-5 w-5 animate-spin text-slate-950" />
            </div>
            <span className="tracking-wide">Loading forensic ledgerâ€¦</span>
          </div>
        ) : (
          <Onboarding />
        )}
        <ToastHost />
        <HelpOverlay />
        <CommandPalette />
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-screen flex overflow-hidden bg-background relative">
      <AmbientOrbs />
      <div className="relative z-10 flex h-full w-full min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TopBar />
          <DeskStrip />
          <WorkspaceTabs />
          {/* Ledger / Odds need overflow-hidden so only the blotter scrolls */}
          <main
            className={cn(
              "flex-1 min-h-0",
              view === "bets" || view === "odds"
                ? "overflow-hidden"
                : "overflow-y-auto"
            )}
          >
            <div
              className={cn(
                view === "bets" || view === "odds"
                  ? "h-full min-h-0 p-3 md:p-4 flex flex-col"
                  : "p-4 md:p-5 lg:p-6"
              )}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    (view === "bets" || view === "odds") &&
                      "flex-1 min-h-0 flex flex-col"
                  )}
                >
                  <ViewRouter />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
      <ToastHost />
      <HelpOverlay />
      <CommandPalette />
    </div>
  );
}
