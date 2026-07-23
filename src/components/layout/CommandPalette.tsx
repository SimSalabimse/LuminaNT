import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Crosshair,
  Dices,
  FileSearch,
  GraduationCap,
  Keyboard,
  LayoutDashboard,
  RefreshCw,
  Search,
  Settings,
  Table2,
  Workflow,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { isTauri } from "@/lib/tauri";
import type { ViewId } from "@/types";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/layout/Kbd";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof LayoutDashboard;
  keys?: string;
  run: () => void;
  group: string;
};

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setView = useAppStore((s) => s.setView);
  const toggleHelp = useAppStore((s) => s.toggleHelp);
  const settings = useAppStore((s) => s.settings);
  const refresh = useDataStore((s) => s.refresh);
  const clearForensic = useDataStore((s) => s.clearForensic);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const cmds: Cmd[] = useMemo(() => {
    const go = (v: ViewId) => () => {
      setView(v);
      setOpen(false);
    };
    return [
      { id: "d", label: "Desk", hint: "Risk · pending · pulse", icon: LayoutDashboard, keys: "1", run: go("dashboard"), group: "Navigate" },
      { id: "p", label: "Analyze · Performance", hint: "Charts & drill", icon: BarChart3, keys: "2", run: go("performance"), group: "Navigate" },
      { id: "c", label: "Analyze · Calibration", hint: "p_model reliability", icon: Crosshair, keys: "3", run: go("calibration"), group: "Navigate" },
      { id: "b", label: "Ledger", hint: "Blotter & Case File", icon: Table2, keys: "4", run: go("bets"), group: "Navigate" },
      { id: "l", label: "Research · Learnings", hint: "Multipliers · drill", icon: GraduationCap, keys: "5", run: go("learnings"), group: "Navigate" },
      { id: "o", label: "Odds", hint: "NT Oddsen board", icon: Dices, keys: "6", run: go("odds"), group: "Navigate" },
      { id: "w", label: "Ops", hint: "CLI · place slips", icon: Workflow, keys: "7", run: go("workflow"), group: "Navigate" },
      { id: "e", label: "Research · Evidence", hint: "Packs · edges", icon: FileSearch, keys: "8", run: go("evidence"), group: "Navigate" },
      { id: "a", label: "Research · Agent", hint: "AI analysis", icon: Bot, keys: "9", run: go("agent"), group: "Navigate" },
      { id: "s", label: "Settings", icon: Settings, keys: "0", run: go("settings"), group: "Navigate" },
      {
        id: "r",
        label: "Refresh data",
        hint: "Reload ledger + state",
        icon: RefreshCw,
        keys: "⌘R",
        run: () => {
          refresh({ runNtRefresh: !settings.demoMode && isTauri() });
          setOpen(false);
        },
        group: "Actions",
      },
      {
        id: "cf",
        label: "Clear forensic filter",
        icon: Crosshair,
        keys: "Esc",
        run: () => {
          clearForensic();
          setOpen(false);
        },
        group: "Actions",
      },
      {
        id: "h",
        label: "Help — desk flow & skills",
        icon: Keyboard,
        keys: "?",
        run: () => {
          setOpen(false);
          toggleHelp();
        },
        group: "Actions",
      },
    ];
  }, [setView, setOpen, refresh, settings.demoMode, clearForensic, toggleHelp]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return cmds;
    return cmds.filter(
      (c) =>
        c.label.toLowerCase().includes(qq) ||
        (c.hint || "").toLowerCase().includes(qq) ||
        c.group.toLowerCase().includes(qq)
    );
  }, [cmds, q]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[active]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/75 backdrop-blur-md"
            aria-label="Close command palette"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative w-full max-w-lg glass-strong rounded-3xl shadow-glass-lg border-primary/25 overflow-hidden holo-border"
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to view, refresh, clear forensic…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-6 text-center">
                  No commands match
                </p>
              )}
              {filtered.map((c, i) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => c.run()}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      i === active
                        ? "bg-primary/15 text-primary nav-active-glow"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="flex-1 font-medium tracking-tight">{c.label}</span>
                    {c.hint && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {c.hint}
                      </span>
                    )}
                    {c.keys && <Kbd>{c.keys}</Kbd>}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-muted-foreground flex justify-between">
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate · <Kbd>↵</Kbd> run
              </span>
              <span className="text-primary/80">Ctrl+K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
