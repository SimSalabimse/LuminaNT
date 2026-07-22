import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileInput,
  FileOutput,
  Flag,
  Layers,
  Loader2,
  Play,
  Radar,
  Rocket,
  Target,
  Terminal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { writeInboxFile, isTauri } from "@/lib/tauri";
import { parsePhasesFromConfig, progressToNextPhase } from "@/lib/plan";
import { parsePlaceTheseMd } from "@/lib/capital";
import { cn, formatNokPlain, formatPct } from "@/lib/utils";
import { SettleDesk } from "@/components/ops/SettleDesk";
import {
  evaluateBoardFreshness,
  oddsMtimeFromInbox,
  stampBoardSticky,
  type BoardSticky,
} from "@/lib/boardFreshness";

/** Board-first desk order (PR5). Aux commands stay available below. */
const COMMANDS: {
  id: string;
  label: string;
  hint: string;
  primary?: boolean;
  group: "board" | "aux";
}[] = [
  {
    id: "board",
    label: "Board",
    hint: "research board · shortlist + coverage",
    primary: true,
    group: "board",
  },
  {
    id: "ready",
    label: "Ready",
    hint: "research ready · gate before recommend",
    group: "board",
  },
  {
    id: "recommend",
    label: "Recommend",
    hint: "Build place slip (dry-run default)",
    primary: true,
    group: "board",
  },
  {
    id: "place-ack",
    label: "Place-ack",
    hint: "Pending → ConfirmedPlaced",
    group: "board",
  },
  {
    id: "abandon",
    label: "Abandon",
    hint: "Free open risk · P/L 0",
    group: "board",
  },
  { id: "status", label: "Status", hint: "Equity · phase · cap", group: "aux" },
  {
    id: "validate",
    label: "Validate",
    hint: "Ledger integrity",
    group: "aux",
  },
  { id: "refresh", label: "Refresh", hint: "Recompute state", group: "aux" },
  { id: "learn", label: "Learn", hint: "Sport/market mults", group: "aux" },
  { id: "settle", label: "Settle", hint: "Apply results file", group: "aux" },
];

/**
 * Ops workspace — board-first CLI + phase management dock.
 * PR5: research board → ready → recommend → place-ack / abandon (D14 freshness).
 */
export function Ops() {
  const snapshot = useDataStore((s) => s.snapshot);
  const runNt = useDataStore((s) => s.runNt);
  const refreshing = useDataStore((s) => s.refreshing);
  const demo = useAppStore((s) => s.settings.demoMode);
  const commandLog = useAppStore((s) => s.commandLog);
  const clearLog = useAppStore((s) => s.clearLog);
  const pushLog = useAppStore((s) => s.pushLog);
  const setToast = useAppStore((s) => s.setToast);
  const setError = useAppStore((s) => s.setError);
  const setView = useAppStore((s) => s.setView);
  const filterScope = useAppStore((s) => s.filterScope);

  const [oddsPath, setOddsPath] = useState("inbox/current_odds_01.txt");
  const [resultsPath, setResultsPath] = useState("inbox/results_template.yaml");
  /** Dry-run default — live recommend only after operator unchecks. */
  const [dryRun, setDryRun] = useState(true);
  /** Soft-gate override — requires confirm at run time. */
  const [allowLowCoverage, setAllowLowCoverage] = useState(false);
  const [writeScaffolds, setWriteScaffolds] = useState(false);
  const [betIds, setBetIds] = useState("");
  const [abandonReason, setAbandonReason] = useState("not_placed");
  /** D14 sticky: set only after successful research board. */
  const [boardSticky, setBoardSticky] = useState<BoardSticky | null>(null);
  /** One-shot override when board is stale (live recommend only). */
  const [forceStaleBoard, setForceStaleBoard] = useState(false);
  const [lastOutput, setLastOutput] = useState("");
  const [inboxName, setInboxName] = useState("");
  const [inboxContent, setInboxContent] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [showPlansMd, setShowPlansMd] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [ioTab, setIoTab] = useState<"outbox" | "inbox">("outbox");

  const phase = snapshot?.phase || {};
  const bankroll = snapshot?.bankroll || {};
  const risk = snapshot?.risk || {};
  const equity = Number(bankroll.equity_nok ?? phase.equity_nok) || 0;
  const settled = Number(phase.settled_count ?? bankroll.settled_count) || 0;
  const phaseId = String(phase.phase_id || "—");
  const reasons = Array.isArray(phase.reasons) ? phase.reasons.map(String) : [];

  const ladder = useMemo(
    () => parsePhasesFromConfig(snapshot?.config_raw || ""),
    [snapshot?.config_raw]
  );
  const progress = useMemo(
    () => progressToNextPhase(equity, settled, phaseId, ladder),
    [equity, settled, phaseId, ladder]
  );

  const inbox = snapshot?.inbox || [];
  const outbox = snapshot?.outbox || [];
  const placeThese = snapshot?.place_these || "";

  const currentOddsMtimeMs = useMemo(
    () => oddsMtimeFromInbox(oddsPath, inbox),
    [oddsPath, inbox]
  );

  const boardFreshness = useMemo(
    () =>
      evaluateBoardFreshness({
        sticky: boardSticky,
        oddsPath,
        currentOddsMtimeMs,
      }),
    [boardSticky, oddsPath, currentOddsMtimeMs]
  );

  const run = async (id: string) => {
    let args: string[] = [];

    if (id === "status") args = ["status"];
    else if (id === "validate") args = ["validate"];
    else if (id === "refresh") args = ["refresh"];
    else if (id === "learn") args = ["learn"];
    else if (id === "board") {
      args = ["research", "board", "--odds", oddsPath];
      if (writeScaffolds) args.push("--write-scaffolds");
    } else if (id === "ready") {
      args = ["research", "ready", "--odds", oddsPath];
    } else if (id === "recommend") {
      // D14: live recommend requires fresh board sticky (or explicit force).
      if (!dryRun && !boardFreshness.fresh && !forceStaleBoard) {
        setError(
          `Board not fresh (${boardFreshness.label}): ${boardFreshness.reason} ` +
            `Run Board first, or enable “Force recommend without fresh board”.`
        );
        return;
      }
      if (allowLowCoverage) {
        const ok = window.confirm(
          "Override Coverage Health critical soft gate?\n\n" +
            "Only use after deep packs on the survivable band. " +
            "This does not soften EV/haircut/capital rails."
        );
        if (!ok) {
          setToast("Recommend cancelled — allow-low-coverage not confirmed");
          return;
        }
      }
      if (!dryRun) {
        const okLive = window.confirm(
          "Live recommend will append Pending rows to the ledger.\n\n" +
            "Confirm odds path and board freshness, then place on NT and place-ack."
        );
        if (!okLive) {
          setToast("Live recommend cancelled");
          return;
        }
      }
      args = ["recommend", "--odds", oddsPath];
      if (dryRun) args.push("--dry-run");
      if (allowLowCoverage) args.push("--allow-low-coverage");
    } else if (id === "place-ack") {
      const ids = betIds.trim();
      if (!ids) {
        setError("place-ack requires --ids (comma-separated bet_id list)");
        return;
      }
      args = ["place-ack", "--ids", ids];
    } else if (id === "abandon") {
      const ids = betIds.trim();
      if (!ids) {
        setError("abandon requires --ids (comma-separated bet_id list)");
        return;
      }
      const reason = abandonReason.trim() || "not_placed";
      const ok = window.confirm(
        `Abandon bet(s) ${ids}?\nReason: ${reason}\n\nFrees open risk · P/L 0.`
      );
      if (!ok) {
        setToast("Abandon cancelled");
        return;
      }
      args = ["abandon", "--ids", ids, "--reason", reason];
    } else if (id === "settle") {
      args = ["settle", "--results", resultsPath];
    } else {
      setError(`Unknown command: ${id}`);
      return;
    }

    const res = await runNt(args);
    setLastOutput(
      [`$ ${res.command}`, res.stdout, res.stderr].filter(Boolean).join("\n\n")
    );

    // D14: stamp sticky only after successful board for this odds path.
    if (id === "board" && res.ok) {
      const mtime =
        oddsMtimeFromInbox(oddsPath, useDataStore.getState().snapshot?.inbox) ??
        currentOddsMtimeMs;
      setBoardSticky(
        stampBoardSticky({
          oddsPath,
          oddsMtimeMs: mtime,
        })
      );
      setForceStaleBoard(false);
      setToast("Board sticky stamped (D14 fresh)");
    }
    if (id === "recommend" && res.ok && !dryRun) {
      setForceStaleBoard(false);
    }
  };

  const saveInbox = async () => {
    if (!inboxName.trim() || !inboxContent.trim()) {
      setError("Filename and content required");
      return;
    }
    if (!isTauri() || demo) {
      setError(
        "Writing inbox files requires a live tracker folder in the desktop app."
      );
      return;
    }
    try {
      const path = await writeInboxFile(inboxName.trim(), inboxContent);
      pushLog(`Wrote ${path}`);
      setToast(`Saved ${inboxName}`);
      setInboxContent("");
      await useDataStore.getState().refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="page-shell !max-w-[1720px] !space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2">
            <Radar className="h-7 w-7 text-primary" />
            Ops · CLI
          </h1>
          <p className="page-subtitle">
            Board-first · ready · recommend · place-ack · settle
            {filterScope === "filtered" && (
              <span className="text-primary"> · filtered scope active</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => setView("capital")}
          >
            Bankroll plan →
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setView("bets")}
          >
            Ledger →
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setView("performance")}
          >
            Analyze →
          </Button>
        </div>
      </div>

      {demo && (
        <p className="text-xs text-pending glass rounded-lg px-3 py-2 border border-pending/25">
          Demo mode: CLI and inbox writes are disabled. Connect a tracker folder
          in Settings.
        </p>
      )}

      {/* Shared odds path + D14 freshness strip */}
      <div className="glass rounded-xl p-3 holo-border flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground">
            Odds file (board · ready · recommend)
          </Label>
          <Input
            className="h-8 font-mono text-[11px]"
            value={oddsPath}
            onChange={(e) => {
              setOddsPath(e.target.value);
              setForceStaleBoard(false);
            }}
            list="ops-inbox-files"
          />
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-[11px] sm:max-w-sm shrink-0",
            boardFreshness.fresh
              ? "border-profit/30 bg-profit/10 text-profit"
              : "border-pending/35 bg-pending/10 text-pending"
          )}
        >
          <div className="font-semibold flex items-center gap-1.5">
            {boardFreshness.fresh ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            Board {boardFreshness.label}
          </div>
          <p className="text-muted-foreground mt-0.5 leading-snug">
            {boardFreshness.reason}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4 min-h-0">
        {/* ── Left: Workflow essentials ── */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-w-0">
          <div className="section-label flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Board-first desk
          </div>
          {/* Command grid — board path first */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {COMMANDS.filter((c) => c.group === "board").map((c) => (
              <div
                key={c.id}
                className={cn(
                  "glass rounded-xl p-3 flex flex-col gap-2.5 holo-border relative overflow-hidden",
                  c.primary && "ring-1 ring-primary/25"
                )}
              >
                {c.primary && (
                  <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-primary" />
                      nt {c.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.hint}
                    </p>
                  </div>
                </div>

                {c.id === "board" && (
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={writeScaffolds}
                      onChange={(e) => setWriteScaffolds(e.target.checked)}
                    />
                    --write-scaffolds
                  </label>
                )}

                {c.id === "recommend" && (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={dryRun}
                        onChange={(e) => setDryRun(e.target.checked)}
                      />
                      --dry-run (default)
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={allowLowCoverage}
                        onChange={(e) => setAllowLowCoverage(e.target.checked)}
                      />
                      --allow-low-coverage
                      <span className="text-pending">(confirm)</span>
                    </label>
                    {!boardFreshness.fresh && (
                      <label className="flex items-start gap-2 text-[11px] text-pending">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={forceStaleBoard}
                          onChange={(e) =>
                            setForceStaleBoard(e.target.checked)
                          }
                        />
                        Force live recommend without fresh board (D14 override)
                      </label>
                    )}
                  </div>
                )}

                {(c.id === "place-ack" || c.id === "abandon") && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Bet IDs
                    </Label>
                    <Input
                      className="h-7 font-mono text-[11px]"
                      placeholder="id1,id2"
                      value={betIds}
                      onChange={(e) => setBetIds(e.target.value)}
                    />
                    {c.id === "abandon" && (
                      <>
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          Reason
                        </Label>
                        <Input
                          className="h-7 font-mono text-[11px]"
                          value={abandonReason}
                          onChange={(e) => setAbandonReason(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  variant={c.primary ? "default" : "outline"}
                  disabled={demo || refreshing}
                  onClick={() => run(c.id)}
                  className="mt-auto h-8"
                >
                  {refreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : c.id === "place-ack" ? (
                    <ClipboardCheck className="h-3.5 w-3.5" />
                  ) : c.id === "abandon" ? (
                    <Trash2 className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Run
                </Button>
              </div>
            ))}
          </div>

          <div className="section-label flex items-center gap-1.5 mt-1">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            Aux
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {COMMANDS.filter((c) => c.group === "aux").map((c) => (
              <div
                key={c.id}
                className="glass rounded-xl p-3 flex flex-col gap-2.5 holo-border relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                      nt {c.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.hint}
                    </p>
                  </div>
                </div>

                {c.id === "settle" && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Results file
                    </Label>
                    <Input
                      className="h-7 font-mono text-[11px]"
                      value={resultsPath}
                      onChange={(e) => setResultsPath(e.target.value)}
                      list="ops-inbox-files"
                    />
                  </div>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  disabled={demo || refreshing}
                  onClick={() => run(c.id)}
                  className="mt-auto h-8"
                >
                  {refreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Run
                </Button>
              </div>
            ))}
          </div>

          <datalist id="ops-inbox-files">
            {inbox.map((f) => (
              <option key={f.path} value={`inbox/${f.name}`} />
            ))}
          </datalist>

          <SettleDesk />

          {lastOutput && (
            <div className="glass rounded-xl p-3 holo-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Last command</h3>
              </div>
              <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-muted-foreground">
                {lastOutput}
              </pre>
            </div>
          )}

          {/* Outbox / Inbox */}
          <div className="glass rounded-2xl p-3 holo-border flex flex-col min-h-0 flex-1">
            <div className="flex items-center gap-1 mb-3">
              <button
                type="button"
                onClick={() => setIoTab("outbox")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  ioTab === "outbox"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileOutput className="h-3.5 w-3.5" />
                Outbox · PLACE_THESE
              </button>
              <button
                type="button"
                onClick={() => setIoTab("inbox")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  ioTab === "inbox"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileInput className="h-3.5 w-3.5" />
                Inbox ({inbox.length})
              </button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowComposer((v) => !v)}
              >
                Compose
              </Button>
            </div>

            {ioTab === "outbox" && (
              <div className="space-y-2 min-h-0 flex-1 flex flex-col">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-[10px]">
                    PLACE_THESE.md
                  </Badge>
                  {outbox
                    .filter((f) => !f.is_dir && f.name !== "PLACE_THESE.md")
                    .slice(0, 8)
                    .map((f) => (
                      <Badge
                        key={f.path}
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {f.name}
                      </Badge>
                    ))}
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3 max-h-[360px] overflow-y-auto flex-1">
                  {placeThese ? (
                    <PlaceSlipPreview md={placeThese} />
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No place slip yet — board-first:{" "}
                      <strong className="text-foreground">Board</strong> → Ready
                      → <strong className="text-foreground">Recommend</strong>.
                    </p>
                  )}
                </div>
                {placeThese && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setView("shortlist")}
                    >
                      Open Shortlist →
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setView("bets")}
                    >
                      Ledger
                    </Button>
                  </div>
                )}
              </div>
            )}

            {ioTab === "inbox" && (
              <div className="grid sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto">
                {inbox.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full py-4">
                    Inbox is empty.
                  </p>
                )}
                {inbox.map((f) => (
                  <div
                    key={f.path}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="font-mono text-xs font-medium truncate">
                      {f.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {(f.size / 1024).toFixed(1)} KB ·{" "}
                      {f.modified?.slice(0, 19) || "—"}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 mt-1 px-2 text-xs"
                      onClick={() => {
                        if (
                          f.name.endsWith(".yaml") ||
                          f.name.endsWith(".yml")
                        ) {
                          setResultsPath(`inbox/${f.name}`);
                        } else {
                          setOddsPath(`inbox/${f.name}`);
                        }
                        setToast(`Selected inbox/${f.name}`);
                      }}
                    >
                      Use path
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showComposer && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Write odds CSV or results YAML into{" "}
                  <code className="text-primary">inbox/</code>
                </p>
                <Input
                  className="font-mono text-xs h-8"
                  placeholder="odds_YYYY-MM-DD.csv"
                  value={inboxName}
                  onChange={(e) => setInboxName(e.target.value)}
                />
                <Textarea
                  className="font-mono text-xs min-h-[120px]"
                  placeholder={"date,match,selection,decimal_odds,...\n..."}
                  value={inboxContent}
                  onChange={(e) => setInboxContent(e.target.value)}
                />
                <Button size="sm" onClick={saveInbox} disabled={demo}>
                  Save to inbox
                </Button>
              </div>
            )}
          </div>

          {/* Command log accordion */}
          <div className="glass rounded-xl overflow-hidden holo-border">
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.02]"
            >
              <span className="text-sm font-medium">Command log</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showLog && "rotate-180"
                )}
              />
            </button>
            {showLog && (
              <div className="px-3 pb-3 border-t border-white/[0.05]">
                <div className="flex justify-end py-2">
                  <Button size="sm" variant="ghost" onClick={clearLog}>
                    Clear
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px] text-muted-foreground">
                  {commandLog.length === 0 && <p>No commands yet.</p>}
                  {commandLog.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border-b border-border/30 py-1",
                        line.includes("ERROR") && "text-loss"
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Phase dock ── */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-w-0">
          {/* Current phase */}
          <div className="glass rounded-2xl p-4 holo-border relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
            <div className="section-label flex items-center gap-1.5 relative">
              <Target className="h-3.5 w-3.5 text-primary" />
              Current phase
            </div>
            <div className="mt-2 text-3xl font-bold text-primary tracking-tight relative">
              {phaseId}
              <span className="text-base font-medium text-muted-foreground ml-2">
                {String(phase.label || "")}
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground relative">
              <div>
                Equity phase:{" "}
                <span className="text-foreground">
                  {String(phase.equity_phase || "—")}
                </span>
                {" · "}
                Count:{" "}
                <span className="text-foreground">
                  {String(phase.count_phase || "—")}
                </span>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
                <div className="section-label !text-[9px] mb-0.5">
                  Stake band
                </div>
                <div className="text-sm font-semibold tabular-nums text-primary">
                  {phase.stake_min != null && phase.stake_max != null
                    ? `${phase.stake_min}–${phase.stake_max} NOK`
                    : "—"}
                </div>
                <div className="text-[11px] mt-0.5">
                  Max {phase.max_bets_per_round ?? "—"}/round · doubles{" "}
                  {phase.max_doubles_per_round ?? 0}
                </div>
              </div>
              <div>
                Rolling ROI {formatPct(Number(phase.rolling_roi) || 0)} · DD{" "}
                {((Number(phase.drawdown_from_peak_pct) || 0) * 100).toFixed(1)}
                %
              </div>
              <div>
                Daily cap {formatNokPlain(Number(risk.daily_risk_cap_nok))} ·
                remaining {formatNokPlain(Number(risk.remaining_risk_nok))}
              </div>
            </div>
          </div>

          {/* Path to next */}
          <div className="glass rounded-2xl p-4 holo-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                Path to next
              </h3>
              {progress.next ? (
                <Badge variant="secondary" className="text-[10px]">
                  Next: {progress.next.id}
                </Badge>
              ) : (
                <Badge className="bg-profit/15 text-profit border-0 text-[10px]">
                  Top of ladder
                </Badge>
              )}
            </div>
            {progress.next ? (
              <>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-800 to-amber-500 transition-all"
                    style={{
                      width: `${Math.round(progress.equityProgress * 100)}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Equity gap
                    </div>
                    <div className="font-semibold tabular-nums text-[15px]">
                      {progress.equityGap > 0
                        ? `${formatNokPlain(progress.equityGap)} NOK to ${formatNokPlain(progress.next.enter_equity)}`
                        : "Equity threshold met"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Now {formatNokPlain(equity)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Settled sample
                    </div>
                    <div className="font-semibold tabular-nums text-[15px]">
                      {settled} settled
                      {progress.settledGap > 0
                        ? ` · need +${progress.settledGap}`
                        : " · count gate OK"}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Highest configured phase.
              </p>
            )}

            {reasons.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase text-muted-foreground mb-1.5">
                  Phase reasons
                </div>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {reasons.map((r, i) => (
                    <li
                      key={i}
                      className="text-[11px] font-mono text-muted-foreground border-l-2 border-primary/40 pl-2"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Compact ladder */}
          <div className="glass rounded-2xl overflow-hidden holo-border flex-1 min-h-0 flex flex-col">
            <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
              <Flag className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold">Phase ladder</h3>
            </div>
            <div className="overflow-auto flex-1 min-h-0 max-h-[280px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur z-[1]">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/[0.05]">
                    <th className="text-left px-2 py-1.5 font-semibold">ID</th>
                    <th className="text-right px-2 py-1.5 font-semibold">
                      Equity
                    </th>
                    <th className="text-right px-2 py-1.5 font-semibold">
                      Stake
                    </th>
                    <th className="text-right px-2 py-1.5 font-semibold">
                      Risk%
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map((p) => {
                    const active = p.id === phaseId;
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-b border-white/[0.04]",
                          active && "bg-primary/10"
                        )}
                      >
                        <td className="px-2 py-1.5 font-semibold">
                          {p.id}
                          {active && (
                            <span className="ml-1 text-[9px] text-primary">
                              you
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                          {formatNokPlain(p.enter_equity, 0)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                          {p.stake_min}–{p.stake_max}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                          {(p.daily_risk_pct * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                  {ladder.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-3 text-muted-foreground"
                      >
                        Could not parse phases from config.yaml
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collapsed plan markdown */}
          <div className="glass rounded-xl overflow-hidden holo-border">
            <button
              type="button"
              onClick={() => setShowPlansMd((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.02]"
            >
              <span className="text-sm font-medium">
                PHASE_PLAN / BANKROLL_PLAN
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showPlansMd && "rotate-180"
                )}
              />
            </button>
            {showPlansMd && (
              <div className="px-3 pb-3 border-t border-white/[0.05] space-y-3 max-h-64 overflow-y-auto">
                <div>
                  <div className="section-label mt-2 mb-1">PHASE_PLAN</div>
                  <div className="prose-invert-soft text-xs">
                    {snapshot?.phase_plan_md ? (
                      <ReactMarkdown>{snapshot.phase_plan_md}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">Not found.</p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="section-label mb-1">BANKROLL_PLAN</div>
                  <div className="prose-invert-soft text-xs">
                    {snapshot?.bankroll_plan_md ? (
                      <ReactMarkdown>{snapshot.bankroll_plan_md}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">Not found.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact place-slip cards for Ops outbox (not raw markdown dump). */
function PlaceSlipPreview({ md }: { md: string }) {
  const cards = parsePlaceTheseMd(md);
  if (cards.length === 0) {
    return (
      <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {md.slice(0, 1200)}
        {md.length > 1200 ? "…" : ""}
      </pre>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground mb-2">
        {cards.length} selection{cards.length === 1 ? "" : "s"} · ranked for Shortlist
      </p>
      {cards.map((c, i) => (
        <div
          key={c.id}
          className="rounded-xl border border-white/[0.08] bg-card/80 px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          <span className="font-mono text-[11px] font-bold text-primary">#{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{c.match}</div>
            <div className="text-[12px] text-muted-foreground truncate">{c.selection}</div>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            {c.odds ? c.odds.toFixed(2) : "—"}
          </div>
          <div className="font-mono text-sm font-semibold text-primary tabular-nums">
            {c.stake ? formatNokPlain(c.stake) : "—"}
          </div>
          {c.ev != null && (
            <div
              className={cn(
                "font-mono text-xs tabular-nums",
                c.ev >= 0 ? "text-profit" : "text-loss"
              )}
            >
              {c.ev >= 0 ? "+" : ""}
              {(c.ev * 100).toFixed(1)}%
            </div>
          )}
          {c.grade && (
            <Badge variant="outline" className="text-[10px]">
              {c.grade}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}
