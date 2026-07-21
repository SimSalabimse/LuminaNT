import { useMemo, useState } from "react";
import { GraduationCap, TrendingDown, TrendingUp, Lightbulb } from "lucide-react";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { ControlSignalsPanel } from "@/components/learning/ControlSignalsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { betIdsForDim } from "@/lib/analytics";
import { multiplierTimelineOption } from "@/lib/charts";
import type {
  LearningBucket,
  LearningHistoryPoint,
  LearningProposal,
} from "@/types";
import { cn, formatNokPlain, formatPct, plColor, resultBadgeClass, truncate } from "@/lib/utils";

function statusClass(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "strong" || s === "good") return "bg-profit/15 text-profit border-profit/30";
  if (s === "poor" || s === "blocked" || s === "weak") return "bg-loss/15 text-loss border-loss/30";
  if (s === "thin") return "bg-muted text-muted-foreground border-border";
  return "bg-pending/15 text-pending border-pending/30";
}

function MultTable({
  title,
  data,
  onDrill,
}: {
  title: string;
  data: Record<string, LearningBucket> | undefined;
  /** Open ledger for this bucket (sport / market_family / odds_band) */
  onDrill?: (key: string) => void;
}) {
  const rows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .map(([key, b]) => ({
        key,
        n: Number(b.n) || 0,
        roi: Number(b.roi_blended ?? b.roi) || 0,
        stake_mult: Number(b.stake_mult) || 1,
        ev_boost: Number(b.ev_boost) || 0,
        status: String(b.status || "—"),
        pl: Number(b.pl) || 0,
        winrate: Number(b.winrate) || 0,
        blocked: Boolean(b.blocked),
      }))
      .sort((a, b) => b.n - a.n);
  }, [data]);

  if (!rows.length) {
    return (
      <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
        No {title.toLowerCase()} multipliers yet. Run <code>python run_nt.py learn</code> or settle bets.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden holo-border">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {onDrill && (
            <span className="text-[10px] text-muted-foreground">click row → Ledger</span>
          )}
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-right px-2 py-2 font-medium">n</th>
              <th className="text-right px-2 py-2 font-medium">ROI</th>
              <th className="text-right px-2 py-2 font-medium">P/L</th>
              <th className="text-right px-2 py-2 font-medium">Stake ×</th>
              <th className="text-right px-2 py-2 font-medium">EV boost</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={cn(
                  "border-b border-border/30 hover:bg-primary/5",
                  onDrill && "cursor-pointer"
                )}
                onClick={() => onDrill?.(r.key)}
              >
                <td className="px-3 py-2 font-medium">{r.key}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono text-xs">{r.n}</td>
                <td className={cn("px-2 py-2 text-right tabular-nums font-mono text-xs", plColor(r.roi))}>
                  {formatPct(r.roi)}
                </td>
                <td className={cn("px-2 py-2 text-right tabular-nums font-mono text-xs", plColor(r.pl))}>
                  {r.pl >= 0 ? "+" : ""}
                  {formatNokPlain(r.pl)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right tabular-nums font-mono text-xs font-semibold",
                    r.stake_mult >= 1 ? "text-profit" : "text-loss"
                  )}
                >
                  ×{r.stake_mult.toFixed(3)}
                </td>
                <td className={cn("px-2 py-2 text-right tabular-nums font-mono text-xs", plColor(r.ev_boost))}>
                  {(r.ev_boost * 100).toFixed(1)}pp
                </td>
                <td className="px-3 py-2">
                  <span className={cn("text-[10px] border rounded px-1.5 py-0.5", statusClass(r.status))}>
                    {r.blocked ? "blocked" : r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Learning summary best/worst entries may be strings or { name, n, roi_blended, ... } */
function sportLabel(entry: unknown): string {
  if (entry == null) return "—";
  if (typeof entry === "string" || typeof entry === "number") return String(entry);
  if (typeof entry === "object") {
    const o = entry as Record<string, unknown>;
    const name =
      o.name != null ? String(o.name) : o.sport != null ? String(o.sport) : "";
    if (!name) return JSON.stringify(entry);
    const roi = typeof o.roi_blended === "number" ? o.roi_blended : Number(o.roi_blended);
    if (Number.isFinite(roi)) {
      const pct = `${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(0)}%`;
      const n = o.n != null ? ` n=${o.n}` : "";
      return `${name} ${pct}${n}`;
    }
    return name;
  }
  return JSON.stringify(entry);
}

function lessonText(lesson: unknown): { level: string; text: string } {
  if (typeof lesson === "string") {
    const m =
      lesson.match(/^\*\*\[(\w+)\]\*\*\s*(.*)$/i) ||
      lesson.match(/^\[(\w+)\]\s*(.*)$/i);
    if (m) return { level: m[1].toLowerCase(), text: m[2] };
    return { level: "info", text: lesson };
  }
  if (lesson && typeof lesson === "object") {
    const o = lesson as Record<string, unknown>;
    const level = String(o.level || o.severity || "info").toLowerCase();
    const title = o.title != null ? String(o.title) : "";
    const detail = o.detail != null ? String(o.detail) : "";
    const text =
      title && detail
        ? `${title}: ${detail}`
        : title ||
          detail ||
          (o.text != null ? String(o.text) : "") ||
          (o.message != null ? String(o.message) : "") ||
          (o.lesson != null ? String(o.lesson) : "") ||
          JSON.stringify(o);
    return { level, text };
  }
  return { level: "info", text: String(lesson ?? "") };
}

/**
 * Build chart series from learning_history snapshots.
 * Forward-fills stake_mult so lines stay continuous when a bucket is missing
 * from intermediate snapshots (common after thin settles / era gaps).
 */
function buildMultHistory(
  history: LearningHistoryPoint[],
  dim: "sports" | "markets" | "bands",
  topKeys: string[]
) {
  const last: Record<string, number> = {};
  for (const k of topKeys) last[k] = 1; // default neutral mult until first observation
  return history.map((h) => {
    const bag = (h[dim] || {}) as Record<string, LearningBucket>;
    const values: Record<string, number> = {};
    for (const k of topKeys) {
      const m = bag[k]?.stake_mult;
      if (m != null && Number.isFinite(Number(m))) {
        last[k] = Number(m);
      }
      values[k] = last[k];
    }
    return { ts: String(h.ts || ""), values };
  });
}

type MultDelta = {
  dim: "sport" | "market" | "band";
  key: string;
  from: number;
  to: number;
  delta: number;
  evFrom: number;
  evTo: number;
  deltaEv: number;
  nFrom?: number;
  nTo?: number;
  summary?: string;
  statusFrom?: string;
  statusTo?: string;
  source: "engine" | "history";
};

const DIM_META: Record<
  MultDelta["dim"],
  { title: string; empty: string; historyKey: "sports" | "markets" | "bands" }
> = {
  sport: {
    title: "Sport changes",
    empty: "No sport multiplier moves on the last learn pass.",
    historyKey: "sports",
  },
  market: {
    title: "Market changes",
    empty: "No market multiplier moves on the last learn pass.",
    historyKey: "markets",
  },
  band: {
    title: "Odds band changes",
    empty: "No odds-band multiplier moves on the last learn pass.",
    historyKey: "bands",
  },
};

function normalizeMoveKind(kind: unknown): MultDelta["dim"] | null {
  const k = String(kind || "").toLowerCase();
  if (k === "sport" || k === "sports") return "sport";
  if (k === "market" || k === "markets") return "market";
  if (k === "band" || k === "bands" || k === "odds_band" || k === "odds band") return "band";
  return null;
}

/** Engine multiplier_moves from learning.json (sport / market / band). */
function movesFromEngine(moves: Array<Record<string, unknown>>): MultDelta[] {
  const out: MultDelta[] = [];
  for (const m of moves) {
    const dim = normalizeMoveKind(m.kind);
    if (!dim) continue;
    const name = m.name != null ? String(m.name) : "";
    if (!name) continue;
    const from = Number(m.stake_from ?? 1);
    const to = Number(m.stake_to ?? 1);
    const evFrom = Number(m.ev_from ?? 0);
    const evTo = Number(m.ev_to ?? 0);
    out.push({
      dim,
      key: name,
      from: Number.isFinite(from) ? from : 1,
      to: Number.isFinite(to) ? to : 1,
      delta: Number(m.delta_stake ?? to - from) || 0,
      evFrom: Number.isFinite(evFrom) ? evFrom : 0,
      evTo: Number.isFinite(evTo) ? evTo : 0,
      deltaEv: Number(m.delta_ev ?? evTo - evFrom) || 0,
      nFrom: m.n_from != null ? Number(m.n_from) : undefined,
      nTo: m.n_to != null ? Number(m.n_to) : undefined,
      summary: m.summary != null ? String(m.summary) : undefined,
      statusFrom: m.status_from != null ? String(m.status_from) : undefined,
      statusTo: m.status_to != null ? String(m.status_to) : undefined,
      source: "engine",
    });
  }
  return out;
}

/** Diff stake_mult / EV between last two learning_history snapshots (fallback). */
function computeMultDeltas(history: LearningHistoryPoint[]): MultDelta[] {
  if (history.length < 2) return [];
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  const out: MultDelta[] = [];
  const map: Array<["sport" | "market" | "band", "sports" | "markets" | "bands"]> = [
    ["sport", "sports"],
    ["market", "markets"],
    ["band", "bands"],
  ];
  for (const [dim, histKey] of map) {
    const a = (prev[histKey] || {}) as Record<string, LearningBucket>;
    const b = (curr[histKey] || {}) as Record<string, LearningBucket>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const from = Number(a[key]?.stake_mult ?? 1);
      const to = Number(b[key]?.stake_mult ?? 1);
      const evFrom = Number(a[key]?.ev_boost ?? 0);
      const evTo = Number(b[key]?.ev_boost ?? 0);
      const nFrom = Number(a[key]?.n ?? 0);
      const nTo = Number(b[key]?.n ?? 0);
      const stFrom = String(a[key]?.status || "");
      const stTo = String(b[key]?.status || "");
      const stakeChanged = Math.abs(to - from) >= 0.0005;
      const evChanged = Math.abs(evTo - evFrom) >= 0.0005;
      const nChanged = nFrom !== nTo;
      const stChanged = stFrom !== stTo && (stFrom || stTo);
      if (!stakeChanged && !evChanged && !nChanged && !stChanged) continue;
      const bits: string[] = [];
      if (nChanged) bits.push(`n ${nFrom}→${nTo}`);
      if (stakeChanged) bits.push(`stake ×${from.toFixed(3)}→×${to.toFixed(3)}`);
      if (evChanged) bits.push(`EV ${(evFrom * 100).toFixed(1)}→${(evTo * 100).toFixed(1)}pp`);
      if (stChanged) bits.push(`status ${stFrom || "—"}→${stTo || "—"}`);
      out.push({
        dim,
        key,
        from,
        to,
        delta: to - from,
        evFrom,
        evTo,
        deltaEv: evTo - evFrom,
        nFrom,
        nTo,
        summary: bits.join(" · "),
        statusFrom: stFrom || undefined,
        statusTo: stTo || undefined,
        source: "history",
      });
    }
  }
  return out.sort(
    (x, y) =>
      Math.abs(y.delta) + Math.abs(y.deltaEv) * 10 - (Math.abs(x.delta) + Math.abs(x.deltaEv) * 10)
  );
}

function ChangeSection({
  title,
  empty,
  rows,
  onDrill,
}: {
  title: string;
  empty: string;
  rows: MultDelta[];
  onDrill?: (dim: MultDelta["dim"], key: string) => void;
}) {
  return (
    <div className="glass rounded-xl overflow-hidden holo-border">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Stake × · EV boost · sample n — click row → Ledger
          </p>
        </div>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      {!rows.length ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-200 border-b border-border/40">
                <th className="text-left px-3 py-2 font-semibold">Bucket</th>
                <th className="text-right px-2 py-2 font-semibold">n</th>
                <th className="text-right px-2 py-2 font-semibold">Stake ×</th>
                <th className="text-right px-2 py-2 font-semibold">Δ ×</th>
                <th className="text-right px-2 py-2 font-semibold">EV boost</th>
                <th className="text-right px-2 py-2 font-semibold">Δ EV</th>
                <th className="text-left px-3 py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={`${d.dim}-${d.key}-${d.source}`}
                  className={cn(
                    "border-b border-border/30 hover:bg-primary/5",
                    onDrill && "cursor-pointer"
                  )}
                  onClick={() => onDrill?.(d.dim, d.key)}
                >
                  <td className="px-3 py-2 font-medium text-slate-100">{d.key}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-slate-300">
                    {d.nFrom != null || d.nTo != null
                      ? `${d.nFrom ?? "—"}→${d.nTo ?? "—"}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-slate-100">
                    ×{d.from.toFixed(3)}→×{d.to.toFixed(3)}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 text-right font-mono text-xs font-semibold",
                      d.delta >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {d.delta >= 0 ? "+" : ""}
                    {d.delta.toFixed(3)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-slate-100">
                    {(d.evFrom * 100).toFixed(1)}→{(d.evTo * 100).toFixed(1)}pp
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 text-right font-mono text-xs font-semibold",
                      d.deltaEv >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {d.deltaEv >= 0 ? "+" : ""}
                    {(d.deltaEv * 100).toFixed(1)}pp
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[280px]">
                    {d.summary || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MultChanges({
  history,
  moves,
  onDrill,
}: {
  history: LearningHistoryPoint[];
  moves: Array<Record<string, unknown>>;
  onDrill?: (dim: MultDelta["dim"], key: string) => void;
}) {
  const grouped = useMemo(() => {
    const engine = movesFromEngine(moves);
    // Prefer engine moves (includes n/status); fill gaps from history per dim
    const byDim: Record<MultDelta["dim"], MultDelta[]> = {
      sport: [],
      market: [],
      band: [],
    };
    for (const d of engine) byDim[d.dim].push(d);

    const hist = computeMultDeltas(history);
    for (const d of hist) {
      const existing = new Set(byDim[d.dim].map((x) => x.key));
      if (!existing.has(d.key)) byDim[d.dim].push(d);
    }

    for (const dim of Object.keys(byDim) as MultDelta["dim"][]) {
      byDim[dim].sort(
        (a, b) =>
          Math.abs(b.delta) +
          Math.abs(b.deltaEv) * 10 +
          Math.abs((b.nTo ?? 0) - (b.nFrom ?? 0)) * 0.01 -
          (Math.abs(a.delta) + Math.abs(a.deltaEv) * 10 + Math.abs((a.nTo ?? 0) - (a.nFrom ?? 0)) * 0.01)
      );
    }
    return byDim;
  }, [history, moves]);

  const total =
    grouped.sport.length + grouped.market.length + grouped.band.length;

  return (
    <div className="space-y-3">
      {history.length < 2 && total === 0 ? (
        <div className="glass rounded-xl p-4 text-sm text-slate-200">
          Need a learn pass (or two history snapshots) to show multiplier changes. Run{" "}
          <code className="text-primary">python run_nt.py learn</code> after settlements.
        </div>
      ) : null}
      {total === 0 && history.length >= 2 ? (
        <div className="glass rounded-xl p-4 text-sm text-slate-200">
          No stake× / EV / sample changes between the last two snapshots (
          {String(history[history.length - 2]?.ts || "").slice(0, 19)} →{" "}
          {String(history[history.length - 1]?.ts || "").slice(0, 19)}). Multipliers held steady.
        </div>
      ) : null}
      {(["sport", "market", "band"] as const).map((dim) => (
        <ChangeSection
          key={dim}
          title={DIM_META[dim].title}
          empty={DIM_META[dim].empty}
          rows={grouped[dim]}
          onDrill={onDrill}
        />
      ))}
    </div>
  );
}

export function Learnings() {
  return <LearningsPanel />;
}

/** Learnings body — also embedded in Research workspace */
function LearningProposalsPanel({
  proposals,
  narrative,
  onAct,
  busy,
}: {
  proposals: LearningProposal[];
  narrative?: string[];
  onAct: (id: string, action: "accept" | "reject") => void;
  busy?: boolean;
}) {
  const pending = proposals.filter((p) => p.status === "pending");
  if (!pending.length && !(narrative && narrative.length)) return null;
  return (
    <div className="glass rounded-xl p-4 holo-border border-cyan-500/20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-cyan-100">
            Learning proposals
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            From post-settlement analysis · short / medium / long layers · accept
            or reject
          </p>
        </div>
        <Badge variant="outline" className="border-cyan-500/40 text-cyan-200">
          {pending.length} pending
        </Badge>
      </div>
      {narrative && narrative.length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-1">
          {narrative.slice(0, 4).map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        {pending.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-white/[0.06] bg-black/25 p-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">
                <span className="text-muted-foreground uppercase text-[10px] mr-2">
                  {p.kind}
                </span>
                {p.name}
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                stake ×{Number(p.current?.stake_mult ?? 1).toFixed(3)} → ×
                {Number(p.proposed?.stake_mult ?? 1).toFixed(3)}
                {" · "}
                EV{" "}
                {(Number(p.current?.ev_boost ?? 0) * 100).toFixed(1)}→
                {(Number(p.proposed?.ev_boost ?? 0) * 100).toFixed(1)}pp
              </div>
              {p.layers && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  layers S/M/L{" "}
                  {(Number(p.layers.short_roi) * 100).toFixed(0)}/
                  {(Number(p.layers.medium_roi) * 100).toFixed(0)}/
                  {(Number(p.layers.long_roi) * 100).toFixed(0)}% · conf{" "}
                  {Number(p.layers.confidence ?? 0).toFixed(2)}
                </div>
              )}
              {p.reason && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  {p.reason}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                className="h-7"
                disabled={busy}
                onClick={() => onAct(p.id, "accept")}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={busy}
                onClick={() => onAct(p.id, "reject")}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LearningsPanel() {
  const snapshot = useDataStore((s) => s.snapshot);
  const bets = useDataStore((s) => s.bets);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const runNt = useDataStore((s) => s.runNt);
  const refresh = useDataStore((s) => s.refresh);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setToast = useAppStore((s) => s.setToast);
  const [histDim, setHistDim] = useState<"sports" | "markets" | "bands">("sports");
  const [propBusy, setPropBusy] = useState(false);

  const learning = snapshot?.learning;
  const history = snapshot?.learning_history || [];
  const edges = snapshot?.edges || [];
  const summary = learning?.summary;
  const propPayload = snapshot?.learning_proposals;
  const proposals = (propPayload?.proposals || []) as LearningProposal[];
  const lastNarrative = (propPayload?.last_narrative || []) as string[];

  const drillDim = (dim: "sport" | "market" | "band" | "market_family" | "odds_band", key: string) => {
    const analyticsDim =
      dim === "market" || dim === "market_family"
        ? "market_family"
        : dim === "band" || dim === "odds_band"
          ? "odds_band"
          : "sport";
    const ids = betIdsForDim(bets, analyticsDim, key);
    const filterPatch: Record<string, string[]> = {};
    if (analyticsDim === "sport") filterPatch.sports = [key];
    if (analyticsDim === "odds_band") filterPatch.oddsBands = [key];
    if (analyticsDim === "market_family") filterPatch.marketTypes = [key];
    drillForensic({
      dim: analyticsDim,
      value: key,
      label: `${analyticsDim === "sport" ? "Sport" : analyticsDim === "odds_band" ? "Band" : "Market"}: ${key}`,
      betIds: ids,
      filterPatch,
    });
  };

  const drillBetId = (betId: string | undefined | null, label?: string) => {
    if (!betId) return;
    drillForensic({
      dim: "bet",
      value: String(betId),
      label: label || `Bet ${betId}`,
      betIds: [String(betId)],
    });
  };

  const topKeys = useMemo(() => {
    const bag =
      histDim === "sports"
        ? learning?.sports
        : histDim === "markets"
          ? learning?.markets
          : learning?.bands;
    if (!bag) return [] as string[];
    return Object.entries(bag)
      .map(([k, v]) => ({ k, n: Number(v.n) || 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map((x) => x.k);
  }, [learning, histDim]);

  const timeline = useMemo(
    () => multiplierTimelineOption(buildMultHistory(history, histDim, topKeys), topKeys),
    [history, histDim, topKeys]
  );

  const moves = Array.isArray(learning?.multiplier_moves) ? learning!.multiplier_moves! : [];
  const lessons = Array.isArray(learning?.lessons) ? learning!.lessons! : [];
  const recent = Array.isArray(learning?.recent_settlements)
    ? learning!.recent_settlements!
    : [];

  const eraRoi = Number(summary?.era_roi);
  const eraPl = Number(summary?.era_pl);

  const onProposal = async (id: string, action: "accept" | "reject") => {
    if (demo) return;
    setPropBusy(true);
    try {
      await runNt(["learn", action === "accept" ? "--accept" : "--reject", id]);
      setToast(action === "accept" ? "Proposal applied" : "Proposal rejected");
      await refresh({ runNtRefresh: false });
    } finally {
      setPropBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Sport / market / band multipliers · layered ROIs · click rows for forensic Ledger
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={demo}
            onClick={() => runNt(["learn"])}
            title="python run_nt.py learn"
          >
            Recompute learn
          </Button>
        </div>
      </div>

      <ControlSignalsPanel />

      <LearningProposalsPanel
        proposals={proposals}
        narrative={lastNarrative}
        onAct={onProposal}
        busy={propBusy || demo}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Settled sample</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {summary?.n_settled ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Updated {learning?.updated_at?.slice(0, 19).replace("T", " ") || "—"}
          </div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Era ROI</div>
          <div className={cn("mt-1 text-2xl font-semibold tabular-nums", plColor(eraRoi || 0))}>
            {Number.isFinite(eraRoi) ? formatPct(eraRoi) : "—"}
          </div>
          <div className={cn("text-xs mt-1", plColor(eraPl || 0))}>
            P/L {Number.isFinite(eraPl) ? `${eraPl >= 0 ? "+" : ""}${formatNokPlain(eraPl)}` : "—"} NOK
          </div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Best sports</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(summary?.best_sports || []).length
              ? (summary?.best_sports || []).map((s, i) => {
                  const label = sportLabel(s);
                  return (
                    <Badge key={`best-${label}-${i}`} className="bg-profit/15 text-profit border-0">
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                      {label}
                    </Badge>
                  );
                })
              : "—"}
          </div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Worst / blocked</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(summary?.worst_sports || []).length
              ? (summary?.worst_sports || []).map((s, i) => {
                  const label = sportLabel(s);
                  return (
                    <Badge key={`worst-${label}-${i}`} className="bg-loss/15 text-loss border-0">
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                      {label}
                    </Badge>
                  );
                })
              : "—"}
            {summary?.n_blocked_sports ? (
              <span className="text-xs text-muted-foreground ml-1">
                ({Number(summary.n_blocked_sports)} blocked)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs defaultValue="multipliers" className="space-y-3">
        <TabsList>
          <TabsTrigger value="multipliers">Multipliers</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes feed</TabsTrigger>
          <TabsTrigger value="summary">Summary MD</TabsTrigger>
        </TabsList>

        <TabsContent value="multipliers" className="space-y-3">
          {moves.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-2">Recent multiplier moves</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {moves.map((m, i) => (
                  <li key={i} className="font-mono text-xs">
                    {typeof m === "string"
                      ? m
                      : JSON.stringify(m)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <MultTable
            title="Sport multipliers"
            data={learning?.sports}
            onDrill={(key) => drillDim("sport", key)}
          />
          <MultTable
            title="Market multipliers"
            data={learning?.markets}
            onDrill={(key) => drillDim("market", key)}
          />
          <MultTable
            title="Odds band multipliers"
            data={learning?.bands}
            onDrill={(key) => drillDim("band", key)}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["sports", "markets", "bands"] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={histDim === d ? "default" : "outline"}
                onClick={() => setHistDim(d)}
              >
                {d}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground self-center ml-2">
              {history.length} snapshots in learning_history.jsonl
            </span>
          </div>
          <ChartPanel
            title={`Stake × over time (${histDim})`}
            subtitle="Top buckets by sample size · scroll/pinch to zoom dates"
            option={timeline}
            height={360}
          />
          {recent.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-2">Recent settlements feeding the loop</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recent.map((r, i) => {
                  const row = r as Record<string, unknown>;
                  const bid = row.bet_id != null ? String(row.bet_id) : "";
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cn(
                        "w-full text-left text-xs border border-border/50 rounded-lg px-3 py-2 bg-muted/20",
                        bid && "hover:bg-primary/10 cursor-pointer"
                      )}
                      onClick={() =>
                        bid &&
                        drillBetId(
                          bid,
                          String(row.match || bid)
                        )
                      }
                      disabled={!bid}
                    >
                      <span className="font-mono text-muted-foreground">
                        {String(row.date || row.ts || "")}
                      </span>{" "}
                      <span
                        className={cn(
                          "border rounded px-1 text-[10px]",
                          resultBadgeClass(String(row.result || ""))
                        )}
                      >
                        {String(row.result || "")}
                      </span>{" "}
                      {String(row.match || "")} / {String(row.selection || "")}
                      {row.pl != null && (
                        <span className={cn("ml-1 tabular-nums", plColor(Number(row.pl)))}>
                          P/L {Number(row.pl) >= 0 ? "+" : ""}
                          {formatNokPlain(Number(row.pl))}
                        </span>
                      )}
                      {(row.note != null || row.detail != null) && (
                        <div className="text-muted-foreground mt-0.5">
                          {truncate(String(row.note ?? row.detail ?? ""), 160)}
                        </div>
                      )}
                      {bid && (
                        <div className="text-[10px] font-mono text-primary/80 mt-0.5">
                          {bid} · open Case File
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lessons" className="space-y-2">
          {lessons.length === 0 && (
            <p className="text-sm text-muted-foreground">No lessons in learning.json yet.</p>
          )}
          {lessons.map((l, i) => {
            const { level, text } = lessonText(l);
            return (
              <div
                key={i}
                className={cn(
                  "glass rounded-xl px-4 py-3 text-sm flex gap-3",
                  level === "good" && "border-profit/20",
                  (level === "warn" || level === "warning") && "border-pending/30",
                  (level === "bad" || level === "error") && "border-loss/30"
                )}
              >
                <Lightbulb
                  className={cn(
                    "h-4 w-4 shrink-0 mt-0.5",
                    level === "good" && "text-profit",
                    (level === "warn" || level === "warning") && "text-pending",
                    (level === "bad" || level === "error") && "text-loss",
                    level === "info" && "text-primary"
                  )}
                />
                <div>
                  <Badge variant="secondary" className="text-[10px] mb-1 uppercase">
                    {level}
                  </Badge>
                  <p className="leading-relaxed">{text}</p>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="changes" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Sport, market, and odds-band multiplier moves from the last learn pass (engine moves),
            with history-snapshot diffs as fallback. Not the same as settled bet rows.
          </p>
          <MultChanges
            history={history}
            moves={moves.filter((m): m is Record<string, unknown> => !!m && typeof m === "object")}
            onDrill={(dim, key) => drillDim(dim, key)}
          />
        </TabsContent>

        <TabsContent value="outcomes" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Settlement feed from <code>data/edges.jsonl</code> — click a row → forensic Ledger.{" "}
            {edges.length} rows.
          </p>
          <div className="glass rounded-xl overflow-hidden max-h-[520px] overflow-y-auto divide-y divide-border/40">
            {edges.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No rows yet. This file fills as settlements run through the learning loop.
              </p>
            )}
            {[...edges].reverse().map((e, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-4 py-3 text-sm hover:bg-primary/5 transition-colors"
                onClick={() =>
                  drillBetId(
                    e.bet_id != null ? String(e.bet_id) : null,
                    e.match || String(e.bet_id || "edge")
                  )
                }
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{e.match || "—"}</span>
                  <div className="flex items-center gap-2">
                    {e.result && (
                      <span
                        className={cn(
                          "text-[10px] border rounded px-1.5",
                          resultBadgeClass(String(e.result))
                        )}
                      >
                        {String(e.result)}
                      </span>
                    )}
                    {e.p_l != null && (
                      <span className={cn("tabular-nums text-xs font-medium", plColor(Number(e.p_l)))}>
                        {Number(e.p_l) >= 0 ? "+" : ""}
                        {formatNokPlain(Number(e.p_l))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {e.selection} · @{e.odds} · {e.odds_band || "—"} · grade {e.grade || "—"} · phase{" "}
                  {e.phase || "—"}
                </div>
                {e.note && (
                  <p className="text-xs mt-1">{truncate(String(e.note), 220)}</p>
                )}
                <div className="text-[10px] font-mono text-primary/80 mt-1">
                  {e.ts} · {e.bet_id || "no bet_id"}
                </div>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">edges_summary.md</h3>
            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-[520px] overflow-y-auto">
              {snapshot?.edges_summary_md || "(empty — generated on learn/refresh)"}
            </pre>
          </div>
        </TabsContent>
      </Tabs>

      {learning?.config_snapshot && (
        <details className="glass rounded-xl p-4 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Learning config snapshot</summary>
          <pre className="mt-2 font-mono whitespace-pre-wrap">
            {JSON.stringify(learning.config_snapshot, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
