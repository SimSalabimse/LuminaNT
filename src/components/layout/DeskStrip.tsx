import { useState } from "react";
import {
  RefreshCw,
  Filter,
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { formatNokPlain, cn, isOpenRisk } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import {
  deriveRiskStatus,
  gateBadgeVariant,
  modeShellClass,
} from "@/lib/riskStatus";
import { phaseRadarDims, sizeModeWhy } from "@/lib/phaseRadar";

/**
 * Capital strip — calm, scannable, mode-dominant.
 * Primary: Equity · Liquid · Open Risk · DD% · size_mode · Can Bet
 * Secondary (collapsed): rooms, unit, phase, scope
 */
export function DeskStrip() {
  const snapshot = useDataStore((s) => s.snapshot);
  const allBets = useDataStore((s) => s.bets);
  const filters = useDataStore((s) => s.filters);
  const clearForensic = useDataStore((s) => s.clearForensic);
  const refresh = useDataStore((s) => s.refresh);
  const refreshing = useDataStore((s) => s.refreshing);
  const filterScope = useAppStore((s) => s.filterScope);
  const setFilterScope = useAppStore((s) => s.setFilterScope);
  const setToast = useAppStore((s) => s.setToast);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setView = useAppStore((s) => s.setView);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  if (!snapshot) return null;

  const status = deriveRiskStatus(snapshot.risk, snapshot.bankroll, snapshot.phase);
  const phase = snapshot.phase || {};
  const risk = snapshot.risk || {};
  const dailyCap = Number(risk.daily_risk_cap_nok) || 0;
  const util = dailyCap > 0 ? status.openRisk / dailyCap : 0;

  const openTickets = allBets.filter((b) => isOpenRisk(b.result));
  const openHover =
    openTickets.length === 0
      ? "No open risk"
      : `${openTickets.length} open ticket(s) · ${formatNokPlain(status.openRisk)} NOK`;

  const forensicActive =
    (filters.betIds?.length || 0) > 0 || (filters.forensicTrail?.length || 0) > 0;
  const trail = filters.forensicTrail || [];
  const forensicLabel =
    trail.length > 0
      ? trail.map((t) => t.label).join(" › ")
      : filters.betIds?.length
        ? `${filters.betIds.length} tickets`
        : null;

  const onRefresh = () => refresh({ runNtRefresh: !demo && isTauri() });

  const onUnfreeze = async () => {
    if (!isTauri() || demo) {
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
        "lumina",
        "--reason",
        "app_manual_unfreeze",
      ]);
      if (res?.ok === false || (typeof res?.exit_code === "number" && res.exit_code !== 0)) {
        setToast("Unfreeze failed — see Ops log");
      } else {
        setToast("Unfreeze applied");
        refresh({ runNtRefresh: true });
      }
    } catch (e) {
      setToast(`Unfreeze error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const ddUse = status.dd;
  const ddTone: "loss" | "pending" | undefined =
    ddUse == null
      ? undefined
      : ddUse >= 0.15
        ? "loss"
        : ddUse >= 0.05
          ? "pending"
          : undefined;

  const modeNotNormal =
    status.sizeMode === "REDUCED" || status.sizeMode === "FROZEN";

  const radar = phaseRadarDims(phase as Parameters<typeof phaseRadarDims>[0]);
  const whyMode = sizeModeWhy(
    risk as Parameters<typeof sizeModeWhy>[0],
    phase as Parameters<typeof sizeModeWhy>[1]
  );
  const capitalMode = String(risk.size_mode_capital || status.sizeMode || "").toUpperCase();
  const modeMismatch =
    capitalMode &&
    status.sizeMode &&
    capitalMode !== status.sizeMode &&
    status.sizeMode !== "LEGACY";

  return (
    <div
      className={cn(
        "shrink-0 border-b border-white/[0.08] bg-[#070b12]/98 relative z-10 transition-colors duration-300",
        modeShellClass(status.sizeMode)
      )}
    >
      {/* Mode banner when not NORMAL — dominant language */}
      {modeNotNormal && (
        <div
          className={cn(
            "px-4 py-1.5 text-center text-[12px] font-semibold tracking-wide border-b",
            status.sizeMode === "FROZEN" &&
              "bg-loss/15 border-loss/25 text-loss",
            status.sizeMode === "REDUCED" &&
              "bg-pending/12 border-pending/25 text-pending"
          )}
        >
          {status.sizeMode === "FROZEN"
            ? "FROZEN — no new risk until unfreeze"
            : "REDUCED — half-unit sizing only"}
          {!status.canBet && status.reason ? ` · ${status.reason}` : ""}
        </div>
      )}

      {/* Primary row */}
      <div className="px-4 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <PrimaryMetric
          label="Equity"
          value={formatNokPlain(status.equity)}
          hero
          title="Engine bankroll equity"
        />
        <Divider />
        <PrimaryMetric
          label="Liquid"
          value={formatNokPlain(status.liquid)}
          title={status.v2 ? "Riskable liquid" : "Equity − open risk"}
        />
        <Divider />
        <PrimaryMetric
          label="Open risk"
          value={formatNokPlain(status.openRisk)}
          tone="pending"
          title={openHover}
        />
        <Divider />
        <PrimaryMetric
          label="DD%"
          value={status.ddPctLabel}
          tone={ddTone}
          title="Drawdown from peak equity"
        />

        <div className="flex-1 min-w-[12px]" />

        {/* size_mode — large */}
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border px-4 py-2 min-w-[104px]",
            status.sizeMode === "NORMAL" && "border-primary/35 bg-primary/10",
            status.sizeMode === "REDUCED" && "border-pending/40 bg-pending/12",
            status.sizeMode === "FROZEN" && "border-loss/40 bg-loss/12",
            status.sizeMode === "LEGACY" && "border-white/10 bg-white/5"
          )}
          title={whyMode.join("\n")}
        >
          <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            Mode
          </span>
          <span
            className={cn(
              "mt-0.5 text-lg font-bold tracking-wide leading-none",
              status.sizeMode === "NORMAL" && "text-primary",
              status.sizeMode === "REDUCED" && "text-pending",
              status.sizeMode === "FROZEN" && "text-loss"
            )}
          >
            {status.sizeMode === "LEGACY" ? "—" : status.sizeMode}
          </span>
          {modeMismatch && (
            <span className="text-[9px] text-muted-foreground mt-0.5 font-mono">
              cap {capitalMode}
            </span>
          )}
        </div>
        {Boolean(phase.research_only) && (
          <Badge variant="warning" className="h-8 text-[10px] font-bold">
            RESEARCH_ONLY
          </Badge>
        )}

        {/* Can bet — large, single source of truth */}
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border px-4 py-2 min-w-[104px]",
            status.canBet ? "border-profit/35 bg-profit/10" : "border-loss/40 bg-loss/12"
          )}
          title={status.reason}
        >
          <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            Can bet
          </span>
          <span
            className={cn(
              "mt-0.5 text-lg font-bold tracking-wide leading-none",
              status.canBet ? "text-profit" : "text-loss"
            )}
          >
            {status.betLabel}
          </span>
        </div>

        {status.gate === "FROZEN" && (
          <Button
            size="default"
            variant="outline"
            className="h-11 gap-2 px-4 border-amber-500/55 text-amber-50 bg-amber-500/15 hover:bg-amber-500/25 font-semibold"
            onClick={onUnfreeze}
          >
            <Unlock className="h-4 w-4" />
            Unfreeze
          </Button>
        )}

        <button
          type="button"
          onClick={() => setSecondaryOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground font-medium px-2.5 py-2 rounded-lg hover:bg-white/5 min-h-[40px]"
        >
          {secondaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Details
        </button>

        <Button
          size="sm"
          variant="outline"
          className="h-10 gap-1.5"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Reason when blocked and NORMAL (no mode banner) */}
      {!status.canBet && !modeNotNormal && (
        <div className="px-4 pb-2.5 -mt-1">
          <p className="text-[12px] text-muted-foreground leading-snug max-w-3xl">
            {status.reason}
          </p>
        </div>
      )}

      {secondaryOpen && (
        <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] border-t border-white/[0.05] bg-black/30">
          <Sec label="Remaining" value={formatNokPlain(status.remaining)} />
          <Sec label="Unit" value={formatNokPlain(status.unit)} />
          {status.openRoom != null && (
            <Sec label="Open room" value={formatNokPlain(status.openRoom)} />
          )}
          {status.dailyRoom != null && (
            <Sec label="Day room" value={formatNokPlain(status.dailyRoom)} />
          )}
          {status.weeklyRoom != null && (
            <Sec label="Week room" value={formatNokPlain(status.weeklyRoom)} />
          )}
          {status.secure > 0 && (
            <Sec label="Secure" value={formatNokPlain(status.secure)} />
          )}
          {status.todayPl != null && (
            <Sec
              label="Today P/L"
              value={`${status.todayPl >= 0 ? "+" : ""}${formatNokPlain(status.todayPl)}`}
              tone={
                status.todayPl > 0.005
                  ? "profit"
                  : status.todayPl < -0.005
                    ? "loss"
                    : undefined
              }
            />
          )}
          <Sec
            label="Util"
            value={`${(util * 100).toFixed(0)}%`}
            tone={util >= 0.95 ? "loss" : util >= 0.8 ? "pending" : undefined}
          />
          <Sec label="Phase" value={String(phase.phase_id ?? "—")} />

          {/* Phase health mini bars */}
          <div className="flex items-end gap-1.5 h-8" title={whyMode.join(" · ")}>
            {radar.map((d) => (
              <div key={d.id} className="flex flex-col items-center gap-0.5 w-5" title={`${d.label}: ${d.rawLabel}`}>
                <div className="w-full h-6 rounded-sm bg-black/40 border border-white/10 overflow-hidden flex items-end">
                  <div
                    className={cn(
                      "w-full transition-all",
                      d.tone === "ok" && "bg-profit/80",
                      d.tone === "warn" && "bg-pending/80",
                      d.tone === "loss" && "bg-loss/80",
                      d.tone === "neutral" && "bg-white/25"
                    )}
                    style={{ height: `${Math.max(8, d.score)}%` }}
                  />
                </div>
                <span className="text-[8px] text-muted-foreground leading-none">
                  {d.label.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center rounded-lg border border-white/12 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setFilterScope("full")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium min-h-[32px]",
                filterScope === "full"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Full
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("filtered")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium min-h-[32px]",
                filterScope === "filtered"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtered
            </button>
          </div>

          {forensicActive && (
            <button
              type="button"
              onClick={() => {
                clearForensic();
                setToast("Forensic filter cleared");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] hover:bg-white/10 max-w-[220px] min-h-[32px]"
            >
              <span className="truncate">Forensic · {forensicLabel}</span>
              <X className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>
          )}

          {forensicActive && (
            <Button size="sm" variant="ghost" onClick={() => setView("bets")}>
              Ledger
            </Button>
          )}

          <Badge variant={gateBadgeVariant(status.gate)} className="text-[10px] font-mono">
            {status.gate}
          </Badge>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="hidden sm:block h-8 w-px bg-white/[0.08] shrink-0" />;
}

function PrimaryMetric({
  label,
  value,
  tone,
  hero,
  title,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "pending";
  hero?: boolean;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0" title={title}>
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums leading-none",
          hero ? "text-[1.35rem] font-bold" : "text-[1.15rem] font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "pending" && "text-pending",
          !tone && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Sec({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "pending";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums font-semibold text-[13px]",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "pending" && "text-pending"
        )}
      >
        {value}
      </span>
    </div>
  );
}
