import { create } from "zustand";
import type {
  Bet,
  BetFilters,
  CommandResult,
  DerivedMetrics,
  ForensicTrailItem,
  OddsCollection,
  OddsFilters,
  OddsLine,
  TrackerSnapshot,
  ViewId,
} from "@/types";
import { computeMetrics, emptyFilters, filterBets } from "@/lib/analytics";
import { parseBetsCsv } from "@/lib/parse-bets";
import {
  DEMO_ODDS_STRUCTURED,
  emptyOddsCollection,
  emptyOddsFilters,
  parseOddsStructuredJson,
  researchHandoffNote,
} from "@/lib/odds";
import { loadDemoSnapshot } from "@/lib/demo-data";
import * as api from "@/lib/tauri";
import { confirmLedgerMutation } from "@/lib/ntSafety";
import { useAppStore } from "@/stores/app-store";

interface DataStore {
  snapshot: TrackerSnapshot | null;
  bets: Bet[];
  filters: BetFilters;
  selectedBetId: string | null;
  loading: boolean;
  refreshing: boolean;
  lastFingerprint: string;
  lastLoadedAt: string | null;

  /** Latest NT Oddsen collection (not ledger bets) */
  odds: OddsCollection;
  oddsFilters: OddsFilters;
  selectedOddsLineId: string | null;
  /** Lines sent to research shortlist from Odds workspace */
  researchShortlist: OddsLine[];
  oddsCollecting: boolean;

  setFilters: (f: Partial<BetFilters>) => void;
  resetFilters: () => void;
  clearForensic: () => void;
  /** Chart → forensic drill (sets betIds + trail; navigates to targetView, default bets) */
  drillForensic: (opts: {
    dim: string;
    value: string;
    label: string;
    betIds: string[];
    filterPatch?: Partial<BetFilters>;
    /** Where to land after drill (default: bets ledger) */
    targetView?: ViewId;
  }) => void;
  setSelectedBetId: (id: string | null) => void;

  setOddsFilters: (f: Partial<OddsFilters>) => void;
  resetOddsFilters: () => void;
  setSelectedOddsLineId: (id: string | null) => void;
  addToResearchShortlist: (line: OddsLine) => Promise<void>;
  removeFromResearchShortlist: (id: string) => void;
  clearResearchShortlist: () => void;
  collectOdds: () => Promise<void>;

  filteredBets: () => Bet[];
  metrics: () => DerivedMetrics;

  connectRepo: (path: string) => Promise<void>;
  loadDemo: () => Promise<void>;
  refresh: (opts?: { runNtRefresh?: boolean }) => Promise<void>;
  runNt: (args: string[]) => Promise<CommandResult>;
  pullGit: () => Promise<CommandResult>;
  fetchGit: () => Promise<CommandResult>;
  checkFingerprint: () => Promise<boolean>;
  applySnapshot: (snap: TrackerSnapshot) => void;
}

function applyOddsFromSnapshot(snap: TrackerSnapshot): OddsCollection {
  const raw = snap.odds_structured_json || "";
  if (!raw.trim()) return emptyOddsCollection();
  return parseOddsStructuredJson(raw, {
    source: snap.odds_source_path || "odds_structured.json",
    collected_at: snap.odds_collected_at ?? null,
  });
}

function log(msg: string) {
  useAppStore.getState().pushLog(msg);
}

function toast(msg: string) {
  useAppStore.getState().setToast(msg);
}

function err(msg: string) {
  useAppStore.getState().setError(msg);
  log(`ERROR: ${msg}`);
}

export const useDataStore = create<DataStore>((set, get) => ({
  snapshot: null,
  bets: [],
  filters: emptyFilters(),
  selectedBetId: null,
  loading: false,
  refreshing: false,
  lastFingerprint: "",
  lastLoadedAt: null,

  odds: emptyOddsCollection(),
  oddsFilters: emptyOddsFilters(),
  selectedOddsLineId: null,
  researchShortlist: [],
  oddsCollecting: false,

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: emptyFilters() }),
  clearForensic: () =>
    set((s) => ({
      filters: {
        ...s.filters,
        betIds: [],
        forensicTrail: [],
      },
    })),
  drillForensic: ({ dim, value, label, betIds, filterPatch, targetView }) => {
    const trail: ForensicTrailItem = { dim, value, label };
    set((s) => {
      const prev = s.filters.forensicTrail || [];
      // Multi-hop trail: stack hops, drop exact dupes, keep last 6
      const withoutDup = prev.filter(
        (t) => !(t.dim === dim && String(t.value) === String(value))
      );
      const forensicTrail = [...withoutDup, trail].slice(-6);
      return {
        filters: {
          ...s.filters,
          ...(filterPatch || {}),
          betIds: betIds.length ? betIds : s.filters.betIds,
          forensicTrail,
        },
      };
    });
    // Auto-enable filtered scope so Analyze/Desk/Ledger respect forensic grain
    useAppStore.getState().setFilterScope("filtered");
    useAppStore.getState().setView(targetView ?? "bets");
    useAppStore
      .getState()
      .setToast(
        betIds.length
          ? `Forensic: ${label} · ${betIds.length} bets`
          : `Forensic: ${label}`
      );
  },
  setSelectedBetId: (selectedBetId) => set({ selectedBetId }),

  setOddsFilters: (f) =>
    set((s) => ({ oddsFilters: { ...s.oddsFilters, ...f } })),
  resetOddsFilters: () => set({ oddsFilters: emptyOddsFilters() }),
  setSelectedOddsLineId: (selectedOddsLineId) => set({ selectedOddsLineId }),

  addToResearchShortlist: async (line) => {
    const exists = get().researchShortlist.some((x) => x.id === line.id);
    if (!exists) {
      set((s) => ({
        researchShortlist: [...s.researchShortlist, line].slice(-40),
      }));
    }
    // Persist handoff note into tracker outbox for agent workflow
    const demo = useAppStore.getState().settings.demoMode;
    if (api.isTauri() && !demo) {
      try {
        const body = researchHandoffNote(line);
        const name = `research_shortlist_${Date.now()}.md`;
        // Append to rolling shortlist board
        const boardPath = "outbox/ODDS_RESEARCH_SHORTLIST.md";
        const snap = get().snapshot;
        const root = snap?.meta.repo_root || "";
        let existing = "";
        try {
          if (root && !root.startsWith("(")) {
            existing = await api.readTextFile(
              `${root.replace(/[/\\]$/, "")}/outbox/ODDS_RESEARCH_SHORTLIST.md`
            );
          }
        } catch {
          existing = "";
        }
        const entry = [
          ``,
          `## ${new Date().toISOString().slice(0, 16)}`,
          `- **${line.match}** · ${line.selection_label} @ ${line.decimal_odds.toFixed(2)}`,
          `- ${line.sport} · ${line.league} · KO ${line.kickoff || line.kickoff_iso}`,
          ``,
        ].join("\n");
        const header =
          existing.trim().length > 0
            ? existing
            : `# Odds → Research shortlist\n\nLines queued from LuminaNT Odds workspace.\n`;
        if (root && !root.startsWith("(")) {
          await api.writeTextFile(
            `${root.replace(/[/\\]$/, "")}/outbox/ODDS_RESEARCH_SHORTLIST.md`,
            header + entry
          );
        }
        log(`Shortlist: ${line.selection_label} @ ${line.decimal_odds} (${name})`);
      } catch (e) {
        log(`Shortlist note write failed: ${e}`);
      }
    }
    toast(
      exists
        ? "Already on research shortlist"
        : `Queued for research: ${line.selection_label}`
    );
    useAppStore.getState().setView("evidence");
  },

  removeFromResearchShortlist: (id) =>
    set((s) => ({
      researchShortlist: s.researchShortlist.filter((x) => x.id !== id),
    })),
  clearResearchShortlist: () => set({ researchShortlist: [] }),

  collectOdds: async () => {
    const demo = useAppStore.getState().settings.demoMode;
    if (demo || !api.isTauri()) {
      // Demo: re-load bundled sample
      const col = parseOddsStructuredJson(JSON.stringify(DEMO_ODDS_STRUCTURED), {
        source: "demo",
        collected_at: new Date().toISOString(),
      });
      set({ odds: col });
      toast("Demo odds reloaded");
      return;
    }
    set({ oddsCollecting: true });
    try {
      const result = await api.collectOdds();
      log(`${result.command} → exit ${result.exit_code}`);
      if (result.stdout) log(result.stdout.slice(0, 600));
      if (result.stderr) log(result.stderr.slice(0, 400));
      const snap = await api.loadSnapshot();
      get().applySnapshot(snap);
      if (result.ok) {
        toast(
          `Odds collected · ${get().odds.n_events} matches · ${get().odds.n_lines} lines`
        );
      } else {
        err(
          (result.stderr || result.stdout || "Odds collect failed")
            .trim()
            .slice(0, 400)
        );
      }
    } catch (e) {
      err(String(e));
    } finally {
      set({ oddsCollecting: false, refreshing: false });
    }
  },

  filteredBets: () => filterBets(get().bets, get().filters),

  metrics: () => {
    const snap = get().snapshot;
    const baseline =
      Number(snap?.bankroll?.baseline_nok) ||
      500;
    return computeMetrics(get().filteredBets(), baseline);
  },

  applySnapshot: (snap) => {
    const bets = parseBetsCsv(snap.bets_csv || "");
    const odds = applyOddsFromSnapshot(snap);
    set({
      snapshot: snap,
      bets,
      odds,
      lastLoadedAt: snap.meta.loaded_at,
      loading: false,
      refreshing: false,
    });
    useAppStore.getState().patchSettings({
      repoPath: snap.meta.repo_root.startsWith("(") ? useAppStore.getState().settings.repoPath : snap.meta.repo_root,
      demoMode: snap.meta.repo_root.startsWith("("),
    });
  },

  connectRepo: async (path) => {
    set({ loading: true });
    try {
      if (!api.isTauri()) {
        throw new Error("Folder selection requires the desktop app (Tauri). Use Demo Mode in the browser.");
      }
      const snap = await api.setRepoRoot(path);
      get().applySnapshot(snap);
      const py = useAppStore.getState().settings.pythonCmd;
      await api.setPythonCmd(py);
      useAppStore.getState().patchSettings({ repoPath: path, demoMode: false });
      log(`Connected to ${path}`);
      toast("Tracker folder connected");
      try {
        const fp = await api.getDataFingerprint();
        set({ lastFingerprint: fp });
      } catch {
        /* ignore */
      }
    } catch (e) {
      set({ loading: false });
      err(String(e));
      throw e;
    }
  },

  loadDemo: async () => {
    set({ loading: true });
    try {
      const snap = await loadDemoSnapshot();
      get().applySnapshot(snap);
      useAppStore.getState().patchSettings({ demoMode: true });
      log("Loaded demo snapshot");
      toast("Demo data loaded");
    } catch (e) {
      set({ loading: false });
      err(String(e));
    }
  },

  refresh: async (opts) => {
    const { snapshot } = get();
    const demo = useAppStore.getState().settings.demoMode;
    if (!snapshot && !demo) return;

    set({ refreshing: true });
    try {
      if (demo || !api.isTauri()) {
        await get().loadDemo();
        return;
      }
      let cliOk = true;
      if (opts?.runNtRefresh) {
        const result = await api.runNtCommand(["refresh"]);
        log(`${result.command} → exit ${result.exit_code}`);
        if (!result.ok) {
          cliOk = false;
          // Still reload files from disk — CLI failure should not blank the UI
          err(
            (result.stderr || result.stdout || "nt refresh failed").trim().slice(0, 400)
          );
        }
      }
      const snap = await api.loadSnapshot();
      get().applySnapshot(snap);
      try {
        const fp = await api.getDataFingerprint();
        set({ lastFingerprint: fp });
      } catch {
        /* ignore */
      }
      log("Data reloaded from disk");
      if (cliOk) toast("Data refreshed");
      else toast("Files reloaded (CLI had an error)");
    } catch (e) {
      set({ refreshing: false });
      err(String(e));
    }
  },

  runNt: async (args) => {
    if (!api.isTauri() || useAppStore.getState().settings.demoMode) {
      const fake: CommandResult = {
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: "CLI commands require a live tracker folder in the desktop app.",
        command: `python -m nt ${args.join(" ")}`,
      };
      log(fake.stderr);
      return fake;
    }
    // PR10: ledger mutations (live recommend / place-ack / abandon / settle) need confirm.
    if (!confirmLedgerMutation(args)) {
      const cancelled: CommandResult = {
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: "Cancelled by operator (ledger mutation confirm).",
        command: `python -m nt ${args.join(" ")}`,
      };
      log(cancelled.stderr);
      toast("Command cancelled");
      return cancelled;
    }
    set({ refreshing: true });
    try {
      const result = await api.runNtCommand(args);
      log(`${result.command} → exit ${result.exit_code}`);
      if (result.stdout) log(result.stdout.slice(0, 500));
      if (result.stderr) log(result.stderr.slice(0, 500));
      // Always reload files after CLI
      const snap = await api.loadSnapshot();
      get().applySnapshot(snap);
      toast(result.ok ? `nt ${args[0]} OK` : `nt ${args[0]} failed`);
      return result;
    } catch (e) {
      set({ refreshing: false });
      err(String(e));
      return {
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: String(e),
        command: `python -m nt ${args.join(" ")}`,
      };
    }
  },

  pullGit: async () => {
    if (!api.isTauri()) {
      return {
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: "Git requires desktop app",
        command: "git pull",
      };
    }
    set({ refreshing: true });
    try {
      const result = await api.gitPull();
      log(`${result.command} → ${result.ok ? "OK" : "FAIL"}`);
      if (result.stdout) log(result.stdout);
      if (result.stderr) log(result.stderr);
      const snap = await api.loadSnapshot();
      get().applySnapshot(snap);
      toast(result.ok ? "Git pull complete" : "Git pull failed");
      return result;
    } catch (e) {
      set({ refreshing: false });
      err(String(e));
      return {
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: String(e),
        command: "git pull --ff-only",
      };
    }
  },

  fetchGit: async () => {
    if (!api.isTauri()) {
      return {
        ok: false,
        exit_code: -1,
        stdout: "",
        stderr: "Git requires desktop app",
        command: "git fetch",
      };
    }
    const result = await api.gitFetch();
    log(`${result.command} → ${result.ok ? "OK" : "FAIL"}`);
    const snap = await api.loadSnapshot();
    get().applySnapshot(snap);
    return result;
  },

  checkFingerprint: async () => {
    if (!api.isTauri() || useAppStore.getState().settings.demoMode) return false;
    try {
      const fp = await api.getDataFingerprint();
      if (fp && fp !== get().lastFingerprint) {
        set({ lastFingerprint: fp });
        await get().refresh();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  },
}));
