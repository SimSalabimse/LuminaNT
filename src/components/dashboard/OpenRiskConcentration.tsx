import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useDataStore } from "@/stores/data-store";
import { openRiskConcentration, riskHeatmapMatrix } from "@/lib/analytics";
import { openRiskBySportOption, riskHeatmapOption } from "@/lib/charts";
import { formatNokPlain, resultDisplayLabel, isOpenRisk } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Open-risk concentration — always visible on Desk.
 * Uses Pending + ConfirmedPlaced (engine open-risk definition).
 */
export function OpenRiskConcentration() {
  const allBets = useDataStore((s) => s.bets);
  const filters = useDataStore((s) => s.filters);
  const clearForensic = useDataStore((s) => s.clearForensic);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const [mode, setMode] = useState<"bars" | "heatmap">("heatmap");

  const forensicActive =
    (filters.betIds?.length || 0) > 0 || (filters.forensicTrail?.length || 0) > 0;

  const conc = useMemo(() => openRiskConcentration(allBets), [allBets]);
  const matrix = useMemo(() => riskHeatmapMatrix(allBets), [allBets]);
  const chartOpt = useMemo(
    () =>
      mode === "heatmap"
        ? riskHeatmapOption(matrix)
        : openRiskBySportOption(conc.bySport),
    [mode, matrix, conc.bySport]
  );

  const onSportClick = (sport: string, status?: string) => {
    const ids = allBets
      .filter(
        (b) =>
          isOpenRisk(b.result) &&
          (b.sport || "(unknown)").trim() === sport &&
          (status ? (b.result || "Pending").trim() === status : true)
      )
      .map((b) => b.bet_id);
    const statusLabel = status ? ` · ${status}` : "";
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
      <div className="px-3 py-2 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Open-risk concentration
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pending + ConfirmedPlaced · risk heatmap / sport bars
            {forensicActive && (
              <span className="text-primary"> · forensic grain active</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-white/12 p-0.5 text-[11px]">
            <button
              type="button"
              className={
                mode === "heatmap"
                  ? "px-2 py-1 rounded-md bg-primary text-primary-foreground"
                  : "px-2 py-1 rounded-md text-muted-foreground"
              }
              onClick={() => setMode("heatmap")}
            >
              Heatmap
            </button>
            <button
              type="button"
              className={
                mode === "bars"
                  ? "px-2 py-1 rounded-md bg-primary text-primary-foreground"
                  : "px-2 py-1 rounded-md text-muted-foreground"
              }
              onClick={() => setMode("bars")}
            >
              Bars
            </button>
          </div>
          {forensicActive && (
            <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => clearForensic()}>
              Clear forensic
            </Button>
          )}
          <Badge variant="secondary" className="tabular-nums text-[10px] font-mono">
            {conc.n} open
          </Badge>
          <Badge className="bg-pending/15 text-pending border-pending/30 tabular-nums text-[10px] font-mono">
            {formatNokPlain(conc.totalStake)} NOK
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
        <div className="lg:col-span-5 p-2 min-h-[160px]">
          {conc.bySport.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
              Zero open risk — concentration empty by design
            </div>
          ) : (
            <ReactECharts
              option={chartOpt}
              style={{
                height:
                  mode === "heatmap"
                    ? Math.max(180, matrix.sports.length * 28 + 60)
                    : Math.max(160, conc.bySport.length * 36 + 40),
                width: "100%",
              }}
              opts={{ renderer: "canvas" }}
              onEvents={{
                click: (p: { name?: string; data?: number[] }) => {
                  if (mode === "bars" && p?.name) {
                    onSportClick(String(p.name));
                    return;
                  }
                  if (mode === "heatmap" && Array.isArray(p?.data)) {
                    const status = matrix.statuses[p.data[0]];
                    const sport = matrix.sports[p.data[1]];
                    if (sport) onSportClick(sport, status);
                  }
                },
              }}
            />
          )}
        </div>

        <div className="lg:col-span-7 p-0 min-h-[160px]">
          <div className="overflow-auto max-h-[220px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur z-[1]">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/[0.06]">
                  <th className="text-left px-3 py-1.5 font-medium">Match</th>
                  <th className="text-left px-2 py-1.5 font-medium">Sport</th>
                  <th className="text-left px-2 py-1.5 font-medium">Status</th>
                  <th className="text-right px-2 py-1.5 font-medium">n</th>
                  <th className="text-right px-3 py-1.5 font-medium">Stake</th>
                </tr>
              </thead>
              <tbody>
                {conc.byMatch.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No open tickets — table ready for next round
                    </td>
                  </tr>
                ) : (
                  conc.byMatch.map((row) => (
                    <tr
                      key={row.match}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer"
                      onClick={() => onMatchClick(row.match, row.betIds)}
                      title="Drill to ledger"
                    >
                      <td
                        className="px-3 py-1.5 font-medium max-w-[180px] truncate"
                        title={row.match}
                      >
                        {row.match}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {row.sport}
                      </td>
                      <td className="px-2 py-1.5 text-pending whitespace-nowrap">
                        {row.statuses.map(resultDisplayLabel).join(" · ")}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {row.n}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums font-semibold text-pending">
                        {formatNokPlain(row.stake)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {conc.byMatch.length > 0 && (
            <div className="px-3 py-1.5 border-t border-white/[0.06] text-[10px] text-muted-foreground">
              Click row or bar → forensic ledger filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
