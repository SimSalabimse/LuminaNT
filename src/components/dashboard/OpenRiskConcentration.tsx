import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useDataStore } from "@/stores/data-store";
import { openRiskConcentration, riskHeatmapMatrix } from "@/lib/analytics";
import {
  openRiskBySportOption,
  preferOpenRiskBars,
  riskHeatmapOption,
} from "@/lib/charts";
import { formatNokPlain, resultDisplayLabel, isOpenRisk } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Open-risk concentration — always visible on Desk.
 * Pending + ConfirmedPlaced only (engine open-risk definition).
 *
 * Default: sport bars when sports ≤ 3 OR statuses ≤ 1 (single-status open risk
 * must never render as a full-width gold heatmap slab). Heatmap only for denser
 * multi-status matrices. Chart height is content-driven.
 */
export function OpenRiskConcentration() {
  const allBets = useDataStore((s) => s.bets);
  const filters = useDataStore((s) => s.filters);
  const clearForensic = useDataStore((s) => s.clearForensic);
  const drillForensic = useDataStore((s) => s.drillForensic);

  const conc = useMemo(() => openRiskConcentration(allBets), [allBets]);
  const matrix = useMemo(() => riskHeatmapMatrix(allBets), [allBets]);

  // Force bars for sparse desks: ≤3 sports OR only one open-status column
  const forceBars = preferOpenRiskBars(
    matrix.sports.length,
    matrix.statuses.length
  );
  const [mode, setMode] = useState<"bars" | "heatmap">(
    forceBars ? "bars" : "heatmap"
  );

  // Keep mode honest when matrix shape changes (e.g. all Pending → one status)
  useEffect(() => {
    if (forceBars && mode === "heatmap") setMode("bars");
  }, [forceBars, mode]);

  const forensicActive =
    (filters.betIds?.length || 0) > 0 || (filters.forensicTrail?.length || 0) > 0;

  // Effective mode: never heatmap when forceBars (single-status / ≤3 sports)
  const effectiveMode: "bars" | "heatmap" =
    forceBars || mode === "bars" ? "bars" : "heatmap";

  const chartOpt = useMemo(
    () =>
      effectiveMode === "heatmap"
        ? riskHeatmapOption(matrix)
        : openRiskBySportOption(conc.bySport),
    [effectiveMode, matrix, conc.bySport]
  );

  /** Content-height only — never fill a tall fullscreen pane with one fat bar. */
  const chartHeight = useMemo(() => {
    if (conc.bySport.length === 0) return 120;
    if (effectiveMode === "bars") {
      // ~40px per sport row + axis padding
      return Math.min(280, Math.max(100, conc.bySport.length * 44 + 36));
    }
    // heatmap: row height fixed; cap total so 1×1 stays compact
    const rows = Math.max(1, matrix.sports.length);
    return Math.min(280, Math.max(120, rows * 48 + 48));
  }, [effectiveMode, conc.bySport.length, matrix.sports.length]);

  const onSportClick = (sport: string, status?: string) => {
    const ids = allBets
      .filter(
        (b) =>
          isOpenRisk(b.result) &&
          (b.sport || "(unknown)").trim() === sport &&
          (status ? (b.result || "Pending").trim() === status : true)
      )
      .map((b) => b.bet_id);
    const statusLabel = status ? ` · ${resultDisplayLabel(status)}` : "";
    drillForensic({
      dim: status ? "open_sport_status" : "open_sport",
      value: status ? `${sport}|${status}` : sport,
      label: `Open risk · ${sport}${statusLabel}`,
      betIds: ids,
      filterPatch: {
        sports: sport === "(unknown)" ? [] : [sport],
        results: status
          ? [status]
          : Array.from(
              new Set(
                allBets
                  .filter((b) => isOpenRisk(b.result))
                  .map((b) => b.result)
                  .filter(Boolean)
              )
            ),
      },
      targetView: "bets",
    });
  };

  const onMatchClick = (match: string, betIds: string[]) => {
    drillForensic({
      dim: "open_match",
      value: match,
      label: `Open risk · ${match}`,
      betIds,
      filterPatch: {
        results: Array.from(
          new Set(
            allBets
              .filter((b) => isOpenRisk(b.result) && b.match === match)
              .map((b) => b.result)
          )
        ),
      },
      targetView: "bets",
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-card/50 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">
            Open-risk concentration
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pending + Confirmed · stake by sport
            {forensicActive && (
              <span className="text-primary"> · forensic grain active</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border border-white/12 p-0.5 text-[11px]">
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                effectiveMode === "bars"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode("bars")}
            >
              Bars
            </button>
            <button
              type="button"
              disabled={forceBars}
              title={
                forceBars
                  ? "Heatmap needs ≥2 statuses and >3 sports — bars preferred"
                  : "Sport × status heatmap"
              }
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                forceBars && "opacity-40 cursor-not-allowed",
                effectiveMode === "heatmap"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                if (!forceBars) setMode("heatmap");
              }}
            >
              Heatmap
            </button>
          </div>
          {forensicActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              onClick={() => clearForensic()}
            >
              Clear forensic
            </Button>
          )}
          <Badge
            variant="secondary"
            className="tabular-nums text-[11px] font-mono px-2"
          >
            {conc.n} open
          </Badge>
          <Badge className="bg-pending/15 text-pending border-pending/30 tabular-nums text-[11px] font-mono px-2">
            {formatNokPlain(conc.totalStake)} NOK
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
        {/* Chart — fixed content height; does not stretch with viewport */}
        <div className="lg:col-span-5 p-3 flex flex-col justify-center">
          {conc.bySport.length === 0 ? (
            <div
              className="flex items-center justify-center text-sm text-muted-foreground rounded-lg border border-dashed border-white/[0.08] bg-black/20"
              style={{ height: chartHeight }}
            >
              Zero open risk — concentration empty by design
            </div>
          ) : (
            <div
              className="w-full max-w-full rounded-lg bg-black/15 border border-white/[0.04]"
              style={{ height: chartHeight }}
            >
              <ReactECharts
                key={`${effectiveMode}-${conc.n}-${conc.totalStake}-${chartHeight}`}
                option={chartOpt}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
                notMerge
                lazyUpdate
                onEvents={{
                  click: (p: { name?: string; data?: number[] }) => {
                    if (effectiveMode === "bars" && p?.name) {
                      onSportClick(String(p.name));
                      return;
                    }
                    if (effectiveMode === "heatmap" && Array.isArray(p?.data)) {
                      const status = matrix.statuses[p.data[0]];
                      const sport = matrix.sports[p.data[1]];
                      if (sport) onSportClick(sport, status);
                    }
                  },
                }}
              />
            </div>
          )}
          {conc.bySport.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 px-0.5">
              Click bar/cell → ledger filter · values are open stake (NOK)
            </p>
          )}
        </div>

        {/* Match table — primary readable detail */}
        <div className="lg:col-span-7 p-0 min-h-0">
          <div className="overflow-auto max-h-[min(320px,50vh)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur z-[1]">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/[0.08]">
                  <th className="text-left px-3 py-2 font-semibold">Match</th>
                  <th className="text-left px-2 py-2 font-semibold">Sport</th>
                  <th className="text-left px-2 py-2 font-semibold">Status</th>
                  <th className="text-right px-2 py-2 font-semibold">n</th>
                  <th className="text-right px-3 py-2 font-semibold">Stake</th>
                </tr>
              </thead>
              <tbody>
                {conc.byMatch.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-muted-foreground text-sm"
                    >
                      No open tickets — table ready for next round
                    </td>
                  </tr>
                ) : (
                  conc.byMatch.map((row) => (
                    <tr
                      key={row.match}
                      className="border-b border-white/[0.05] hover:bg-white/[0.04] cursor-pointer transition-colors"
                      onClick={() => onMatchClick(row.match, row.betIds)}
                      title="Drill to ledger"
                    >
                      <td
                        className="px-3 py-2.5 font-medium text-[13px] max-w-[220px] truncate"
                        title={row.match}
                      >
                        {row.match}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground capitalize">
                        {row.sport}
                      </td>
                      <td className="px-2 py-2.5 text-pending whitespace-nowrap text-[12px] font-medium">
                        {row.statuses.map(resultDisplayLabel).join(" · ")}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[13px]">
                        {row.n}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[13px] font-semibold text-pending">
                        {formatNokPlain(row.stake)} NOK
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {conc.byMatch.length > 0 && (
            <div className="px-3 py-2 border-t border-white/[0.06] text-[10px] text-muted-foreground">
              Click row → forensic ledger filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
