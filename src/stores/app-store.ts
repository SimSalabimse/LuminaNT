import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings, ViewId } from "@/types";
import {
  defaultViewForWorkspace,
  type FilterScope,
  type WorkspaceId,
  workspaceOfView,
} from "@/lib/workspaces";

const defaultSettings: AppSettings = {
  repoPath: "",
  pythonCmd: "python",
  autoWatch: true,
  watchIntervalMs: 4000,
  aiProvider: "xai",
  aiApiKey: "",
  aiModel: "",
  demoMode: false,
};

interface AppStore {
  view: ViewId;
  setView: (v: ViewId) => void;
  /** Jump to a workspace (uses default sub-view if not already inside it) */
  setWorkspace: (w: WorkspaceId) => void;
  /**
   * full = ignore filters for scope-aware metrics (true book)
   * filtered = respect global filters / forensic grain
   */
  filterScope: FilterScope;
  setFilterScope: (s: FilterScope) => void;
  settings: AppSettings;
  patchSettings: (p: Partial<AppSettings>) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  commandLog: string[];
  pushLog: (line: string) => void;
  clearLog: () => void;
  lastError: string | null;
  setError: (e: string | null) => void;
  toast: string | null;
  setToast: (t: string | null) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  toggleHelp: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  toggleCommandPalette: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      view: "dashboard",
      setView: (view) => set({ view }),
      setWorkspace: (w) => {
        const current = get().view;
        if (workspaceOfView(current) === w) return;
        set({ view: defaultViewForWorkspace(w) });
      },
      filterScope: "full",
      setFilterScope: (filterScope) => set({ filterScope }),
      settings: defaultSettings,
      patchSettings: (p) =>
        set((s) => ({ settings: { ...s.settings, ...p } })),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      commandLog: [],
      pushLog: (line) =>
        set((s) => ({
          commandLog: [`[${new Date().toLocaleTimeString()}] ${line}`, ...s.commandLog].slice(
            0,
            80
          ),
        })),
      clearLog: () => set({ commandLog: [] }),
      lastError: null,
      setError: (lastError) => set({ lastError }),
      toast: null,
      setToast: (toast) => set({ toast }),
      helpOpen: false,
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
    }),
    {
      name: "luminant-settings",
      partialize: (s) => ({
        settings: s.settings,
        sidebarCollapsed: s.sidebarCollapsed,
        view: s.view,
        filterScope: s.filterScope,
      }),
    }
  )
);
