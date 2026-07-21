import type { ReactNode } from "react";
import { BarChart3, Crosshair, X } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useScopeBets } from "@/hooks/use-tracker-data";
import { useDataStore } from "@/stores/data-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PerformancePanel } from "@/views/Performance";
import { CalibrationPanel } from "@/views/Calibration";

type AnalyzeTab = "performance" | "calibration";

/**
 * Analyze workspace — Performance + Calibration under one roof.
 * Charts/KPIs honor Desk Strip Full book vs Filtered (same as Desk/Ledger).
 */
export function Analyze() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const filterScope = useAppStore((s) => s.filterScope);
  const setFilterScope = useAppStore((s) => s.setFilterScope);
  const setToast = useAppStore((s) => s.setToast);
  const scoped = useScopeBets();
  const allBets = useDataStore((s) => s.bets);
  const filters = useDataStore((s) => s.filters);
  const clearForensic = useDataStore((s) => s.clearForensic);

  const tab: AnalyzeTab =
    view === "calibration" ? "calibration" : "performance";

  const forensicActive =
    (filters.betIds?.length || 0) > 0 ||
    (filters.forensicTrail?.length || 0) > 0;

  const trailLabel =
    (filters.forensicTrail || []).map((t) => t.label).join(" › ") ||
    (filters.betIds?.length
      ? `${filters.betIds.length} tickets`
      : "");

  /** Forensic is “live” for charts only when Filtered is selected */
  const chartsNarrowed = forensicActive && filterScope === "filtered";

  return (
    <div className="page-shell !max-w-[1720px] !space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Analyze</h1>
          <p className="page-subtitle">
            Performance &amp; calibration · forensic drill to Ledger
            {" · "}
            <span className="text-foreground/90">{scoped.length} bets in scope</span>
            {allBets.length !== scoped.length && (
              <span className="text-muted-foreground">
                {" "}
                (of {allBets.length})
              </span>
            )}
            {" · "}
            <span className={filterScope === "full" ? "text-primary" : "text-muted-foreground"}>
              {filterScope === "full" ? "Full book" : "Filtered"}
            </span>
          </p>
        </div>

        <div className="flex rounded-xl border border-white/[0.08] bg-black/25 p-1 shrink-0">
          <TabButton
            active={tab === "performance"}
            onClick={() => setView("performance")}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Performance"
          />
          <TabButton
            active={tab === "calibration"}
            onClick={() => setView("calibration")}
            icon={<Crosshair className="h-3.5 w-3.5" />}
            label="Calibration"
          />
        </div>
      </div>

      {/* Forensic narrows charts only in Filtered mode */}
      {forensicActive && (
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5 flex flex-wrap items-center gap-2 text-xs",
            chartsNarrowed
              ? "border-primary/40 bg-primary/10 text-primary forensic-banner"
              : "border-white/[0.08] bg-white/[0.03] text-muted-foreground"
          )}
        >
          <span className="font-semibold shrink-0">
            {chartsNarrowed ? "Charts narrowed by forensic" : "Forensic trail stored"}
          </span>
          {trailLabel && (
            <span className="font-medium truncate max-w-[min(100%,420px)]">
              {trailLabel}
            </span>
          )}
          {filters.betIds && filters.betIds.length > 0 && (
            <span className="font-mono opacity-80">
              {filters.betIds.length} bet_ids
            </span>
          )}
          {forensicActive && filterScope === "full" && (
            <span className="text-muted-foreground">
              Full book is on — charts show entire ledger. Switch to Filtered to
              apply forensic grain.
            </span>
          )}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {filterScope === "full" && forensicActive && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setFilterScope("filtered")}
              >
                Apply filtered
              </Button>
            )}
            {chartsNarrowed && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setFilterScope("full");
                  setToast("Showing full book (forensic trail kept)");
                }}
              >
                Show full book
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                clearForensic();
                setToast("Forensic filter cleared");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Clear forensic
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setView("bets")}
            >
              Open Ledger
            </Button>
          </div>
        </div>
      )}

      {tab === "performance" ? <PerformancePanel /> : <CalibrationPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/20 text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
