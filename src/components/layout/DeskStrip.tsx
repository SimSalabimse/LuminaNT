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
  modeBadgeVariant,
  modeShellClass,
} from "@/lib/riskStatus";

/**
 * Capital strip — calm primary metrics only.
 * Equity · Liquid · Open Risk · size_mode · Can Bet · DD%
 * Secondary: rooms, util, phase, scope, forensic.
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

  const stakeMin = phase.stake_min;
  const stakeMax = phase.stake_max;
  const stakeBand =
    stakeMin != null && stakeMax != null
      ? `${formatNokPlain(Number(stakeMin))}–${formatNokPlain(Number(stakeMax))}`
      : "—";

  const reduceAt = 0.15;
  const freezeAt = 0.25;
  const ddUse = status.dd;
  const distReduce =
    ddUse != null && ddUse < reduceAt
      ? `${((reduceAt - ddUse) * 100).toFixed(1)}pp to REDUCED`
      : ddUse != null && ddUse < freezeAt
        ? `${((freezeAt - ddUse) * 100).toFixed(1)}pp to FREEZE`
        : status.gate === "FROZEN"
          ? "at FREEZE"
          : null;

  const openTickets = allBets.filter((b) => isOpenRisk(b.result));
  const nPending = openTickets.filter(
    (b) => (b.result || "").toLowerCase() === "pending"
  ).length;
  const nConfirmed = openTickets.filter(
    (b) => normalizeResult(b.result) === "confirmedplaced"
  ).length;
  const openHover =
    openTickets.length === 0
      ? "No open risk"
      : [
          `${openTickets.length} open`,
          nPending ? `${nPending} Pending` : null,
          nConfirmed ? `${nConfirmed} ConfirmedPlaced` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const forensicActive =
    (filters.betIds?.length || 0) > 0 || (filters.forensicTrail?.length || 0) > 0;
  const trail = filters.forensicTrail || [];
  const forensicLabel =
    trail.length > 0
      ? trail.map((t) => t.label).join(" › ")
      : filters.betIds?.length
        ? `${filters.betIds.length} tickets`
        : null;

  const onRefresh = () => {
    refresh({ runNtRefresh: !demo && isTauri() });
  };

  const onUnfreeze = async () => {
    if (!isTauri() || demo) {
      setToast("Unfreeze requires live desktop session");
      return;
    }
    if (
      !window.confirm(
        "Clear capital freeze?\n\nWrites freeze_audit and refreshes engine. Only after reviewing DD / stop reasons."
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

  const ddTone: "loss" | "pending" | undefined =
    ddUse == null
      ? undefined
      : ddUse >= 0.15
        ? "loss"
        : ddUse >= 0.05
          ? "pending"
          : undefined;

  return (
    <div
      className={cn(
        "shrink-0 border-b border-white/[0.1] bg-[#080c14]/98 relative z-10 backdrop-blur-md transition-colors duration-500",
        modeShellClass(status.sizeMode)
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

      {/* Primary — scannable capital facts only */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <PrimaryMetric
          label="Equity"
          value={formatNokPlain(status.equity)}
          emphasis
          title="Engine bankroll equity — sole capital truth"
        />
        <StripSep />
        <PrimaryMetric
          label="Liquid"
          value={formatNokPlain(status.liquid)}
          title={
            status.v2
              ? "Riskable liquid = equity − secure − open"
              : "Equity − open risk"
          }
        />
        {status.v2 && status.secure > 0 && (
          <>
            <span className="hidden lg:inline text-[11px] text-muted-foreground font-mono">
              <span className="opacity-60">Secure </span>
              {formatNokPlain(status.secure)}
            </span>
          </>
        )}
        <StripSep />
        <PrimaryMetric
          label="Open risk"
          value={formatNokPlain(status.openRisk)}
          tone="pending"
          title={openHover}
        />
        <StripSep />
        <PrimaryMetric
          label="DD%"
          value={status.ddPctLabel}
          tone={ddTone}
          emphasis={ddUse != null && ddUse >= 0.1}
          title={
            distReduce
              ? `Drawdown from peak · ${distReduce}`
              : "Drawdown from high-water mark"
          }
        />

        <div className="flex-1 min-w-[8px]" />

        {/* size_mode — dominant visual language */}
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5",
            status.sizeMode === "FROZEN" &&
              "border-loss/40 bg-loss/10",
            status.sizeMode === "REDUCED" &&
              "border-pending/40 bg-pending/10",
            status.sizeMode === "NORMAL" &&
              "border-primary/30 bg-primary/10",
            status.sizeMode === "LEGACY" && "border-white/10 bg-white/5"
          )}
          title="Size mode from drawdown / freeze layers"
        >
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            Mode
          </span>
          <Badge
            variant={modeBadgeVariant(status.sizeMode)}
            className="text-[12px] font-bold font-sans h-6 px-2.5 tracking-wide"
          >
            {status.sizeMode === "LEGACY" ? "—" : status.sizeMode}
          </Badge>
        </div>

        {/* Single source of truth: Can bet */}
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5",
            status.canBet
              ? "border-profit/30 bg-profit/10"
              : "border-loss/35 bg-loss/10"
          )}
          title={status.reason}
        >
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            Can bet
          </span>
          <Badge
            variant={gateBadgeVariant(status.gate)}
            className="text-[12px] font-bold font-sans h-6 px-2.5 tracking-wide"
          >
            {status.betLabel}
          </Badge>
        </div>

        {status.gate === "FROZEN" && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs font-sans border-amber-500/50 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20"
            onClick={onUnfreeze}
          >
            <Unlock className="h-3.5 w-3.5" />
            Unfreeze
          </Button>
        )}

        <button
          type="button"
          onClick={() => setSecondaryOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-sans px-2 py-1.5 rounded-lg hover:bg-white/5 min-h-[32px]"
          title={secondaryOpen ? "Hide rooms & scope" : "Show rooms & scope"}
        >
          {secondaryOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">More</span>
        </button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-3 text-xs font-sans"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* One-line reason when not clear */}
      {!status.canBet && (
        <div className="px-4 pb-2 -mt-1">
          <p className="text-[11px] text-muted-foreground leading-snug max-w-3xl">
            {status.reason}
          </p>
        </div>
      )}

      {secondaryOpen && (
        <div className="px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] border-t border-white/[0.05] bg-black/25">
          <SecMetric label="Remaining" value={formatNokPlain(status.remaining)} />
          <SecMetric label="Unit" value={formatNokPlain(status.unit)} />
          {status.openRoom != null && (
            <SecMetric label="Open room" value={formatNokPlain(status.openRoom)} />
          )}
          {status.dailyRoom != null && (
            <SecMetric label="Day room" value={formatNokPlain(status.dailyRoom)} />
          )}
          {status.weeklyRoom != null && (
            <SecMetric label="Week room" value={formatNokPlain(status.weeklyRoom)} />
          )}
          {status.todayPl != null && (
            <SecMetric
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
          <SecMetric
            label="Util"
            value={`${(util * 100).toFixed(0)}%`}
            tone={util >= 0.95 ? "loss" : util >= 0.8 ? "pending" : undefined}
          />
          <SecMetric label="Phase" value={String(phase.phase_id ?? "—")} sans />
          <SecMetric label="Stake band" value={stakeBand} />
          {distReduce && <SecMetric label="DD path" value={distReduce} sans />}

          <div className="flex-1 min-w-[4px]" />

          <div className="flex items-center rounded-lg border border-white/[0.1] bg-black/30 p-0.5 font-sans">
            <button
              type="button"
              onClick={() => setFilterScope("full")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors min-h-[28px]",
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
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors min-h-[28px]",
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-sans hover:bg-white/10 max-w-[200px] min-h-[28px]"
            >
              <span className="truncate">Forensic · {forensicLabel}</span>
              <X className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>
          )}

          {forensicActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[11px] font-sans"
              onClick={() => setView("bets")}
            >
              Ledger
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeResult(r: string): string {
  return (r || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function StripSep() {
  return <div className="hidden sm:block h-5 w-px bg-white/[0.1] shrink-0" />;
}

function PrimaryMetric({
  label,
  value,
  tone,
  emphasis,
  title,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "pending";
  emphasis?: boolean;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0" title={title}>
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold font-sans">
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums leading-none",
          emphasis ? "text-[15px] font-bold" : "text-[14px] font-semibold",
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

function SecMetric({
  label,
  value,
  tone,
  sans,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "pending";
  sans?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold font-sans shrink-0">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-[12px] font-semibold",
          sans ? "font-sans" : "font-mono",
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
