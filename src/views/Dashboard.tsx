import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import {
  ChevronDown,
  Flame,
  Percent,
  Shield,
  TrendingUp,
  Trophy,
  Unlock,
  Wallet,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { FluidPlChart } from "@/components/charts/FluidPlChart";
import { OpenRiskConcentration } from "@/components/dashboard/OpenRiskConcentration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { useScopeBets, useScopeMetrics } from "@/hooks/use-tracker-data";
import {
  equityCurve,
  breakdownBy,
  calendarHeatmap,
  processHealthKpis,
  betIdsForDim,
  edgeDecaySeries,
  type EquityDateMode,
} from "@/lib/analytics";
import {
  sportBreakdownOption,
  heatmapSparkOption,
  edgeDecayOption,
} from "@/lib/charts";
import {
  formatNokPlain,
  formatPct,
  cn,
  isOpenRisk,
  isSettled,
  resultDisplayLabel,
} from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import {
  deriveRiskStatus,
  gateBadgeVariant,
  modeHeroClass,
  nextActionFor,
  strandedRemainder,
} from "@/lib/riskStatus";

/** Compact KPI cell for Desk row */
function KpiCell({
  label,
  value,
  hint,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "profit" | "loss" | "gold" | "neutral";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "rounded-xl border border-white/[0.08] bg-card/60 px-3.5 py-3 text-left min-w-0",
        "transition-colors duration-150",
        onClick && "hover:bg-white/[0.04] cursor-pointer",
        !onClick && "cursor-default"
      )}
    >
      <div className="section-label">{label}</div>
      <div
        className={cn(
          "mt-1.5 text-xl font-bold tabular-nums tracking-tight leading-none",
          tone === "profit" && "metric-glow-profit",
          tone === "loss" && "metric-glow-loss",
          tone === "gold" && "metric-glow-profit",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{hint}</div>
      )}
    </button>
  );
}

/**
 * Desk — performance overview + current risk status / next action.
 * Capital metrics live in the global strip; Desk does not re-state them.
 * Plan holds full bankroll rules; Desk answers: status, next move, open risk, P/L.
 */
export function Dashboard() {
  const snapshot = useDataStore((s) => s.snapshot);
  const allBets = useDataStore((s) => s.bets);
  const bets = useScopeBets();
  const metrics = useScopeMetrics();
  const filterScope = useAppStore((s) => s.filterScope);
  const setView = useAppStore((s) => s.setView);
  const setToast = useAppStore((s) => s.setToast);
  const demo = useAppStore((s) => s.settings.demoMode);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const refresh = useDataStore((s) => s.refresh);
  const processKpis = useMemo(() => processHealthKpis(bets), [bets]);
  const [showFluid, setShowFluid] = useState(false);
  const [dateMode, setDateMode] = useState<EquityDateMode>("settlement");

  const baseline = Number(snapshot?.bankroll?.baseline_nok) || 500;

  const chartData = useMemo(() => {
    const equityPts = equityCurve(bets, baseline, dateMode);
    const settled = bets.filter((b) => isSettled(b.result));
    const bySport = breakdownBy(settled, "sport");
    const heat = calendarHeatmap(bets, dateMode);
    return { equityPts, bySport, heat };
  }, [bets, baseline, dateMode]);

  const pending = useMemo(() => {
    const list = allBets.filter((b) => isOpenRisk(b.result));
    return [...list].sort((a, b) =>
      (b.date + (b.created_at || "")).localeCompare(a.date + (a.created_at || ""))
    );
  }, [allBets]);
  const pendingStake = useMemo(
    () => pending.reduce((s, b) => s + (Number(b.stake_nok) || 0), 0),
    [pending]
  );

  const status = useMemo(
    () => deriveRiskStatus(snapshot?.risk, snapshot?.bankroll, snapshot?.phase),
    [snapshot]
  );
  const next = useMemo(() => nextActionFor(status), [status]);
  const stranded = useMemo(() => strandedRemainder(status, 10), [status]);
  const edgeDecay = useMemo(() => edgeDecaySeries(allBets), [allBets]);
  const edgeDecayOpt = useMemo(() => edgeDecayOption(edgeDecay), [edgeDecay]);

  if (!snapshot) return null;

  const phase = snapshot.phase || {};
  const { equityPts, bySport, heat } = chartData;

  const roiPct = (metrics.roi * 100).toFixed(1);
  const wrPct = (metrics.winRate * 100).toFixed(1);
  const equity = status.equity;

  const onUnfreeze = async () => {
    if (demo || !isTauri()) {
      setToast("Unfreeze requires live desktop session");
      return;
    }
    if (
      !window.confirm(
        "Clear capital freeze?\n\nOnly after reviewing DD / stop reasons."
      )
    )
      return;
    try {
      const { runNtCommand } = await import("@/lib/tauri");
      const res = await runNtCommand([
        "capital",
        "unfreeze",
        "--confirm",
        "--actor",
        "lumina_desk",
        "--reason",
        "desk_unfreeze",
      ]);
      if (!res.ok || res.exit_code !== 0) setToast("Unfreeze failed");
      else {
        setToast("Unfreeze applied");
        await refresh({ runNtRefresh: true });
      }
    } catch (e) {
      setToast(String(e));
    }
  };

  const drillSport = (sport: string) => {
    if (!sport || sport === "(empty)") return;
    const settled = allBets.filter((b) => isSettled(b.result));
    const ids = betIdsForDim(settled, "sport", sport);
    drillForensic({
      dim: "sport",
      value: sport,
      label: `Sport: ${sport}`,
      betIds: ids,
      filterPatch: { sports: [sport] },
      targetView: "performance",
    });
  };

  return (
    <div className="page-shell !max-w-[1720px] !space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Desk</h1>
          <p className="page-subtitle mt-0.5">
            Risk status · next action · open blotter · performance
            {filterScope === "filtered" ? (
              <span className="text-primary"> · filtered scope</span>
            ) : (
              <span> · full book</span>
            )}
            {snapshot.meta.loaded_at && (
              <span className="ml-2 font-mono text-[10px] opacity-70">
                {new Date(snapshot.meta.loaded_at).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => setView("capital")}
          >
            <Wallet className="h-3.5 w-3.5" />
            Bankroll plan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-xs"
            onClick={() => setView("shortlist")}
          >
            <ListChecks className="h-3.5 w-3.5 mr-1" />
            Shortlist
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-xs"
            onClick={() => setView("performance")}
          >
            Analyze →
          </Button>
        </div>
      </div>

      {/* Hero: Current risk status + Next action — single source of truth */}
      <div
        className={cn(
          "rounded-2xl border p-5 md:p-6 bg-card",
          next.urgent && "border-loss/35",
          !next.urgent && status.gate === "REDUCED" && "border-pending/30",
          !next.urgent && status.canBet && status.gate !== "REDUCED" && "border-primary/25",
          !status.canBet && !next.urgent && "border-white/[0.1]"
        )}
      >
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex-1 min-w-[220px] space-y-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
              Current risk status
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={cn(
                  "rounded-xl border px-4 py-2.5",
                  modeHeroClass(status.sizeMode)
                )}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-75 font-semibold">
                  Mode
                </div>
                <div className="text-xl font-bold tracking-wide">
                  {status.sizeMode === "LEGACY" ? "—" : status.sizeMode}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Can bet
                </div>
                <Badge
                  variant={gateBadgeVariant(status.gate)}
                  className="mt-1 text-sm font-bold px-3 py-1 h-auto"
                >
                  {status.betLabel}
                </Badge>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Remaining
                </div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums">
                  {formatNokPlain(status.remaining)}
                </div>
              </div>
              {status.dd != null && (
                <div className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    DD%
                  </div>
                  <div
                    className={cn(
                      "mt-1 font-mono text-lg font-bold tabular-nums",
                      status.dd >= 0.15 ? "text-loss" : status.dd >= 0.05 ? "text-pending" : ""
                    )}
                  >
                    {status.ddPctLabel}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex-1 min-w-[260px] rounded-xl border px-4 py-3.5",
              next.urgent
                ? "border-loss/30 bg-loss/[0.08]"
                : status.gate === "REDUCED"
                  ? "border-pending/25 bg-pending/[0.06]"
                  : "border-primary/20 bg-primary/[0.05]"
            )}
          >
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
              Next action
            </div>
            <div className="mt-1.5 text-lg font-semibold flex items-center gap-2">
              {!next.urgent && status.canBet && (
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              )}
              {next.title}
            </div>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {next.detail}
            </p>
            {stranded.stranded && (
              <div className="mt-2 rounded-lg border border-pending/35 bg-pending/10 px-3 py-2 text-[12px] text-pending font-medium">
                {stranded.label} — cannot fund another NT ticket until settle frees risk.
              </div>
            )}
            {next.showUnfreeze && (
              <Button
                size="default"
                className="mt-3 h-11 gap-2 bg-amber-500/20 border border-amber-500/50 text-amber-50 hover:bg-amber-500/30"
                variant="outline"
                onClick={onUnfreeze}
              >
                <Unlock className="h-4 w-4" />
                Unfreeze now
              </Button>
            )}
            {!next.showUnfreeze && status.canBet && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-8 text-xs text-primary"
                onClick={() => setView("shortlist")}
              >
                Review shortlist →
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCell
          label="Total P/L"
          value={`${metrics.totalPl >= 0 ? "+" : ""}${formatNokPlain(metrics.totalPl)}`}
          hint={`${metrics.settledCount} settled`}
          tone={metrics.totalPl >= 0 ? "profit" : "loss"}
          onClick={() => setView("performance")}
        />
        <KpiCell
          label="ROI"
          value={`${Number(roiPct) >= 0 ? "+" : ""}${roiPct}%`}
          hint={`Staked ${formatNokPlain(metrics.totalStaked)}`}
          tone={metrics.roi >= 0 ? "profit" : "loss"}
          onClick={() => setView("performance")}
        />
        <KpiCell
          label="Win rate"
          value={`${wrPct}%`}
          hint={`${metrics.wins}W / ${metrics.losses}L`}
          tone="gold"
          onClick={() => setView("bets")}
        />
        <KpiCell
          label="Equity"
          value={formatNokPlain(equity)}
          hint={`Base ${formatNokPlain(baseline)}`}
          tone="gold"
        />
        <KpiCell
          label="Process solid"
          value={
            processKpis.processSolidPct != null
              ? formatPct(processKpis.processSolidPct)
              : "—"
          }
          hint="Grade / notes health"
          tone="neutral"
          onClick={() => setView("calibration")}
        />
      </div>

      <OpenRiskConcentration />

      {/* P2: Edge decay — realized ROI by settle lag */}
      {edgeDecay.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-card/50 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm font-semibold">Edge decay</h3>
              <p className="text-[11px] text-muted-foreground">
                Realized ROI by days from place → settle (settlement calendar)
              </p>
            </div>
          </div>
          <ReactECharts
            option={edgeDecayOpt}
            style={{ height: 160, width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        </div>
      )}

      {/* Open blotter + charts */}
      <div className="grid lg:grid-cols-12 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-7 rounded-2xl border border-pending/25 bg-card/50 p-5 flex flex-col min-h-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-pending" />
                Open risk blotter
              </h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Pending + ConfirmedPlaced · stakes until settle/abandon
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="tabular-nums text-[11px] h-7">
                {pending.length} open
              </Badge>
              <Badge className="bg-pending/15 text-pending border-pending/30 tabular-nums text-[11px] h-7">
                {formatNokPlain(pendingStake)} NOK
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() =>
                  drillForensic({
                    dim: "result",
                    value: "open_risk",
                    label: "Open risk (Pending + ConfirmedPlaced)",
                    betIds: pending.map((p) => p.bet_id),
                    filterPatch: {
                      results: Array.from(
                        new Set(pending.map((p) => p.result).filter(Boolean))
                      ),
                    },
                  })
                }
              >
                Forensic
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setView("bets")}
              >
                Ledger
              </Button>
            </div>
          </div>

          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No open risk — book is clear.
            </p>
          ) : (
            <div className="overflow-auto rounded-xl border border-white/[0.05] max-h-[340px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1]">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/80 backdrop-blur border-b border-white/[0.05]">
                    <th className="text-left px-3 py-2.5 font-medium">Date</th>
                    <th className="text-left px-2 py-2.5 font-medium">Match</th>
                    <th className="text-left px-2 py-2.5 font-medium">Selection</th>
                    <th className="text-left px-2 py-2.5 font-medium">Status</th>
                    <th className="text-right px-2 py-2.5 font-medium">Odds</th>
                    <th className="text-right px-2 py-2.5 font-medium">Stake</th>
                    <th className="text-left px-2 py-2.5 font-medium">Sport</th>
                    <th className="text-left px-3 py-2.5 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((b) => (
                    <tr
                      key={b.bet_id}
                      className="border-b border-white/[0.04] hover:bg-pending/5"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        {b.date}
                      </td>
                      <td
                        className="px-2 py-2.5 font-medium max-w-[160px] truncate"
                        title={b.match}
                      >
                        {b.match}
                      </td>
                      <td
                        className="px-2 py-2.5 text-muted-foreground max-w-[140px] truncate"
                        title={b.selection}
                      >
                        {b.selection}
                      </td>
                      <td className="px-2 py-2.5 text-[11px] text-pending whitespace-nowrap">
                        {resultDisplayLabel(b.result)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-mono text-xs">
                        {Number(b.decimal_odds).toFixed(2)}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-pending">
                        {formatNokPlain(b.stake_nok)}
                      </td>
                      <td className="px-2 py-2.5 text-xs">{b.sport || "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{b.research_grade || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-2xl border border-white/[0.08] bg-card/50 p-4 relative overflow-hidden flex-1 min-h-[170px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 relative z-[1]">
              <div className="section-label">
                Equity pulse ·{" "}
                {dateMode === "settlement"
                  ? "settlement day (Oslo)"
                  : "match date"}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-white/15 bg-black/50 p-0.5 text-[11px] shadow-inner">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-md font-medium transition-colors min-h-[30px]",
                      dateMode === "settlement"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                    )}
                    onClick={() => setDateMode("settlement")}
                  >
                    Settlement
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-md font-medium transition-colors min-h-[30px]",
                      dateMode === "match"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                    )}
                    onClick={() => setDateMode("match")}
                  >
                    Match
                  </button>
                </div>
                <span className="text-[12px] font-mono tabular-nums text-foreground">
                  {formatNokPlain(equity)} NOK
                </span>
              </div>
            </div>
            <FluidPlChart
              points={equityPts}
              height={150}
              className="relative z-[1] rounded-xl"
            />
          </motion.div>

          <ChartPanel
            title="By sport"
            subtitle="Click bar → forensic · Analyze"
            option={sportBreakdownOption(bySport, "pl")}
            height={200}
            accent="teal"
            onEvents={{
              click: (params: unknown) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const name = (params as any)?.name as string | undefined;
                if (name) drillSport(name);
              },
            }}
          />
        </div>
      </div>

      {/* Secondary signals — progressive disclosure */}
      <div className="rounded-2xl border border-white/[0.08] bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFluid((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors min-h-[48px]"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="text-sm font-semibold">More signals</span>
            <span className="text-[12px] text-muted-foreground font-mono">
              Streak{" "}
              {metrics.currentStreak.type === "—"
                ? "—"
                : `${metrics.currentStreak.count}${metrics.currentStreak.type}`}
              {" · "}
              Gate {status.betLabel}
              {" · "}
              Mode {status.sizeMode}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              showFluid && "rotate-180"
            )}
          />
        </button>
        {showFluid && (
          <div className="border-t border-white/[0.06] px-4 pb-5 pt-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <div className="section-label flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-pending" />
                  Streak
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums">
                  {metrics.currentStreak.type === "—"
                    ? "—"
                    : `${metrics.currentStreak.count}${metrics.currentStreak.type}`}
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {metrics.bestDay
                    ? `Best ${metrics.bestDay.date}: ${metrics.bestDay.pl >= 0 ? "+" : ""}${metrics.bestDay.pl.toFixed(1)}`
                    : "No settled days yet"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <div className="section-label flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Risk gate
                </div>
                <div
                  className={cn(
                    "mt-2 text-2xl font-bold",
                    status.canBet ? "text-profit" : "text-loss"
                  )}
                >
                  {status.betLabel}
                </div>
                <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                  {status.reason}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="chip !text-[10px]">
                    <Trophy className="h-3 w-3" /> {metrics.wins}W
                  </span>
                  <span className="chip !text-[10px]">
                    <Percent className="h-3 w-3" /> {wrPct}%
                  </span>
                  <button
                    type="button"
                    className="chip !text-[10px]"
                    onClick={() => setView("capital")}
                  >
                    Plan
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:col-span-2 lg:col-span-1">
                <div className="section-label flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Heatmap · 28d
                </div>
                <ChartPanel
                  title=""
                  option={heatmapSparkOption(heat)}
                  height={100}
                  className="!border-0 !shadow-none !bg-transparent !p-0 !backdrop-blur-none"
                />
              </div>
            </div>
            <div>
              <div className="section-label mb-2">Fluid P/L trajectory</div>
              <FluidPlChart points={equityPts} height={280} className="rounded-xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
