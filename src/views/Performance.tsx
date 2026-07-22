import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/stores/data-store";
import { useScopeBets, useScopeMetrics } from "@/hooks/use-tracker-data";
import {
  equityCurve,
  dailyPl,
  breakdownBy,
  histogram,
  calendarHeatmap,
  rollingWinRate,
  rollingRoi,
  betIdsForDim,
  betCalendarDay,
  periodWindows,
  computeMetrics,
  type EquityDateMode,
} from "@/lib/analytics";
import {
  equityChartOption,
  dailyPlChartOption,
  breakdownBarOption,
  pieOption,
  histogramOption,
  trendLineOption,
  calendarHeatOption,
  chartColors,
} from "@/lib/charts";
import { marketFamilyLabel } from "@/lib/markets";
import {
  downloadJson,
  downloadText,
  formatNokPlain,
  formatPct,
  plColor,
  cn,
  isSettled,
} from "@/lib/utils";
import { ChevronDown, FileDown } from "lucide-react";
import type { Bet } from "@/types";

type BreakdownKey =
  | "phase"
  | "sport"
  | "market_family"
  | "odds_band"
  | "research_grade"
  | "result"
  | "source";

function dimKey(b: Bet, dim: BreakdownKey): string {
  if (dim === "market_family") {
    return b.market_family || marketFamilyLabel(b.market_type) || "(empty)";
  }
  const v = b[dim as keyof Bet];
  return String(v ?? "").trim() || "(empty)";
}

const DIM_LABELS: Record<BreakdownKey, string> = {
  phase: "Phase",
  sport: "Sport",
  market_family: "Market family",
  odds_band: "Odds band",
  research_grade: "Research grade",
  result: "Result",
  source: "Source",
};

/** @deprecated Use Analyze workspace — kept for router fallback */
export function Performance() {
  return <PerformancePanel />;
}

/** Performance analytics body (embedded in Analyze workspace) */
export function PerformancePanel() {
  /** Full book / Filtered toggle — same source of truth as Desk */
  const bets = useScopeBets();
  const allBets = useDataStore((s) => s.bets);
  const snapshot = useDataStore((s) => s.snapshot);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const metrics = useScopeMetrics();
  const [dim, setDim] = useState<BreakdownKey>("sport");
  const [showCompare, setShowCompare] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dateMode, setDateMode] = useState<EquityDateMode>("settlement");

  const baseline = Number(snapshot?.bankroll?.baseline_nok) || 500;
  const dateModeLabel =
    dateMode === "settlement"
      ? "settlement day (Europe/Oslo) — kill-switch coherent"
      : "match kickoff date on ticket";

  const drill = (dimName: string, value: string, prettyLabel?: string) => {
    if (
      !value ||
      value === "(empty)" ||
      value.startsWith("Other (+") ||
      value.startsWith("Rest (+")
    ) {
      return;
    }
    // Grain from full ledger so drill is complete even when viewing a slice.
    // Date dim respects day-axis mode (settlement vs match) so bar/calendar
    // clicks match the chart bucket that was clicked.
    const ids = betIdsForDim(allBets, dimName, value, { dateMode });
    const label = prettyLabel || `${dimName}: ${value}`;
    const filterPatch: Record<string, string[]> = {};
    if (dimName === "sport") filterPatch.sports = [value];
    if (dimName === "phase") filterPatch.phases = [value];
    if (dimName === "odds_band") filterPatch.oddsBands = [value];
    if (dimName === "research_grade") filterPatch.grades = [value];
    if (dimName === "market_family") filterPatch.marketTypes = [value];
    if (dimName === "result") filterPatch.results = [value];
    if (dimName === "date") {
      const settlement = dateMode === "settlement";
      drillForensic({
        dim: dimName,
        value,
        label: settlement
          ? `Settlement day ${value}`
          : `Match date ${value}`,
        betIds: ids,
        // dateFrom/dateTo filter match kickoff `b.date` only — do not apply
        // them for settlement-day grain (betIds are the source of truth).
        // Clear any prior match-date range so it cannot exclude settlement grain.
        filterPatch: settlement
          ? { dateFrom: "", dateTo: "" }
          : { dateFrom: value, dateTo: value },
      });
      return;
    }
    drillForensic({
      dim: dimName,
      value,
      label,
      betIds: ids,
      filterPatch,
    });
  };

  const clickDim = (params: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = params as any;
    const name = p?.name as string | undefined;
    if (!name) return;
    drill(dim, name, `${DIM_LABELS[dim]}: ${name}`);
  };

  const charts = useMemo(() => {
    const settled = bets.filter((b) => isSettled(b.result));
    const byDim = breakdownBy(settled, (b) => dimKey(b, dim));
    const byDimLabeled =
      dim === "market_family"
        ? byDim.map((r) => ({ ...r, key: marketFamilyLabel(r.key) }))
        : byDim;

    const eq = equityCurve(bets, baseline, dateMode);
    return {
      equity: equityChartOption(eq, {
        baseline,
        dateModeLabel,
        showDdBand: true,
      }),
      daily: dailyPlChartOption(dailyPl(bets, dateMode)),
      dimPl: breakdownBarOption(byDimLabeled, "pl"),
      dimCount: pieOption(byDimLabeled, "", true),
      oddsHist: histogramOption(
        histogram(
          settled.map((b) => b.decimal_odds),
          10
        ),
        chartColors.violet
      ),
      stakeHist: histogramOption(
        histogram(
          settled.map((b) => b.stake_nok),
          8
        ),
        chartColors.cyan
      ),
      plHist: histogramOption(
        histogram(
          settled.map((b) => b.p_l_nok),
          12
        ),
        chartColors.accent
      ),
      wr: trendLineOption(
        rollingWinRate(bets, 20, dateMode).map((p) => ({
          date: p.date,
          value: p.winRate,
        })),
        "Win rate (20)",
        true
      ),
      roi: trendLineOption(
        rollingRoi(bets, 20, dateMode).map((p) => ({
          date: p.date,
          value: p.roi,
        })),
        "ROI (20)",
        true
      ),
      cal: calendarHeatOption(calendarHeatmap(bets, dateMode)),
      sport: breakdownBarOption(breakdownBy(settled, "sport"), "pl"),
      phase: breakdownBarOption(breakdownBy(settled, "phase"), "roi"),
      grade: breakdownBarOption(breakdownBy(settled, "research_grade"), "pl"),
      market: breakdownBarOption(
        breakdownBy(settled, (b) => b.market_family || "Other").map((r) => ({
          ...r,
          key: marketFamilyLabel(r.key),
        })),
        "pl"
      ),
      highOdds: breakdownBarOption(
        breakdownBy(settled, (b) =>
          b.decimal_odds > 2.5 ? "odds > 2.5" : "odds ≤ 2.5"
        ),
        "pl"
      ),
    };
  }, [bets, baseline, dim, dateMode, dateModeLabel]);

  /** Period compare uses the SAME scoped bet set + day axis as charts. */
  const compare = useMemo(() => {
    if (!showCompare) return null;
    const w = periodWindows(14);
    const inWin = (b: Bet, from: string, to: string) => {
      const d = betCalendarDay(b, dateMode);
      return !!d && d >= from && d <= to;
    };
    const a = bets.filter((b) => inWin(b, w.aFrom, w.aTo));
    const b = bets.filter((b) => inWin(b, w.bFrom, w.bTo));
    const ma = computeMetrics(a, baseline);
    const mb = computeMetrics(b, baseline);
    return { w, ma, mb, aN: a.length, bN: b.length };
  }, [showCompare, bets, baseline, dateMode]);

  const exportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      metrics,
      bankroll: snapshot?.bankroll,
      phase: snapshot?.phase,
      risk: snapshot?.risk,
      filters_active: allBets.length !== bets.length,
      scope_bet_count: bets.length,
      bet_count: bets.length,
      breakdowns: {
        phase: breakdownBy(bets, "phase"),
        sport: breakdownBy(bets, "sport"),
        market_family: breakdownBy(bets, (b) => b.market_family || "Other"),
        odds_band: breakdownBy(bets, "odds_band"),
        research_grade: breakdownBy(bets, "research_grade"),
      },
    };
    downloadJson(
      `luminant_report_${new Date().toISOString().slice(0, 10)}.json`,
      report
    );
    downloadText(
      `luminant_summary_${new Date().toISOString().slice(0, 10)}.md`,
      `# LuminaNT Performance Report\n\n` +
        `- Equity: ${metrics.equity.toFixed(2)} NOK\n` +
        `- P/L: ${metrics.totalPl.toFixed(2)} NOK\n` +
        `- Win rate: ${(metrics.winRate * 100).toFixed(1)}%\n` +
        `- ROI: ${(metrics.roi * 100).toFixed(1)}%\n` +
        `- Settled: ${metrics.settledCount} · Pending: ${metrics.pendingCount}\n`
    );
  };

  const dims: BreakdownKey[] = [
    "phase",
    "sport",
    "odds_band",
    "research_grade",
    "market_family",
    "result",
    "source",
  ];

  return (
    <div className="space-y-4">
      {/* Actions + period compare control */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Click bars, slices, or calendar days → forensic Ledger with{" "}
          <code className="text-primary font-mono text-[11px]">bet_ids</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={showCompare ? "default" : "outline"}
            onClick={() => setShowCompare((v) => !v)}
          >
            Period compare (14d)
          </Button>
          <Button size="sm" variant="outline" onClick={exportReport}>
            <FileDown className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          {
            label: "Total P/L",
            value: `${metrics.totalPl >= 0 ? "+" : ""}${formatNokPlain(metrics.totalPl)}`,
            tone: metrics.totalPl >= 0 ? "profit" : "loss",
          },
          {
            label: "ROI",
            value: `${metrics.roi >= 0 ? "+" : ""}${(metrics.roi * 100).toFixed(1)}%`,
            tone: metrics.roi >= 0 ? "profit" : "loss",
          },
          {
            label: "Win rate",
            value: formatPct(metrics.winRate),
            tone: "gold",
          },
          {
            label: "Settled",
            value: String(metrics.settledCount),
            tone: "neutral",
            hint: `${metrics.wins}W / ${metrics.losses}L`,
          },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass rounded-xl px-3 py-2.5 holo-border relative overflow-hidden"
          >
            <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="section-label">{m.label}</div>
            <div
              className={cn(
                "mt-1 text-xl font-bold tabular-nums tracking-tight",
                m.tone === "profit" && "metric-glow-profit",
                m.tone === "loss" && "metric-glow-loss",
                m.tone === "gold" && "metric-glow-profit",
                m.tone === "neutral" && "text-foreground"
              )}
            >
              {m.value}
            </div>
            {"hint" in m && m.hint && (
              <div className="mt-1 text-[10px] text-muted-foreground">{m.hint}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Period compare — clearly visible when enabled */}
      {compare && (
        <div className="panel-tight holo-border grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="section-label mb-1.5">
              Last 14d ({compare.w.aFrom} → {compare.w.aTo}) · n={compare.aN}
            </div>
            <div className="flex flex-wrap gap-4 text-[13px]">
              <span className={cn("font-semibold tabular-nums", plColor(compare.ma.totalPl))}>
                P/L {formatNokPlain(compare.ma.totalPl)}
              </span>
              <span className="tabular-nums text-foreground/90">
                ROI {formatPct(compare.ma.roi)}
              </span>
              <span className="tabular-nums text-foreground/90">
                WR {formatPct(compare.ma.winRate)}
              </span>
            </div>
          </div>
          <div>
            <div className="section-label mb-1.5">
              Prior 14d ({compare.w.bFrom} → {compare.w.bTo}) · n={compare.bN}
            </div>
            <div className="flex flex-wrap gap-4 text-[13px]">
              <span className={cn("font-semibold tabular-nums", plColor(compare.mb.totalPl))}>
                P/L {formatNokPlain(compare.mb.totalPl)}
              </span>
              <span className="tabular-nums text-foreground/90">
                ROI {formatPct(compare.mb.roi)}
              </span>
              <span className="tabular-nums text-foreground/90">
                WR {formatPct(compare.mb.winRate)}
              </span>
            </div>
            <div className="text-[12px] text-muted-foreground mt-2">
              Δ P/L {formatNokPlain(compare.ma.totalPl - compare.mb.totalPl)} · Δ ROI{" "}
              {formatPct(compare.ma.roi - compare.mb.roi)}
            </div>
          </div>
        </div>
      )}

      {/* Primary: Equity + Daily P/L */}
      <section className="page-section">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="page-section-title !mb-0">Equity &amp; daily flow</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Day axis
            </span>
            <div className="flex rounded-lg border border-white/15 bg-black/50 p-0.5 text-[11px] shadow-inner">
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-colors",
                  dateMode === "settlement"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-foreground/75 hover:text-foreground hover:bg-white/5"
                )}
                onClick={() => setDateMode("settlement")}
                title="Default — same “today” as risk kill-switch (Europe/Oslo)"
              >
                Settlement (Oslo)
              </button>
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-colors",
                  dateMode === "match"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-foreground/75 hover:text-foreground hover:bg-white/5"
                )}
                onClick={() => setDateMode("match")}
                title="Kickoff calendar date on the bet ticket"
              >
                Match date
              </button>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Default <strong className="text-foreground/80">settlement day</strong>{" "}
          uses <code className="text-[10px]">updated_at → Europe/Oslo</code> so
          chart “today” matches risk.today_realized_pl. Match date is optional.
        </p>
        <div className="chart-grid lg:grid-cols-2">
          <ChartPanel
            title="Cumulative equity"
            subtitle={`HWM · DD% · ${dateMode === "settlement" ? "settlement day" : "match date"}`}
            option={charts.equity}
            height={320}
            accent="teal"
          />
          <ChartPanel
            title="Daily P/L"
            subtitle={`${dateMode === "settlement" ? "Settlement day" : "Match date"} · click bar → tickets`}
            option={charts.daily}
            height={320}
            accent="cyan"
            onEvents={{
              click: (params: unknown) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = params as any;
                const name = (p?.name || p?.data?.date) as string | undefined;
                if (name && /^\d{4}-\d{2}-\d{2}/.test(name)) {
                  drill("date", name.slice(0, 10));
                }
              },
            }}
          />
        </div>
      </section>

      {/* Rolling form */}
      <section className="page-section">
        <div className="page-section-title">Rolling form</div>
        <div className="chart-grid lg:grid-cols-2">
          <ChartPanel
            title="Rolling win rate (20 bets)"
            option={charts.wr}
            height={240}
            accent="cyan"
          />
          <ChartPanel
            title="Rolling ROI (20 bets)"
            option={charts.roi}
            height={240}
            accent="teal"
          />
        </div>
      </section>

      {/* Dimension dock */}
      <div className="panel-tight holo-border flex flex-wrap items-center gap-2">
        <span className="section-label mr-1">Breakdown by</span>
        {dims.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDim(d)}
            className={
              dim === d
                ? "chip chip-active"
                : "chip hover:text-foreground hover:border-border"
            }
          >
            {DIM_LABELS[d]}
          </button>
        ))}
      </div>

      <section className="page-section">
        <div className="page-section-title">
          Active dimension · {DIM_LABELS[dim]}
        </div>
        <div className="chart-grid lg:grid-cols-2">
          <ChartPanel
            title={`P/L by ${DIM_LABELS[dim]}`}
            subtitle="Click a bar → forensic Ledger"
            option={charts.dimPl}
            height={320}
            accent="teal"
            onEvents={{ click: clickDim }}
          />
          <ChartPanel
            title={`Share by ${DIM_LABELS[dim]}`}
            subtitle="Click a slice → same drill"
            option={charts.dimCount}
            height={320}
            accent="violet"
            onEvents={{ click: clickDim }}
          />
        </div>
      </section>

      {/* Calendar — always visible */}
      <section className="page-section">
        <div className="page-section-title">Calendar</div>
        <ChartPanel
          title="Performance calendar"
          subtitle={`Click a day → tickets (${dateMode === "settlement" ? "settlement day" : "match date"})`}
          option={charts.cal}
          height={260}
          accent="cyan"
          onEvents={{
            click: (params: unknown) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const p = params as any;
              const raw = (p?.data?.[0] || p?.value?.[0] || p?.name) as
                | string
                | undefined;
              if (raw && /^\d{4}-\d{2}-\d{2}/.test(String(raw))) {
                drill("date", String(raw).slice(0, 10));
              }
            },
          }}
        />
      </section>

      {/* Accordion: more distributions & segments */}
      <div className="glass rounded-2xl overflow-hidden holo-border">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div>
            <div className="text-sm font-semibold">
              More distributions &amp; segments
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Histograms · sport · market · phase · grade · high-odds
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              moreOpen && "rotate-180"
            )}
          />
        </button>

        {moreOpen && (
          <div className="px-3 pb-4 border-t border-white/[0.05] space-y-4 pt-4">
            <div className="chart-grid lg:grid-cols-3">
              <ChartPanel
                title="Odds distribution"
                option={charts.oddsHist}
                height={220}
                accent="violet"
              />
              <ChartPanel
                title="Stake distribution"
                option={charts.stakeHist}
                height={220}
                accent="cyan"
              />
              <ChartPanel
                title="P/L distribution"
                option={charts.plHist}
                height={220}
                accent="teal"
              />
            </div>
            <div className="chart-grid lg:grid-cols-2">
              <ChartPanel
                title="P/L by sport"
                subtitle="Click → forensic"
                option={charts.sport}
                height={260}
                accent="cyan"
                onEvents={{
                  click: (params: unknown) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const name = (params as any)?.name as string | undefined;
                    if (name) drill("sport", name, `Sport: ${name}`);
                  },
                }}
              />
              <ChartPanel
                title="P/L by market family"
                subtitle="Click → forensic"
                option={charts.market}
                height={260}
                accent="teal"
                onEvents={{
                  click: (params: unknown) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const name = (params as any)?.name as string | undefined;
                    if (name) drill("market_family", name, `Market: ${name}`);
                  },
                }}
              />
              <ChartPanel
                title="ROI by phase"
                option={charts.phase}
                height={240}
                accent="violet"
                onEvents={{
                  click: (params: unknown) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const name = (params as any)?.name as string | undefined;
                    if (name) drill("phase", name, `Phase: ${name}`);
                  },
                }}
              />
              <ChartPanel
                title="P/L by research grade"
                option={charts.grade}
                height={240}
                accent="cyan"
                onEvents={{
                  click: (params: unknown) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const name = (params as any)?.name as string | undefined;
                    if (name) drill("research_grade", name, `Grade: ${name}`);
                  },
                }}
              />
              <ChartPanel
                title="High-odds vs normal"
                option={charts.highOdds}
                height={240}
                accent="teal"
                onEvents={{
                  click: (params: unknown) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const name = (params as any)?.name as string | undefined;
                    if (name) drill("high_odds", name, name);
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
