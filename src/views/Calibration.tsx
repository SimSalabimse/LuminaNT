import { useMemo, useState } from "react";
import { BookOpen, Crosshair, HelpCircle, MousePointerClick } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { analyzeCalibration, type GroupMetrics } from "@/lib/calibration";
import { cn, formatPct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CalRow } from "@/lib/calibration";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { reliabilityChartOption } from "@/lib/charts";
import { EmptyState } from "@/components/layout/EmptyState";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isTauri } from "@/lib/tauri";

function ForceProcessReviewButton({
  defaultSport,
  label,
}: {
  defaultSport: string;
  label: string;
}) {
  const runNt = useDataStore((s) => s.runNt);
  const refresh = useDataStore((s) => s.refresh);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setToast = useAppStore((s) => s.setToast);
  const setError = useAppStore((s) => s.setError);
  const [busy, setBusy] = useState(false);
  const live = isTauri() && !demo;

  const onForce = async () => {
    if (!live) {
      setToast("Force process review needs desktop + live tracker");
      return;
    }
    const sport =
      window.prompt("Sport for temp_gate_raise", defaultSport || "football") ||
      "";
    if (!sport.trim()) return;
    setBusy(true);
    try {
      const res = await runNt([
        "control-signals",
        "emit",
        "--sport",
        sport.trim(),
        "--source",
        "force_review",
        "--reason",
        `calibration force_review: ${label}`,
      ]);
      if (res.exit_code !== 0 && res.ok === false) {
        setError(res.stderr || "Emit failed");
      } else {
        setToast(`temp_gate_raise emitted for ${sport}`);
        await refresh({ runNtRefresh: true });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-[11px] mt-2 border-pending/40 text-pending"
      disabled={busy || !live}
      onClick={() => void onForce()}
    >
      Force process review
    </Button>
  );
}

const GLOSSARY: { term: string; plain: string; detail?: string }[] = [
  {
    term: "What is this page?",
    plain:
      "After a bet settles, we compare your predicted chance of winning (p_model) with what actually happened. That feedback loop is calibration — “were we overconfident or underconfident?”",
  },
  {
    term: "p_model",
    plain:
      "Your model’s estimated probability that the bet wins (e.g. 0.65 = 65% chance). It should come from research, not from the bookmaker’s odds alone.",
  },
  {
    term: "y (outcome)",
    plain: "1 if the bet won, 0 if it lost. Refunded/void bets are usually excluded.",
  },
  {
    term: "Brier score",
    plain:
      "Average squared error of predictions. 0 is perfect. Around 0.25 is roughly like guessing a coin flip at 50%. Lower is better.",
    detail: "Brier = average of (p_model − y)² over settled bets with a p_model.",
  },
  {
    term: "Log loss",
    plain:
      "Another accuracy score that punishes confident wrong predictions harder. Lower is better.",
  },
  {
    term: "Mean p",
    plain:
      "Average of your p_model values. If this is much higher than win rate, you were overconfident.",
  },
  {
    term: "Win rate (empirical)",
    plain: "Actual share of wins in the sample (wins ÷ decided bets).",
  },
  {
    term: "Bias (p − y)",
    plain:
      "Mean prediction minus mean outcome. Positive ≈ you thought you were right more often than you were (overconfident). Near zero is good.",
  },
  {
    term: "Reliability diagram",
    plain:
      "For each range of predicted probability (bin), plot average prediction (x) vs actual win rate (y). Perfect calibration sits on the diagonal.",
  },
  {
    term: "Odds band",
    plain:
      "Bucket of decimal odds (e.g. 1.5–1.8). Helps see if favorites vs longer shots are well calibrated.",
  },
  {
    term: "Grade",
    plain:
      "Research quality label on the bet (A/B/C…). Higher grades should ideally mean better-calibrated process — not guaranteed.",
  },
  {
    term: "Soft-match / evidence backfill",
    plain:
      "Linking research packs to bets by name match. Only high-confidence matches write p_model automatically.",
  },
];

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex text-muted-foreground hover:text-primary transition-colors"
          aria-label="Explain"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
  tip?: string;
}) {
  const color =
    tone === "good"
      ? "text-profit"
      : tone === "bad"
        ? "text-loss"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-white/[0.08] bg-card/60 px-3 py-2.5 min-w-0">
      <div className="section-label flex items-center gap-1.5">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div
        className={cn(
          "text-xl font-semibold tabular-nums mt-1.5 tracking-tight",
          color
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function GroupTable({
  title,
  data,
  onDrill,
  titleTip,
}: {
  title: string;
  data: Record<string, GroupMetrics>;
  onDrill: (label: string, ids: string[]) => void;
  titleTip?: string;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1].n - a[1].n);
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-card/50 p-4">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <EmptyState
          compact
          title="No rows"
          description="No calibrated bets in this group yet."
        />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/50 p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 flex-wrap">
        {title}
        {titleTip && <InfoTip text={titleTip} />}
        <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1">
          <MousePointerClick className="h-3 w-3" /> click → open bets
        </span>
      </h3>
      <p className="text-[10px] text-muted-foreground mb-2">
        Residual: Bias = mean(p_model) − win rate. Positive = overconfident.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Group</th>
            <th className="!text-right">n</th>
            <th className="!text-right">Brier</th>
            <th className="!text-right">Bias (p−y)</th>
            <th className="!text-right">Mean p</th>
            <th className="!text-right">WR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, s]) => (
            <tr
              key={name}
              className="cursor-pointer hover:bg-white/[0.03]"
              onClick={() => onDrill(`${title}: ${name}`, s.betIds)}
            >
              <td className="font-medium">{name}</td>
              <td className="text-right font-mono tabular-nums">{s.n}</td>
              <td className="text-right font-mono tabular-nums">
                {s.brier.toFixed(3)}
              </td>
              <td
                className={cn(
                  "text-right font-mono tabular-nums",
                  s.bias > 0.05
                    ? "text-loss"
                    : s.bias < -0.05
                      ? "text-profit"
                      : ""
                )}
              >
                {s.bias > 0 ? "+" : ""}
                {s.bias.toFixed(3)}
              </td>
              <td className="text-right font-mono tabular-nums">
                {(s.mean_p * 100).toFixed(1)}%
              </td>
              <td className="text-right font-mono tabular-nums">
                {(s.winrate * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** @deprecated Use Analyze workspace */
export function Calibration() {
  return <CalibrationPanel />;
}

/** Calibration body (embedded in Analyze workspace) */
export function CalibrationPanel() {
  const snapshot = useDataStore((s) => s.snapshot);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const [showAll, setShowAll] = useState(false);
  /** Power-user default: guide collapsed */
  const [showGuide, setShowGuide] = useState(false);

  const calRows = (snapshot?.calibration || []) as CalRow[];
  const report = useMemo(() => analyzeCalibration(calRows), [calRows]);
  const relOption = useMemo(
    () => reliabilityChartOption(report.reliability_bins),
    [report.reliability_bins]
  );

  const drill = (label: string, betIds: string[]) => {
    if (!betIds.length) return;
    drillForensic({
      dim: "calibration",
      value: label,
      label,
      betIds,
    });
  };

  const biasTone =
    report.bias_p_minus_y == null
      ? "neutral"
      : Math.abs(report.bias_p_minus_y) < 0.05
        ? "good"
        : report.bias_p_minus_y > 0
          ? "bad"
          : "neutral";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-xl">
          How accurate were your win-probability estimates after settle? Click
          groups or chart bubbles → forensic Ledger.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showGuide ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGuide((v) => !v)}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {showGuide ? "Hide guide" : "Plain-English guide"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!report.allBetIds.length}
            onClick={() => drill("All calibrated bets", report.allBetIds)}
          >
            Open all ({report.n})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Hide raw" : "Show raw rows"}
          </Button>
        </div>
      </div>

      {showGuide && (
        <div className="glass rounded-2xl p-4 holo-border space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Plain-English guide
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                Think of each researched bet as a weather forecast. If it only
                rained 50% of the time when you said 70%, your forecasts were{" "}
                <strong className="text-foreground">overconfident</strong>.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {GLOSSARY.map((g) => (
              <div
                key={g.term}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1"
              >
                <div className="text-xs font-semibold text-primary tracking-tight">
                  {g.term}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {g.plain}
                </p>
                {g.detail && (
                  <p className="text-[10px] font-mono text-muted-foreground/80 pt-0.5">
                    {g.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.n === 0 ? (
        <EmptyState
          icon={Crosshair}
          title="No calibration data yet"
          description={
            <>
              You need settled bets that had a trustworthy{" "}
              <strong>p_model</strong> at settle time. Then rebuild:
              <br />
              <span className="font-mono text-primary/90 text-[11px] mt-2 inline-block">
                python run_nt.py calibrate rebuild
              </span>
            </>
          }
        />
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <Metric
              label="Sample size (n)"
              value={String(report.n)}
              sub="settled with p_model"
              tip="How many finished bets are in this set. Small n → don't over-react."
            />
            <Metric
              label="Brier"
              value={report.brier != null ? report.brier.toFixed(3) : "—"}
              sub="lower = better"
              tip="Average squared prediction error. 0 perfect; ~0.25 weak at 50/50."
              tone={
                report.brier != null && report.brier < 0.22
                  ? "good"
                  : report.brier != null && report.brier > 0.28
                    ? "bad"
                    : "neutral"
              }
            />
            <Metric
              label="Log loss"
              value={report.log_loss != null ? report.log_loss.toFixed(3) : "—"}
              sub="lower better"
              tip="Penalizes being confidently wrong."
            />
            <Metric
              label="Avg predicted %"
              value={
                report.mean_p_model != null
                  ? `${(report.mean_p_model * 100).toFixed(1)}%`
                  : "—"
              }
              tip="Average of your p_model. Compare to actual win rate."
            />
            <Metric
              label="Actual win %"
              value={
                report.base_rate_wins != null
                  ? `${(report.base_rate_wins * 100).toFixed(1)}%`
                  : "—"
              }
              tip="What fraction of these bets actually won."
            />
            <Metric
              label="Bias"
              value={
                report.bias_p_minus_y != null
                  ? `${report.bias_p_minus_y > 0 ? "+" : ""}${report.bias_p_minus_y.toFixed(3)}`
                  : "—"
              }
              sub={
                report.bias_p_minus_y != null &&
                Math.abs(report.bias_p_minus_y) < 0.05
                  ? "roughly well calibrated"
                  : report.bias_p_minus_y != null && report.bias_p_minus_y > 0
                    ? "overconfident"
                    : "underconfident / variance"
              }
              tip="Average (predicted − actual). Positive ≈ overconfident."
              tone={biasTone}
            />
          </div>

          {/* One-line interpretation */}
          <div className="glass rounded-2xl p-4 holo-border">
            <Badge variant="secondary" className="mb-2">
              What this means
            </Badge>
            <p className="text-sm leading-relaxed">{report.interpretation}</p>
            {report.force_review.length > 0 && (
              <div className="mt-3 rounded-xl border border-pending/35 bg-pending/10 px-3 py-2.5 space-y-1.5">
                <div className="text-[11px] font-semibold text-pending uppercase tracking-wide">
                  Force-review ({report.force_review.length})
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Groups/bins with |bias| &gt; 12pp and n ≥ 5 — check process before raising stakes.
                </p>
                <ul className="space-y-1">
                  {report.force_review.slice(0, 6).map((f) => (
                    <li key={`${f.dim}-${f.key}`}>
                      <button
                        type="button"
                        className="text-[12px] text-left text-foreground hover:text-primary underline-offset-2 hover:underline"
                        onClick={() => drill(f.label, f.betIds)}
                        disabled={!f.betIds.length}
                      >
                        {f.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <ForceProcessReviewButton
                  defaultSport={
                    report.force_review[0]?.dim === "sport"
                      ? String(report.force_review[0]?.key || "football")
                      : "football"
                  }
                  label={report.force_review[0]?.label || "calibration"}
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Force process review emits a ControlSignal temp_gate_raise (engine).
              Multipliers stay separate.
            </p>
          </div>

          {/* Reliability visuals */}
          <div className="grid lg:grid-cols-2 gap-3">
            <ChartPanel
              title="Reliability diagram"
              subtitle="X = predicted · Y = actual · diagonal = perfect · click bubble → tickets"
              option={relOption}
              height={320}
              accent="violet"
              onEvents={{
                click: (params: unknown) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = params as any;
                  const name = p?.data?.name || p?.name;
                  if (!name) return;
                  const bin = report.reliability_bins.find((b) => b.bin === name);
                  if (bin?.betIds?.length) drill(`Bin ${name}`, bin.betIds);
                },
              }}
            />
            <div className="glass rounded-2xl p-4 holo-border overflow-x-auto">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                Probability bins
                <InfoTip text="Bets grouped by predicted probability range." />
              </h3>
              <p className="text-[11px] text-muted-foreground mb-2">
                Gap = predicted − actual. Large positive → too optimistic.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Predicted range</th>
                    <th className="!text-right">n</th>
                    <th className="!text-right">Avg predicted</th>
                    <th className="!text-right">Actual wins</th>
                    <th className="!text-right">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {report.reliability_bins.map((b) => (
                    <tr
                      key={b.bin}
                      className={cn(b.n > 0 && "cursor-pointer")}
                      onClick={() => b.n > 0 && drill(`Bin ${b.bin}`, b.betIds)}
                    >
                      <td className="font-mono">{b.bin}</td>
                      <td className="text-right font-mono">{b.n}</td>
                      <td className="text-right font-mono">
                        {b.mean_p != null ? formatPct(b.mean_p) : "—"}
                      </td>
                      <td className="text-right font-mono">
                        {b.emp_rate != null ? formatPct(b.emp_rate) : "—"}
                      </td>
                      <td
                        className={cn(
                          "text-right font-mono",
                          b.gap != null && Math.abs(b.gap) > 0.1 ? "text-loss" : ""
                        )}
                      >
                        {b.gap != null
                          ? `${b.gap > 0 ? "+" : ""}${b.gap.toFixed(3)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Group tables — 2-column grid */}
          <div className="page-section-title">By segment</div>
          <div className="grid md:grid-cols-2 gap-3">
            <GroupTable
              title="By odds band"
              data={report.by_odds_band}
              onDrill={drill}
              titleTip="Groups by price range (decimal odds)."
            />
            <GroupTable
              title="By sport"
              data={report.by_sport}
              onDrill={drill}
              titleTip="Calibration by sport."
            />
            <GroupTable
              title="By market"
              data={report.by_market}
              onDrill={drill}
              titleTip="Market type family."
            />
            <GroupTable
              title="By phase"
              data={report.by_phase}
              onDrill={drill}
              titleTip="Bankroll phase when the bet was placed."
            />
            <GroupTable
              title="By research grade"
              data={report.by_grade}
              onDrill={drill}
              titleTip="Research quality grade (A/B/…)."
            />
          </div>

          {showAll && (
            <div className="glass rounded-2xl p-4 holo-border max-h-80 overflow-y-auto">
              <h3 className="text-sm font-semibold mb-2">Raw calibration rows</h3>
              <p className="text-[11px] text-muted-foreground mb-2">
                Each line: p = predicted win chance, y = 1 win / 0 loss.
              </p>
              <div className="space-y-0.5">
                {calRows.map((r, i) => (
                  <button
                    key={`${r.bet_id}-${i}`}
                    type="button"
                    className="w-full text-left text-xs font-mono border-b border-border/30 py-1.5 hover:bg-primary/10 rounded-md px-2"
                    onClick={() =>
                      r.bet_id && drill(`Bet ${r.bet_id}`, [String(r.bet_id)])
                    }
                  >
                    <span className="text-primary">{r.bet_id}</span> predicted=
                    {r.p_model != null
                      ? `${(Number(r.p_model) * 100).toFixed(0)}%`
                      : "—"}{" "}
                    result=
                    {r.y === 1 ? "Win" : r.y === 0 ? "Loss" : r.result} brier=
                    {r.brier} {r.sport} {r.odds_band}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
