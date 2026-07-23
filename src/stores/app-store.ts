import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AiProvider, AppSettings, ViewId } from "@/types";
import {
  defaultModelForProvider,
  isAllowedModel,
  resolveAllowedModel,
} from "@/lib/aiModels";
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
  aiModel: defaultModelForProvider("xai"),
  demoMode: false,
  /** Progressive disclosure for ReasoningChain — Simple Mode on by default */
  simpleMode: true,
  /** D18 — opt-in; off by default */
  notifyCoverageCritical: false,
  notifyStaleRisk: false,
};

/** D20: keep provider/model pair on the closed allowlist. */
function sanitizeSettingsPatch(
  current: AppSettings,
  patch: Partial<AppSettings>
): Partial<AppSettings> {
  const next = { ...patch };
  const provider = (next.aiProvider ?? current.aiProvider) as AiProvider;
  if (next.aiProvider && next.aiProvider !== current.aiProvider) {
    // Provider change: drop free-form model; use default for new provider
    const candidate = next.aiModel ?? current.aiModel;
    next.aiModel = isAllowedModel(provider, candidate)
      ? candidate
      : defaultModelForProvider(provider);
  } else if (next.aiModel !== undefined) {
    next.aiModel = resolveAllowedModel(provider, next.aiModel);
  }
  return next;
}

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
        set((s) => ({
          settings: { ...s.settings, ...sanitizeSettingsPatch(s.settings, p) },
        })),
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
      // D20: strip free-form model IDs loaded from older storage
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<AppStore>;
        const settings: AppSettings = {
          ...current.settings,
          ...(p.settings || {}),
        };
        const provider = (settings.aiProvider || "xai") as AiProvider;
        settings.aiProvider = provider;
        settings.aiModel = resolveAllowedModel(provider, settings.aiModel);
        return {
          ...current,
          ...p,
          settings,
        };
      },
    }
  )
);
