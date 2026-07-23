/**
 * Bankroll Plan — hero status, visual rules, DD path, rooms, audit trails.
 */
import { useMemo, useState } from "react";
import {
  Shield,
  Snowflake,
  TrendingDown,
  Wallet,
  Layers,
  Unlock,
  History,
  Gauge,
  Scale,
  Lock,
  Percent,
  Calendar,
  CalendarRange,
  Landmark,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { isTauri } from "@/lib/tauri";
import { formatNokPlain, cn } from "@/lib/utils";
import { ddProgress } from "@/lib/capital";
import {
  deriveRiskStatus,
  gateBadgeVariant,
  hybridPhaseChip,
  modeHeroClass,
  nextActionFor,
  regimeProgressChip,
  secureSkimStatus,
  unitSizeChip,
  weeklyExploreQuotaChip,
} from "@/lib/riskStatus";
import { phaseRadarDims, sizeModeWhy } from "@/lib/phaseRadar";
import type { PhaseState, RiskState } from "@/types";

function ProgressTrack({
  value,
  tone = "gold",
  label,
}: {
  value: number;
  tone?: "gold" | "amber" | "red" | "muted";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{label}</span>
          <span className="font-mono tabular-nums">{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-black/40 border border-white/[0.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            tone === "gold" && "bg-primary/85",
            tone === "amber" && "bg-pending/85",
            tone === "red" && "bg-loss/85",
            tone === "muted" && "bg-white/20"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const ACTIVE_RULES: {
  icon: typeof Scale;
  title: string;
  description: string;
}[] = [
  {
    icon: Scale,
    title: "Unit sizing",
    description:
      "Continuous unit primary when phase_continuous on (~+1 NOK / 100 equity in band); liquid ladder 12/15/20 fallback",
  },
  {
    icon: TrendingDown,
    title: "Drawdown sizing",
    description: "REDUCED at 15% DD (half unit) · FREEZE at 25% DD",
  },
  {
    icon: Calendar,
    title: "Daily hard stop",
    description: "4% of liquid at day start, or 3× unit — whichever binds",
  },
  {
    icon: CalendarRange,
    title: "Weekly hard stop",
    description: "8% of liquid at week start, or 6× unit — whichever binds",
  },
  {
    icon: Gauge,
    title: "Portfolio open risk",
    description: "Open tickets ≤ 18% of riskable liquid",
  },
  {
    icon: Landmark,
    title: "Secure Variant A",
    description:
      "Soft skim 15% above ref×1.25 · hard 30% above ref×1.50 (hard replaces soft) · liquid floor = phase daily_risk_ceil",
  },
  {
    icon: Shield,
    title: "Working buffer floor",
    description: "Working capital stays ≥ max(55% equity, 8× unit)",
  },
  {
    icon: Ban,
    title: "NT stake floor",
    description: "Never place stakes in (0, 10) NOK — fail closed to 0 or ≥10",
  },
];

export function CapitalPlanPanel() {
  const snapshot = useDataStore((s) => s.snapshot);
  const refresh = useDataStore((s) => s.refresh);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setToast = useAppStore((s) => s.setToast);
  const [busy, setBusy] = useState(false);

  const risk = (snapshot?.risk || {}) as RiskState;
  const phase = (snapshot?.phase || {}) as PhaseState;
  const segs = (snapshot?.capital_segments || {}) as Record<string, unknown>;
  const status = deriveRiskStatus(snapshot?.risk, snapshot?.bankroll, snapshot?.phase);
  const next = nextActionFor(status);
  const radar = phaseRadarDims(phase);
  const whyMode = sizeModeWhy(risk, phase);
  const progressChip = regimeProgressChip(risk, {
    stale: status.staleRiskSchema,
  });
  const exploreQuotaChip = weeklyExploreQuotaChip(risk, {
    stale: status.staleRiskSchema,
  });
  const phaseChip = hybridPhaseChip(risk, phase);
  const unitChip = unitSizeChip(risk, phase);
  const secureStatus = secureSkimStatus(risk, segs);

  const equity = status.equity;
  const secure = status.secure;
  const working =
    Number(risk.working_equity_nok) || Math.max(0, equity - secure);
  const openCap = Number(risk.portfolio_open_risk_cap_nok);
  const dd = status.dd;
  const ddKnown = dd != null;
  const ddInfo = ddKnown ? ddProgress(dd!) : null;

  const transfers = useMemo(() => {
    const t = segs.secure_transfers;
    return Array.isArray(t)
      ? ([...t] as Record<string, unknown>[]).reverse().slice(0, 8)
      : [];
  }, [segs.secure_transfers]);

  const freezeAudit = useMemo(() => {
    const t = segs.freeze_audit;
    return Array.isArray(t)
      ? ([...t] as Record<string, unknown>[]).reverse().slice(0, 6)
      : [];
  }, [segs.freeze_audit]);

  const daySnap = (segs.day_snapshot || {}) as Record<string, unknown>;
  const weekSnap = (segs.week_snapshot || {}) as Record<string, unknown>;

  const onUnfreeze = async () => {
    if (!isTauri() || demo) {
      setToast("Unfreeze needs live desktop + tracker folder");
      return;
    }
    if (
      !window.confirm(
        "Clear capital freeze?\n\nWrites freeze_audit and refreshes engine state. Only after reviewing DD / stop reasons."
      )
    )
      return;
    setBusy(true);
    try {
      const { runNtCommand } = await import("@/lib/tauri");
      const res = await runNtCommand([
        "capital",
        "unfreeze",
        "--confirm",
        "--actor",
        "lumina_plan",
        "--reason",
        "app_plan_unfreeze",
      ]);
      if (!res.ok || res.exit_code !== 0) {
        setToast("Unfreeze failed — check Ops log");
      } else {
        setToast("Unfreeze applied");
        await refresh({ runNtRefresh: true });
      }
    } catch (e) {
      setToast(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Tauri only (same gate as DeskStrip) — browser cannot rewrite risk.json */}
      {status.staleRiskSchema && !demo && isTauri() && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-100">
              STALE RISK
            </div>
            <p className="text-sm text-amber-50/90 mt-0.5 leading-snug">
              Pre-package risk schema — run engine Refresh before trusting regime caps /
              min-EV. UI shows raw engine fields only (no invented 50 NOK / 4%).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400/50 text-amber-50 bg-amber-500/15 shrink-0"
            disabled={busy}
            onClick={() => refresh({ runNtRefresh: true })}
          >
            Refresh engine
          </Button>
        </div>
      )}

      {/* Hero — current status is the page lead */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6 md:p-7 bg-card",
          status.gate === "FROZEN" && "border-loss/30",
          status.gate === "REDUCED" && "border-pending/30",
          status.canBet && status.gate !== "REDUCED" && "border-primary/25",
          !status.canBet && status.gate !== "FROZEN" && "border-white/[0.1]"
        )}
      >

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2.5">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold tracking-tight">Bankroll plan</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Engine is sole bankroll truth. Live rooms, size mode, and freeze state
              from risk + capital segments.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div
              className={cn(
                "rounded-2xl border px-5 py-3 text-center min-w-[140px]",
                modeHeroClass(status.sizeMode)
              )}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] opacity-80 font-semibold">
                Size mode
              </div>
              <div className="mt-1 text-2xl font-bold tracking-wide">
                {status.sizeMode === "LEGACY" ? "—" : status.sizeMode}
              </div>
            </div>
            <Badge
              variant={gateBadgeVariant(status.gate)}
              className="text-sm font-bold px-4 py-1.5 h-auto"
            >
              {status.betLabel}
            </Badge>
          </div>
        </div>

        {/* Phase health radar + why size_mode */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Phase health
            </div>
            {radar.map((d) => (
              <div key={d.id} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {d.rawLabel}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/40 border border-white/[0.06] overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      d.tone === "ok" && "bg-profit/80",
                      d.tone === "warn" && "bg-pending/80",
                      d.tone === "loss" && "bg-loss/80",
                      d.tone === "neutral" && "bg-white/25"
                    )}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Why this size_mode
            </div>
            <div className="text-sm font-mono font-bold">
              {status.sizeMode}
              {risk.size_mode_capital &&
                String(risk.size_mode_capital).toUpperCase() !== status.sizeMode && (
                  <span className="text-muted-foreground font-normal text-xs ml-2">
                    (capital {String(risk.size_mode_capital)})
                  </span>
                )}
            </div>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {whyMode.map((line, i) => (
                <li
                  key={i}
                  className="text-[11px] text-muted-foreground leading-snug border-l-2 border-primary/30 pl-2"
                >
                  {line}
                </li>
              ))}
            </ul>
            {phase.process_health_until && (
              <p className="text-[11px] text-pending pt-1">
                Process hold until {String(phase.process_health_until)}
              </p>
            )}
          </div>
        </div>

        {/* Next action hero strip */}
        <div
          className={cn(
            "mt-6 rounded-xl border px-4 py-3.5 flex flex-wrap items-center justify-between gap-3",
            next.urgent
              ? "border-loss/30 bg-loss/[0.07]"
              : status.gate === "REDUCED"
                ? "border-pending/25 bg-pending/[0.06]"
                : "border-primary/20 bg-primary/[0.05]"
          )}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
              Current status · next action
            </div>
            <div className="mt-1 text-base font-semibold">{next.title}</div>
            <p className="mt-0.5 text-sm text-muted-foreground leading-snug max-w-2xl">
              {next.detail}
            </p>
          </div>
          {next.showUnfreeze && (
            <Button
              size="default"
              variant="outline"
              className="border-amber-500/55 text-amber-50 bg-amber-500/15 gap-2 h-11 px-5 shrink-0"
              disabled={busy}
              onClick={onUnfreeze}
            >
              <Unlock className="h-4 w-4" />
              Unfreeze now
            </Button>
          )}
        </div>

        {/* Capital metrics */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: "Equity", value: formatNokPlain(equity), hint: "ledger" },
            {
              label: "Secure",
              value: formatNokPlain(secure),
              hint: secureStatus.lastTier
                ? `last skim ${secureStatus.lastTier}`
                : "non-risked",
            },
            { label: "Working", value: formatNokPlain(working), hint: "equity − secure" },
            { label: "Riskable liquid", value: formatNokPlain(status.liquid), hint: "− open" },
            {
              label: "Unit",
              value: formatNokPlain(unitChip.unit),
              hint: unitChip.sourceHint,
            },
            { label: "Remaining", value: formatNokPlain(status.remaining), hint: "new risk room" },
            {
              label: "Regime",
              value: String(
                status.bankrollRegimeLabel || status.bankrollRegime || "—"
              ),
              hint:
                status.regimeOpenCap != null
                  ? `open cap ${formatNokPlain(status.regimeOpenCap)} (engine)`
                  : status.staleRiskSchema
                    ? "stale schema — refresh"
                    : "no regime cap",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-3"
            >
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                {m.label}
              </div>
              <div className="mt-1.5 text-xl font-bold tabular-nums font-mono tracking-tight">
                {m.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>
            </div>
          ))}
        </div>

        {/* Hybrid phase progression + continuous unit + secure skim */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div
            className="rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-3"
            title={phaseChip.detail}
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Phase progression
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight">
                {phaseChip.phaseId}
              </span>
              {phaseChip.hardGateLabel && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {phaseChip.hardGateLabel}
                </span>
              )}
            </div>
            {phase.label && (
              <p className="text-[12px] text-muted-foreground">{String(phase.label)}</p>
            )}
            {phaseChip.progress != null ? (
              <ProgressTrack
                value={phaseChip.progressPct}
                tone="gold"
                label="Inside phase band"
              />
            ) : (
              <p className="text-[12px] text-muted-foreground">
                No progress_inside_phase from engine yet
              </p>
            )}
            {phase.next != null && (
              <p className="text-[11px] text-muted-foreground font-mono">
                next {String(phase.next)}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Unit sizing
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatNokPlain(unitChip.unit)}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {unitChip.note ||
                (unitChip.sourceHint === "continuous"
                  ? "Continuous unit from phase band (engine)"
                  : unitChip.sourceHint === "ladder"
                    ? "Liquid unit ladder (engine)"
                    : "Engine unit_size_nok")}
            </p>
            {(unitChip.continuous != null || unitChip.ladder != null) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <RoomCell
                  label="Continuous"
                  value={
                    unitChip.continuous != null
                      ? formatNokPlain(unitChip.continuous)
                      : "—"
                  }
                />
                <RoomCell
                  label="Ladder"
                  value={
                    unitChip.ladder != null
                      ? formatNokPlain(unitChip.ladder)
                      : "—"
                  }
                />
              </div>
            )}
          </div>

          <div
            className="rounded-xl border border-white/[0.08] bg-black/25 p-4 space-y-2"
            title={secureStatus.detail}
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Secure bucket
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {formatNokPlain(secureStatus.secure)}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {secureStatus.lastTier
                ? `Last skim tier: ${secureStatus.lastTier}${
                    secureStatus.lastTransferNok != null
                      ? ` · ${formatNokPlain(secureStatus.lastTransferNok)}`
                      : ""
                  }`
                : "No secure skim yet (Variant A soft 1.25×/15% · hard 1.50×/30%)"}
            </p>
            {secureStatus.lastTs && (
              <p className="text-[11px] font-mono text-muted-foreground">
                {secureStatus.lastTs.replace("T", " ").slice(0, 16)}
              </p>
            )}
            {secureStatus.lockSettledCount != null && (
              <p className="text-[11px] text-muted-foreground">
                Lock epoch settled count: {secureStatus.lockSettledCount}
              </p>
            )}
          </div>
        </div>

        {/* DD path + rooms — visual weight */}
        <div className="mt-6 grid lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingDown className="h-4 w-4 text-primary" />
              Drawdown path
              {ddKnown && (
                <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground font-normal">
                  {(dd! * 100).toFixed(1)}% from peak
                </span>
              )}
            </div>
            {ddInfo ? (
              <>
                <ProgressTrack
                  value={ddInfo.reducePct}
                  tone={dd! >= 0.15 ? "amber" : "gold"}
                  label="Toward 15% REDUCED"
                />
                <ProgressTrack
                  value={ddInfo.freezePct}
                  tone={dd! >= 0.25 ? "red" : dd! >= 0.15 ? "amber" : "muted"}
                  label="Toward 25% FREEZE"
                />
                <p className="text-[12px] text-muted-foreground pt-1">{ddInfo.label}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Drawdown not available yet — peak equity will appear after refresh.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="h-4 w-4 text-primary" />
              Risk rooms remaining
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <RoomCell
                label="Open risk"
                value={
                  Number.isFinite(openCap)
                    ? `${formatNokPlain(status.openRisk)} / ${formatNokPlain(openCap)}`
                    : formatNokPlain(status.openRisk)
                }
              />
              <RoomCell
                label="Open room (18%)"
                value={
                  status.openRoom != null ? formatNokPlain(status.openRoom) : "—"
                }
              />
              <RoomCell
                label="Day loss room"
                value={
                  status.dailyRoom != null ? formatNokPlain(status.dailyRoom) : "—"
                }
              />
              <RoomCell
                label="Week loss room"
                value={
                  status.weeklyRoom != null ? formatNokPlain(status.weeklyRoom) : "—"
                }
              />
              <RoomCell
                label="Regime open-risk cap"
                value={
                  status.regimeOpenCap != null
                    ? formatNokPlain(status.regimeOpenCap)
                    : "—"
                }
              />
              <RoomCell
                label="Regime min-EV"
                value={
                  status.regimeMinEv != null
                    ? `${(status.regimeMinEv * 100).toFixed(0)}%`
                    : "std"
                }
              />
              {exploreQuotaChip && (
                <RoomCell
                  label={
                    exploreQuotaChip.derived
                      ? "Weekly explore (derived)"
                      : "Weekly explore"
                  }
                  value={
                    exploreQuotaChip.evWindowLabel
                      ? `${exploreQuotaChip.quotaLabel} · ${exploreQuotaChip.evWindowLabel}`
                      : exploreQuotaChip.quotaLabel
                  }
                />
              )}
            </div>
            {status.bankrollRegime && status.bankrollRegime !== "normal" && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {status.bankrollRegimeLabel}: open cap is pending-only and frees on
                settlement. Values are engine-written — never recomputed in UI.
                {status.staleRiskSchema
                  ? " STALE schema: do not map legacy calibration exits to package Exploration 40."
                  : ""}
              </p>
            )}
            {/* Progress only when package schema is fresh */}
            {progressChip && (
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Regime progress
                </div>
                <ProgressTrack
                  value={progressChip.settledPct}
                  tone="amber"
                  label={progressChip.label}
                />
              </div>
            )}
            {/* Weekly explore quota — engine used/max + EV window (Exploration only) */}
            {exploreQuotaChip && (
              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Weekly explore quota
                  {exploreQuotaChip.derived ? " · derived" : ""}
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono font-semibold text-sm">
                    {exploreQuotaChip.label}
                  </span>
                  {exploreQuotaChip.evWindowLabel && (
                    <span className="text-[12px] text-muted-foreground font-mono">
                      {exploreQuotaChip.evWindowLabel}
                    </span>
                  )}
                </div>
                <ProgressTrack
                  value={
                    exploreQuotaChip.max > 0
                      ? Math.min(
                          100,
                          (exploreQuotaChip.used / exploreQuotaChip.max) * 100
                        )
                      : 0
                  }
                  tone={
                    exploreQuotaChip.used >= exploreQuotaChip.max
                      ? "amber"
                      : "gold"
                  }
                  label={`${exploreQuotaChip.used} of ${exploreQuotaChip.max} used this week`}
                />
              </div>
            )}
            {status.staleRiskSchema && !progressChip && (
              <p className="text-[11px] text-amber-100/80 pt-1">
                Regime progress hidden while schema is stale (would misread
                calibration_exit as Exploration target).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Active rules — visual system, never a run-on string */}
      <div className="rounded-2xl border border-white/[0.08] bg-card/50 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Active rules</h3>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            br_v2.0.0
          </Badge>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {ACTIVE_RULES.map((rule) => {
            const Icon = rule.icon;
            return (
              <div
                key={rule.title}
                className="rounded-xl border border-white/[0.07] bg-black/25 p-3.5 space-y-2 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="text-[13px] font-semibold leading-tight">{rule.title}</h4>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {rule.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Snapshots */}
        <div className="rounded-2xl border border-white/[0.08] bg-card/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            Day / week snapshots
            <span className="text-[11px] font-normal text-muted-foreground ml-1">
              Europe/Oslo
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Day
              </div>
              <div className="font-mono text-xs mt-1.5">
                {String(daySnap.oslo_date || "—")}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">Liquid start</div>
              <div className="font-mono font-semibold text-base">
                {daySnap.liquid_start_nok != null
                  ? formatNokPlain(Number(daySnap.liquid_start_nok))
                  : "—"}
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                Realized{" "}
                {daySnap.realized_pl_nok != null
                  ? Number(daySnap.realized_pl_nok).toFixed(2)
                  : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Week
              </div>
              <div className="font-mono text-xs mt-1.5">
                {String(weekSnap.week_id || "—")}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">Liquid start</div>
              <div className="font-mono font-semibold text-base">
                {weekSnap.liquid_start_nok != null
                  ? formatNokPlain(Number(weekSnap.liquid_start_nok))
                  : "—"}
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                Realized{" "}
                {weekSnap.realized_pl_nok != null
                  ? Number(weekSnap.realized_pl_nok).toFixed(2)
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Freeze */}
        <div className="rounded-2xl border border-white/[0.08] bg-card/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Snowflake className="h-4 w-4 text-pending" />
            Freeze status
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={status.gate === "FROZEN" ? "warning" : "success"}
              className="text-xs font-bold px-3 py-1"
            >
              {status.gate === "FROZEN" ? "FROZEN" : "Clear"}
            </Badge>
            {status.freezeManual && (
              <span className="text-xs text-muted-foreground">Manual freeze active</span>
            )}
            {status.gate === "FROZEN" && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-amber-500/50 text-amber-100 gap-1.5 h-9"
                disabled={busy}
                onClick={onUnfreeze}
              >
                <Unlock className="h-3.5 w-3.5" />
                Unfreeze
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            At 25% drawdown new risk freezes until manual unfreeze after review.
          </p>
          {freezeAudit.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-4 py-8 text-center">
              <Lock className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No freeze events yet</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {freezeAudit.map((a, i) => (
                <div
                  key={i}
                  className="text-[11px] font-mono rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2 flex justify-between gap-2"
                >
                  <span className="text-muted-foreground truncate">
                    {String(a.action || "—")} · {String(a.actor || "")}
                  </span>
                  <span className="shrink-0 opacity-70">
                    {String(a.ts || "").replace("T", " ").slice(0, 16)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Secure transfers */}
      <div className="rounded-2xl border border-white/[0.08] bg-card/40 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-primary" />
          Recent secure transfers
        </div>
        {transfers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-6 py-10 text-center">
            <Percent className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No secure transfers yet. Variant A: soft skim (15% above ref×1.25) or hard
              (30% above ref×1.50) moves surplus to non-risked secure.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/[0.06]">
                  <th className="py-2.5 pr-3 font-medium text-[11px] uppercase tracking-wider">
                    When
                  </th>
                  <th className="py-2.5 pr-3 font-medium text-[11px] uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="py-2.5 pr-3 font-medium text-[11px] uppercase tracking-wider">
                    Moved
                  </th>
                  <th className="py-2.5 pr-3 font-medium text-[11px] uppercase tracking-wider">
                    Secure after
                  </th>
                  <th className="py-2.5 pr-3 font-medium text-[11px] uppercase tracking-wider">
                    Ref after
                  </th>
                  <th className="py-2.5 font-medium text-[11px] uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={i} className="border-b border-white/[0.04] font-mono text-xs">
                    <td className="py-2.5 pr-3 whitespace-nowrap opacity-80">
                      {String(t.ts || "").replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {t.tier != null ? String(t.tier) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-primary font-semibold">
                      {formatNokPlain(Number(t.transferred_nok || 0))}
                    </td>
                    <td className="py-2.5 pr-3">
                      {formatNokPlain(Number(t.secure_after_nok || 0))}
                    </td>
                    <td className="py-2.5 pr-3">
                      {formatNokPlain(Number(t.ref_hwm_after_nok || 0))}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {String(t.reason || "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {status.canBet && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
          Desk and Plan share the same can-bet / size_mode truth from the engine.
        </div>
      )}
    </div>
  );
}

function RoomCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="mt-1 font-mono font-semibold tabular-nums text-sm">{value}</div>
    </div>
  );
}
