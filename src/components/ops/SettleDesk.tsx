/**
 * Smart settlement desk — batch settle with rich fields + auto-fetch assists.
 */
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { isTauri, writeTextFile } from "@/lib/tauri";
import {
  extractSettleJson,
  hasAmbiguousMatchError,
  settleErrorMessages,
} from "@/lib/settleJson";
import { cn, formatNokPlain } from "@/lib/utils";

export type SettleDraftRow = {
  bet_id: string;
  date?: string;
  match?: string;
  selection?: string;
  decimal_odds?: string | number;
  stake_nok?: string | number;
  sport?: string;
  research_grade?: string;
  suggested_outcome?: string | null;
  suggested_score?: string | null;
  suggested_confidence?: number | null;
  suggested_reason?: string | null;
  auto_fetch_ok?: boolean;
  needs_manual?: boolean;
  fetch_source?: string | null;
  fetcher?: string | null;
  match_confidence?: number | null;
  fetch_status?: string | null;
  fetch_finished?: boolean | null;
  outcome?: string | null;
  score?: string | null;
  variance_tag?: string;
  research_quality_retro?: string;
  confidence_retro?: string | number;
  key_events?: string;
  notes?: string;
  include?: boolean;
};

type SettleDraft = {
  n_pending: number;
  n_auto_suggested: number;
  n_high_confidence?: number;
  suggestions_by_fetcher?: Record<string, number>;
  fetchers_available?: string[];
  draft: SettleDraftRow[];
  generated_at?: string;
};

const VARIANCE_OPTS = [
  { v: "", label: "—" },
  { v: "expected", label: "Expected / skill" },
  { v: "variance", label: "Variance / luck" },
  { v: "process_error", label: "Research miss" },
];

const RETRO_OPTS = [
  { v: "", label: "—" },
  { v: "good", label: "Good research" },
  { v: "ok", label: "OK" },
  { v: "poor", label: "Poor / wrong" },
];

export function SettleDesk() {
  const runNt = useDataStore((s) => s.runNt);
  const refresh = useDataStore((s) => s.refresh);
  const snapshot = useDataStore((s) => s.snapshot);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setToast = useAppStore((s) => s.setToast);
  const setError = useAppStore((s) => s.setError);
  const pushLog = useAppStore((s) => s.pushLog);
  const setView = useAppStore((s) => s.setView);

  const [draft, setDraft] = useState<SettleDraft | null>(null);
  const [rows, setRows] = useState<SettleDraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastReview, setLastReview] = useState<Record<string, unknown> | null>(
    null
  );
  const [lastSettleErrors, setLastSettleErrors] = useState<string[]>([]);
  const [autoFetch, setAutoFetch] = useState(true);

  const loadDraft = useCallback(async () => {
    if (demo || !isTauri()) {
      // Demo: pending from snapshot bets
      const pending = (useDataStore.getState().bets || []).filter(
        (b) => String(b.result).toLowerCase() === "pending"
      );
      const d: SettleDraftRow[] = pending.map((b) => ({
        bet_id: b.bet_id,
        date: b.date,
        match: b.match,
        selection: b.selection,
        decimal_odds: b.decimal_odds,
        stake_nok: b.stake_nok,
        sport: b.sport,
        research_grade: b.research_grade,
        outcome: null,
        score: "",
        variance_tag: "",
        research_quality_retro: "",
        confidence_retro: "",
        key_events: "",
        notes: "",
        include: false,
        needs_manual: true,
      }));
      setDraft({ n_pending: d.length, n_auto_suggested: 0, draft: d });
      setRows(d);
      return;
    }
    setLoading(true);
    try {
      const args = ["settle", "--draft"];
      if (!autoFetch) args.push("--no-fetch");
      const res = await runNt(args);
      const text = res.stdout || "";
      // stdout may include log noise — parse last JSON object
      const start = text.indexOf("{");
      const jsonStr = start >= 0 ? text.slice(start) : text;
      const parsed = JSON.parse(jsonStr) as SettleDraft;
      setDraft(parsed);
      setRows(parsed.draft || []);
      setToast(
        `Settle draft: ${parsed.n_pending} pending · ${parsed.n_auto_suggested} auto-suggested`
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [autoFetch, demo, runNt, setError, setToast]);

  useEffect(() => {
    // lazy: don't auto-fetch on mount every time (can be slow); user clicks Load
  }, []);

  const patchRow = (id: string, patch: Partial<SettleDraftRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.bet_id === id ? { ...r, ...patch } : r))
    );
  };

  const applySuggestion = (r: SettleDraftRow) => {
    if (!r.suggested_outcome) return;
    patchRow(r.bet_id, {
      outcome: r.suggested_outcome,
      score: r.suggested_score || r.score || "",
      include: true,
      notes: r.suggested_reason
        ? `auto: ${r.suggested_reason}`
        : r.notes || "",
    });
  };

  const applyAllSuggestions = () => {
    setRows((prev) =>
      prev.map((r) =>
        r.suggested_outcome
          ? {
              ...r,
              outcome: r.suggested_outcome,
              score: r.suggested_score || r.score || "",
              include: true,
              notes: r.suggested_reason
                ? `auto: ${r.suggested_reason}`
                : r.notes || "",
            }
          : r
      )
    );
  };

  const included = rows.filter((r) => r.include && r.outcome);

  const submit = async () => {
    if (!included.length) {
      setError("Select at least one bet with an outcome");
      return;
    }
    if (demo || !isTauri()) {
      setError("Settlement requires desktop app + live tracker");
      return;
    }
    setSubmitting(true);
    setLastReview(null);
    setLastSettleErrors([]);
    try {
      // Always bet_id-first — engine fail-closed on ambiguous match/selection
      const items = included.map((r) => ({
        bet_id: r.bet_id,
        outcome: r.outcome,
        score: r.score || undefined,
        variance_tag: r.variance_tag || undefined,
        research_quality_retro: r.research_quality_retro || undefined,
        confidence_retro: r.confidence_retro
          ? Number(r.confidence_retro)
          : undefined,
        key_events: r.key_events || undefined,
        notes: r.notes || undefined,
        auto_fetched: Boolean(
          r.suggested_outcome && r.outcome === r.suggested_outcome
        ),
      }));

      const root = snapshot?.meta.repo_root || "";
      if (!root || root.startsWith("(")) {
        throw new Error("No tracker root");
      }
      const itemsPath = `${root.replace(/[/\\]$/, "")}/inbox/_settle_items.json`;
      await writeTextFile(
        itemsPath,
        JSON.stringify({ results: items }, null, 2)
      );
      const res = await runNt([
        "settle",
        "--items-json",
        "inbox/_settle_items.json",
      ]);
      pushLog(res.stdout?.slice(0, 1200) || "");
      const parsed = extractSettleJson(res.stdout || "");
      const errMsgs = settleErrorMessages(parsed);
      setLastSettleErrors(errMsgs);
      if (parsed) {
        const review =
          (parsed.review as Record<string, unknown> | undefined) || parsed;
        setLastReview(review);
        const nOk = Array.isArray(parsed.settled)
          ? (parsed.settled as unknown[]).length
          : 0;
        if (errMsgs.length > 0) {
          setToast(
            `Settled ${nOk} · ${errMsgs.length} error(s)` +
              (hasAmbiguousMatchError(errMsgs)
                ? " · ambiguous match — use bet_id only"
                : "")
          );
          if (hasAmbiguousMatchError(errMsgs)) {
            setError(
              "Ambiguous pending match — engine refused silent pick. Settle by bet_id only (desk already sends bet_id; check item without id in CLI/YAML)."
            );
          }
        } else {
          setToast(
            `Settled ${nOk || included.length} · equity ${String(parsed.equity ?? "—")}`
          );
        }
      } else {
        setToast("Settlement command finished (could not parse JSON)");
      }
      await refresh({ runNtRefresh: true });
      await loadDraft();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 holo-border space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Smart settle
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">
            Batch-settle pending bets with score, variance vs skill, and research
            retro. Auto-fetch assists football where possible. Engine fail-closed
            on ambiguous match without bet_id.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={autoFetch}
              onChange={(e) => setAutoFetch(e.target.checked)}
            />
            Auto-fetch
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || demo}
            onClick={() => loadDraft()}
            className="h-8 gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Load pending
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.some((r) => r.suggested_outcome)}
            onClick={applyAllSuggestions}
            className="h-8 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Apply all suggestions
          </Button>
          <Button
            size="sm"
            disabled={submitting || !included.length || demo}
            onClick={() => submit()}
            className="h-8 gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Settle {included.length || ""}
          </Button>
        </div>
      </div>

      {draft && (
        <div className="flex flex-wrap gap-2 text-[11px] items-center">
          <Badge variant="secondary">{draft.n_pending} pending</Badge>
          <Badge
            variant="outline"
            className="border-cyan-500/30 text-cyan-200"
          >
            {draft.n_auto_suggested} auto-suggested
          </Badge>
          {typeof draft.n_high_confidence === "number" && (
            <Badge
              variant="outline"
              className="border-profit/30 text-profit"
            >
              {draft.n_high_confidence} high confidence
            </Badge>
          )}
          {draft.fetchers_available && draft.fetchers_available.length > 0 && (
            <span className="text-muted-foreground">
              Fetchers: {draft.fetchers_available.join(", ")}
            </span>
          )}
          {draft.generated_at && (
            <span className="text-muted-foreground">
              Draft {new Date(draft.generated_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {lastSettleErrors.length > 0 && (
        <div className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2.5 space-y-1.5">
          <div className="text-[11px] font-semibold text-loss uppercase tracking-wide">
            Settlement errors ({lastSettleErrors.length})
          </div>
          {hasAmbiguousMatchError(lastSettleErrors) && (
            <p className="text-[12px] text-foreground/90">
              Ambiguous match — engine will not pick a ticket silently. Use{" "}
              <span className="font-mono">bet_id</span> only (desk rows already
              include it).
            </p>
          )}
          <ul className="text-[11px] font-mono text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
            {lastSettleErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {!rows.length && !loading && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Click <strong>Load pending</strong> to build a settle sheet
          {demo ? " (demo: from local pending bets)" : ""}.
        </p>
      )}

      {rows.length > 0 && (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {rows.map((r) => {
            const odds = Number(r.decimal_odds) || 0;
            const stake = Number(r.stake_nok) || 0;
            return (
              <div
                key={r.bet_id}
                className={cn(
                  "rounded-xl border p-3 space-y-2 transition-colors",
                  r.include
                    ? "border-primary/35 bg-primary/[0.06]"
                    : "border-white/[0.06] bg-black/20"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex items-start gap-2 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(r.include)}
                      onChange={(e) =>
                        patchRow(r.bet_id, { include: e.target.checked })
                      }
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.match}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.selection} · @{odds.toFixed(2)} · stake{" "}
                        {formatNokPlain(stake)} · {r.sport || "?"} · grade{" "}
                        {r.research_grade || "—"}
                      </div>
                      {r.suggested_outcome && (
                        <button
                          type="button"
                          className="text-[11px] text-cyan-300 hover:underline mt-0.5 text-left"
                          onClick={() => applySuggestion(r)}
                        >
                          Suggest: {r.suggested_outcome}
                          {r.suggested_score
                            ? ` · ${r.suggested_score}`
                            : ""}{" "}
                          (
                          {r.suggested_confidence != null
                            ? `${Math.round(Number(r.suggested_confidence) * 100)}%`
                            : "?"}
                          )
                          {r.auto_fetch_ok ? " · ready" : " · verify"} — click to
                          apply
                        </button>
                      )}
                      {(r.fetcher || r.fetch_source || r.suggested_reason) && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
                          {(r.fetcher || r.fetch_source) && (
                            <div>
                              Source:{" "}
                              <span className="font-mono">
                                {r.fetcher || "?"}
                                {r.fetch_source ? ` · ${r.fetch_source}` : ""}
                              </span>
                              {r.match_confidence != null && (
                                <span>
                                  {" "}
                                  · name match{" "}
                                  {Math.round(Number(r.match_confidence) * 100)}%
                                </span>
                              )}
                              {r.needs_manual && !r.suggested_outcome && (
                                <span className="text-pending">
                                  {" "}
                                  · needs manual
                                </span>
                              )}
                            </div>
                          )}
                          {r.suggested_reason && <div>{r.suggested_reason}</div>}
                        </div>
                      )}
                    </div>
                  </label>
                  <div className="flex gap-1 shrink-0">
                    {(["win", "loss", "refund"] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() =>
                          patchRow(r.bet_id, {
                            outcome: o,
                            include: true,
                          })
                        }
                        className={cn(
                          "text-[11px] rounded-md border px-2 py-1 uppercase font-semibold",
                          r.outcome === o
                            ? o === "win"
                              ? "bg-profit/20 border-profit/40 text-profit"
                              : o === "loss"
                                ? "bg-loss/20 border-loss/40 text-loss"
                                : "bg-pending/20 border-pending/40 text-pending"
                            : "border-border text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Score
                    </Label>
                    <Input
                      className="h-7 text-xs font-mono"
                      placeholder="2-1"
                      value={r.score || ""}
                      onChange={(e) =>
                        patchRow(r.bet_id, { score: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Feel (skill vs variance)
                    </Label>
                    <select
                      className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                      value={r.variance_tag || ""}
                      onChange={(e) =>
                        patchRow(r.bet_id, { variance_tag: e.target.value })
                      }
                    >
                      {VARIANCE_OPTS.map((o) => (
                        <option key={o.v || "none"} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Research retro
                    </Label>
                    <select
                      className="w-full h-7 text-xs rounded-md border border-border bg-background px-2"
                      value={r.research_quality_retro || ""}
                      onChange={(e) =>
                        patchRow(r.bet_id, {
                          research_quality_retro: e.target.value,
                        })
                      }
                    >
                      {RETRO_OPTS.map((o) => (
                        <option key={o.v || "none"} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Key events
                    </Label>
                    <Input
                      className="h-7 text-xs"
                      placeholder="Red card, late pen…"
                      value={r.key_events || ""}
                      onChange={(e) =>
                        patchRow(r.bet_id, { key_events: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastReview && (
        <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3 space-y-2">
          <div className="text-xs font-semibold text-primary flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Post-settlement analysis
          </div>
          {Array.isArray(lastReview.narrative) &&
            (lastReview.narrative as string[]).map((n, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">
                {n}
              </p>
            ))}
          {typeof lastReview.n_proposals === "number" &&
            lastReview.n_proposals > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setView("learnings")}
              >
                Review {String(lastReview.n_proposals)} learning proposal(s) →
              </Button>
            )}
          {(lastReview as { summary?: { total_pl?: number } }).summary && (
            <p className="text-[11px] font-mono text-muted-foreground">
              Batch P/L{" "}
              {formatNokPlain(
                Number(
                  (lastReview as { summary?: { total_pl?: number } }).summary
                    ?.total_pl
                ) || 0
              )}{" "}
              NOK
            </p>
          )}
        </div>
      )}
    </div>
  );
}
