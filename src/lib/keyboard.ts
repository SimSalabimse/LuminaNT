/**
 * Global keyboard navigation for LuminaNT power users.
 */
import type { ViewId } from "@/types";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { isTauri } from "@/lib/tauri";

const VIEW_KEYS: Record<string, ViewId> = {
  "1": "dashboard",
  "2": "performance",
  "3": "calibration",
  "4": "bets",
  "5": "shortlist",
  "6": "odds",
  "7": "capital",
  "8": "workflow",
  "9": "evidence",
  "0": "settings",
};

const GO_MAP: Record<string, ViewId> = {
  d: "dashboard",
  p: "performance",
  c: "capital",
  b: "bets",
  o: "odds",
  l: "learnings",
  w: "workflow",
  e: "evidence",
  a: "agent",
  s: "shortlist",
  k: "settings",
};

let goPending = false;
let goTimer: ReturnType<typeof setTimeout> | null = null;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function attachGlobalKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const app = useAppStore.getState();
    const data = useDataStore.getState();

    // Command palette — works from almost anywhere
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      app.toggleCommandPalette();
      return;
    }

    // Help toggle works even in inputs when combined with shift+?
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!isTypingTarget(e.target) || e.shiftKey) {
        e.preventDefault();
        app.toggleHelp();
        return;
      }
    }

    // Esc: palette → help → forensic → bet
    if (e.key === "Escape") {
      if (app.commandPaletteOpen) {
        app.setCommandPaletteOpen(false);
        return;
      }
      if (app.helpOpen) {
        app.setHelpOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (data.filters.betIds?.length || data.filters.forensicTrail?.length) {
        data.clearForensic();
        app.setToast("Forensic filter cleared");
        return;
      }
      if (data.selectedBetId) {
        data.setSelectedBetId(null);
        return;
      }
      if (data.selectedOddsLineId) {
        data.setSelectedOddsLineId(null);
        return;
      }
    }

    if (isTypingTarget(e.target)) return;

    // Refresh
    if ((e.key === "r" || e.key === "R") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      data.refresh({
        runNtRefresh: !app.settings.demoMode && isTauri(),
      });
      return;
    }

    // Focus search — Odds if already there, else Ledger
    if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const onOdds = app.view === "odds";
      if (!onOdds) app.setView("bets");
      requestAnimationFrame(() => {
        const sel = onOdds
          ? '[data-shortcut="odds-search"]'
          : '[data-shortcut="bets-search"]';
        const el = document.querySelector<HTMLInputElement>(sel);
        el?.focus();
        el?.select();
      });
      return;
    }

    // Chord: g then letter
    if (goPending) {
      goPending = false;
      if (goTimer) clearTimeout(goTimer);
      const next = GO_MAP[e.key.toLowerCase()];
      if (next) {
        e.preventDefault();
        app.setView(next);
      }
      return;
    }

    if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      goPending = true;
      if (goTimer) clearTimeout(goTimer);
      goTimer = setTimeout(() => {
        goPending = false;
      }, 700);
      return;
    }

    // Number pad nav
    if (!e.ctrlKey && !e.metaKey && !e.altKey && VIEW_KEYS[e.key]) {
      e.preventDefault();
      app.setView(VIEW_KEYS[e.key]);
      return;
    }

    // Comma → settings (legacy)
    if (e.key === ",") {
      e.preventDefault();
      app.setView("settings");
    }
  };

  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("keydown", onKey);
    if (goTimer) clearTimeout(goTimer);
  };
}
