/**
 * Premium shortlist decision board — ranked, dense, no empty voids.
 * PR7: single-card place-ack / abandon on Pending (+ abandon on ConfirmedPlaced).
 */
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  ExternalLink,
  ListChecks,
  XCircle,
  Ban,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  ClipboardCheck,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { buildShortlistCards, type ShortlistCard } from "@/lib/capital";
import {
  formatNokPlain,
  cn,
  isOpenRisk,
  isConfirmedPlaced,
  normalizeResultKey,
} from "@/lib/utils";
import { deriveGateChips } from "@/lib/gateChips";
import { activeControlSignals } from "@/lib/phaseRadar";
import {
  deriveRiskStatus,
  modeBadgeVariant,
  regimeProgressChip,
} from "@/lib/riskStatus";
import {
  classifyEmptySlip,
  emptySlipInputFromCoverage,
} from "@/lib/emptySlip";
import { CoverageHealthPanel } from "@/components/research/CoverageHealthPanel";
import { DeepQueuePanel } from "@/components/research/DeepQueuePanel";

/** Ledger Pending (intent) — place-ack target. Not ConfirmedPlaced. */
function isLedgerPending(result: string | null | undefined): boolean {
  return normalizeResultKey(result || "") === "pending";
}

/** Single-card CTAs: place-ack (Pending only) · abandon (open risk). */
function cardActions(c: ShortlistCard): {
  canPlaceAck: boolean;
  canAbandon: boolean;
} {
  if (!c.betId) return { canPlaceAck: false, canAbandon: false };
  const open = isOpenRisk(c.result || "");
  return {
    canPlaceAck: isLedgerPending(c.result),
    canAbandon: open,
  };
}

function StatusIcon({ status }: { status: ShortlistCard["status"] }) {
  if (status === "win") return <CheckCircle2 className="h-5 w-5 text-profit" />;
  if (status === "loss") return <XCircle className="h-5 w-5 text-loss" />;
  if (status === "open") return <CircleDot className="h-5 w-5 text-pending" />;
  if (status === "abandoned") return <Ban className="h-5 w-5 text-muted-foreground" />;
  if (status === "refunded") return <RotateCcw className="h-5 w-5 text-violet" />;
  if (status === "planned") return <Sparkles className="h-5 w-5 text-primary" />;
  return <ListChecks className="h-5 w-5 text-primary" />;
}

function statusShell(status: ShortlistCard["status"]) {
  if (status === "win") return "border-profit/30 bg-card";
  if (status === "loss") return "border-loss/25 bg-card";
  if (status === "open") return "border-pending/35 bg-card";
  if (status === "planned") return "border-primary/30 bg-card";
  return "border-white/[0.08] bg-card";
}

/** Map open-risk ledger result to operator label (Pending vs Confirmed). */
function statusLabel(
  status: ShortlistCard["status"],
  result?: string | null
) {
  if (status === "planned") return "To place";
  if (status === "open") {
    if (isConfirmedPlaced(result || "")) return "Confirmed";
    if (isLedgerPending(result)) return "Pending";
    return "Open";
  }
  if (status === "win") return "Win";
  if (status === "loss") return "Loss";
  if (status === "abandoned") return "Abandoned";
  if (status === "refunded") return "Refunded";
  return "—";
}

function rankCards(cards: ShortlistCard[]): ShortlistCard[] {
  const weight = (s: ShortlistCard["status"]) => {
    if (s === "planned") return 0;
    if (s === "open") return 1;
    if (s === "win") return 2;
    if (s === "loss") return 3;
    return 4;
  };
  return [...cards].sort((a, b) => {
    const dw = weight(a.status) - weight(b.status);
    if (dw !== 0) return dw;
    return (b.ev ?? -999) - (a.ev ?? -999);
  });
}

function stakeRationale(c: ShortlistCard): { short: string; detail: string } {
  const parts: string[] = [];
  if (c.unit != null) parts.push(`Unit ${formatNokPlain(c.unit)} NOK`);
  if (c.sizeMode) parts.push(`Mode ${c.sizeMode}`);
  if (c.band) parts.push(`Band ${c.band}`);
  if (c.rules) parts.push(`Rules ${c.rules}`);
  const short =
    c.status === "planned"
      ? c.stake
        ? `Recommended stake ${formatNokPlain(c.stake)} NOK`
        : "Awaiting stake"
      : c.stake
        ? `Ledger stake ${formatNokPlain(c.stake)} NOK`
        : "No stake";
  const detail =
    parts.length > 0
      ? `${parts.join(" · ")}. ${c.statusReason}`
      : c.statusReason || c.notes || "No extra sizing detail on this ticket.";
  return { short, detail };
}

export function ShortlistBoard() {
  const snapshot = useDataStore((s) => s.snapshot);
  const bets = useDataStore((s) => s.bets);
  const runNt = useDataStore((s) => s.runNt);
  const refreshing = useDataStore((s) => s.refreshing);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const setView = useAppStore((s) => s.setView);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setToast = useAppStore((s) => s.setToast);
  const setError = useAppStore((s) => s.setError);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Bet id currently running place-ack / abandon (single-card busy state). */
  const [busyId, setBusyId] = useState<string | null>(null);

  const status = useMemo(
    () => deriveRiskStatus(snapshot?.risk, snapshot?.bankroll, snapshot?.phase),
    [snapshot]
  );
  const progressChip = useMemo(
    () =>
      regimeProgressChip(snapshot?.risk, { stale: status.staleRiskSchema }),
    [snapshot?.risk, status.staleRiskSchema]
  );
  const regimeIdLower = (status.bankrollRegime || "").toLowerCase();

  const activeSignals = useMemo(
    () => activeControlSignals(snapshot?.control_signals || []),
    [snapshot?.control_signals]
  );
  const highOddsStress = Boolean(
    snapshot?.risk?.high_odds_stress_block || snapshot?.phase?.high_odds_stress_block
  );

  const cards = useMemo(
    () => rankCards(buildShortlistCards(snapshot, bets)),
    [snapshot, bets]
  );

  /** Empty board: no place rows and no live ledger cards → empty-slip taxonomy */
  const emptySlip = useMemo(() => {
    if (cards.length > 0) return null;
    return classifyEmptySlip(
      emptySlipInputFromCoverage(true, snapshot?.coverage_health)
    );
  }, [cards.length, snapshot]);

  const totalOpenStake = useMemo(
    () =>
      cards
        .filter((c) => c.status === "open" || c.status === "planned")
        .reduce((s, c) => s + (c.stake || 0), 0),
    [cards]
  );

  const openCard = (c: ShortlistCard) => {
    if (c.betId) {
      drillForensic({
        dim: "bet_id",
        value: c.betId,
        label: c.match,
        betIds: [c.betId],
        filterPatch: {},
        targetView: "bets",
      });
    } else {
      setView("bets");
    }
  };

  /** PR7 D16: place-ack single card — Pending → ConfirmedPlaced. */
  const onPlaceAck = async (c: ShortlistCard) => {
    const betId = c.betId;
    if (!betId || !isLedgerPending(c.result)) {
      setError("place-ack only applies to ledger Pending tickets");
      return;
    }
    if (demo) {
      setError(
        "CLI commands require a live tracker folder in the desktop app."
      );
      return;
    }
    const ok = window.confirm(
      `Place-ack ${betId}?\n\n` +
        `${c.match} · ${c.selection}\n` +
        `Pending → ConfirmedPlaced (placed on NT).`
    );
    if (!ok) {
      setToast("Place-ack cancelled");
      return;
    }
    setBusyId(betId);
    try {
      await runNt(["place-ack", "--ids", betId]);
    } finally {
      setBusyId(null);
    }
  };

  /** PR7 D16: abandon open-risk card — reason required (default not_placed). */
  const onAbandon = async (c: ShortlistCard) => {
    const betId = c.betId;
    if (!betId || !isOpenRisk(c.result || "")) {
      setError("abandon only applies to Pending or ConfirmedPlaced tickets");
      return;
    }
    if (demo) {
      setError(
        "CLI commands require a live tracker folder in the desktop app."
      );
      return;
    }
    const reason = "not_placed";
    const ok = window.confirm(
      `Abandon ${betId}?\n` +
        `${c.match} · ${c.selection}\n` +
        `Reason: ${reason}\n\n` +
        `Frees open risk · P/L 0.`
    );
    if (!ok) {
      setToast("Abandon cancelled");
      return;
    }
    setBusyId(betId);
    try {
      await runNt(["abandon", "--ids", betId, "--reason", reason]);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Board header */}
      <div className="rounded-2xl border border-white/[0.08] bg-card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 tracking-tight">
            <ListChecks className="h-5 w-5 text-primary" />
            Decision board
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ranked place-slip and live tickets · top-left is recommended first
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono h-8 px-3">
            {cards.length} cards
          </Badge>
          {totalOpenStake > 0 && (
            <Badge
              variant="outline"
              className="font-mono h-8 px-3 border-pending/30 text-pending"
            >
              {formatNokPlain(totalOpenStake)} open
            </Badge>
          )}
          {status.v2 && (
            <Badge
              variant={modeBadgeVariant(status.sizeMode)}
              className="h-8 px-3 font-bold"
            >
              {status.sizeMode}
            </Badge>
          )}
          <Badge
            variant={status.canBet ? "success" : "loss"}
            className="h-8 px-3 font-bold"
          >
            {status.betLabel}
          </Badge>
          {status.staleRiskSchema && (
            <Badge
              variant="warning"
              className="h-8 px-3 font-bold"
              title="Pre-package risk schema — run engine Refresh. Caps/min-EV may be wrong."
            >
              STALE RISK
            </Badge>
          )}
          {status.bankrollRegime && (
            <Badge
              variant={regimeIdLower === "normal" ? "secondary" : "outline"}
              className={cn(
                "h-8 px-3 font-mono",
                (regimeIdLower === "exploration" ||
                  regimeIdLower === "calibration") &&
                  "border-pending/40 text-pending"
              )}
              title={
                status.regimeOpenCap != null
                  ? `Open cap ${status.regimeOpenCap} (engine) · min-EV ${
                      status.regimeMinEv != null
                        ? `${(status.regimeMinEv * 100).toFixed(0)}%`
                        : "std"
                    }`
                  : "Normal regime"
              }
            >
              {status.bankrollRegimeLabel || status.bankrollRegime}
              {status.regimeOpenCap != null
                ? ` · cap ${formatNokPlain(status.regimeOpenCap)}`
                : ""}
            </Badge>
          )}
          {progressChip && (
            <Badge
              variant="secondary"
              className="h-8 px-3 font-mono"
              title={`Regime progress: ${progressChip.label}`}
            >
              {progressChip.settled}/{progressChip.exitSettled} exit
            </Badge>
          )}
        </div>
      </div>

      <CoverageHealthPanel placeEmpty={cards.length === 0} />
      <DeepQueuePanel />

      {cards.length === 0 && emptySlip ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed px-8 py-14 text-center max-w-2xl mx-auto",
            emptySlip.isSuccess
              ? "border-profit/25 bg-profit/5"
              : emptySlip.kind === "process_miss"
                ? "border-loss/30 bg-loss/5"
                : emptySlip.kind === "process_miss_soft"
                  ? "border-pending/30 bg-pending/5"
                  : "border-white/[0.1] bg-card/50"
          )}
        >
          <Shield
            className={cn(
              "h-9 w-9 mx-auto mb-3",
              emptySlip.isSuccess
                ? "text-profit/70"
                : emptySlip.kind === "process_miss"
                  ? "text-loss/70"
                  : "text-muted-foreground/40"
            )}
          />
          <p className="text-base font-medium">{emptySlip.title}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            {emptySlip.detail}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              size="default"
              variant={emptySlip.isSuccess ? "outline" : "default"}
              onClick={() => setView(emptySlip.primaryCta.view)}
            >
              {emptySlip.primaryCta.label}
            </Button>
            {emptySlip.secondaryCta && (
              <Button
                size="default"
                variant="outline"
                onClick={() => setView(emptySlip.secondaryCta!.view)}
              >
                {emptySlip.secondaryCta.label}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            cards.length === 1 && "max-w-xl mx-auto",
            cards.length === 2 && "sm:grid-cols-2 max-w-4xl mx-auto",
            cards.length >= 3 && "sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {cards.map((c, idx) => {
            const rationale = stakeRationale(c);
            const isOpen = expanded === c.id;
            const actions = cardActions(c);
            const cardBusy = Boolean(c.betId && busyId === c.betId);
            const cliDisabled = demo || refreshing || cardBusy;
            const riskShare =
              status.liquid > 0 && c.stake
                ? (c.stake / status.liquid) * 100
                : null;

            return (
              <article
                key={c.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-5 min-h-[320px]",
                  "transition-colors duration-150 hover:border-primary/35",
                  statusShell(c.status)
                )}
              >
                <div className="absolute -top-2.5 left-4 z-[1]">
                  <span
                    className={cn(
                      "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2.5 text-[12px] font-bold font-mono border",
                      idx === 0
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-white/15 text-muted-foreground"
                    )}
                  >
                    #{idx + 1}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 pt-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold leading-snug line-clamp-2">
                      {c.match}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-snug">
                      {c.selection}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusIcon status={c.status} />
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        c.status === "planned" && "text-primary",
                        c.status === "open" && "text-pending",
                        c.status === "win" && "text-profit",
                        c.status === "loss" && "text-loss"
                      )}
                    >
                      {statusLabel(c.status, c.result)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {deriveGateChips({
                    grade: c.grade,
                    sizeMode: c.sizeMode,
                    notes: c.notes,
                    statusReason: c.statusReason,
                    sport: c.sport,
                    activeSignals,
                    highOddsStress,
                  }).map((chip) => (
                    <Badge
                      key={chip.id}
                      variant={
                        chip.tone === "ok"
                          ? "success"
                          : chip.tone === "warn"
                            ? "warning"
                            : chip.tone === "loss"
                              ? "loss"
                              : chip.tone === "primary"
                                ? "default"
                                : "secondary"
                      }
                      className="h-7 text-[11px] font-semibold"
                    >
                      {chip.label}
                    </Badge>
                  ))}
                  {c.band && (
                    <Badge variant="secondary" className="h-7 text-[11px] font-mono">
                      {c.band}
                    </Badge>
                  )}
                  {riskShare != null &&
                    riskShare > 0 &&
                    (c.status === "open" || c.status === "planned") && (
                      <Badge
                        variant="outline"
                        className="h-7 text-[11px] font-mono border-pending/30 text-pending"
                      >
                        {riskShare.toFixed(1)}% liquid
                      </Badge>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Metric label="Odds" value={c.odds ? c.odds.toFixed(2) : "—"} />
                  <Metric
                    label="Stake"
                    value={c.stake ? formatNokPlain(c.stake) : "—"}
                    accent
                  />
                  <Metric
                    label="EV"
                    value={
                      c.ev != null
                        ? `${c.ev >= 0 ? "+" : ""}${(c.ev * 100).toFixed(1)}%`
                        : "—"
                    }
                    tone={
                      c.ev != null && c.ev >= 0
                        ? "profit"
                        : c.ev != null
                          ? "loss"
                          : undefined
                    }
                  />
                  <Metric
                    label="p_model"
                    value={
                      c.pModel != null ? `${(c.pModel * 100).toFixed(0)}%` : "—"
                    }
                  />
                </div>

                <div className="mt-auto pt-4">
                  <div className="rounded-xl border border-white/[0.07] bg-black/35 px-3.5 py-3">
                    <p className="text-[13px] font-medium leading-snug">
                      {rationale.short}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-primary min-h-[28px]"
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Hide detail
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Why this stake
                        </>
                      )}
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground border-t border-white/[0.06] pt-2">
                        {rationale.detail}
                      </p>
                    )}
                  </div>

                  {(actions.canPlaceAck || actions.canAbandon) && (
                    <div className="mt-3 flex flex-col gap-2">
                      {actions.canPlaceAck && (
                        <Button
                          type="button"
                          size="default"
                          variant="default"
                          disabled={cliDisabled}
                          title={
                            demo
                              ? "Disabled in demo mode — use live tracker"
                              : "Pending → ConfirmedPlaced after placing on NT"
                          }
                          onClick={() => onPlaceAck(c)}
                          className="w-full min-h-[44px]"
                        >
                          {cardBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          )}
                          Place-ack
                        </Button>
                      )}
                      {actions.canAbandon && (
                        <Button
                          type="button"
                          size="default"
                          variant="outline"
                          disabled={cliDisabled}
                          title={
                            demo
                              ? "Disabled in demo mode — use live tracker"
                              : "Abandon open risk · reason not_placed"
                          }
                          onClick={() => onAbandon(c)}
                          className="w-full min-h-[44px] border-loss/30 text-loss hover:bg-loss/10 hover:border-loss/45"
                        >
                          {cardBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Abandon
                        </Button>
                      )}
                      {demo && (
                        <p className="text-[11px] text-muted-foreground text-center">
                          Demo mode — CLI disabled
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => openCard(c)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] py-2.5 text-[13px] font-medium text-primary hover:bg-primary/10 hover:border-primary/30 min-h-[44px]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Ledger
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {emptySlip ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setView(emptySlip.primaryCta.view)}
            >
              {emptySlip.primaryCta.label} →
            </Button>
            {emptySlip.secondaryCta && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setView(emptySlip.secondaryCta!.view)}
              >
                {emptySlip.secondaryCta.label}
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setView("workflow")}>
            Board → Recommend in Ops →
          </Button>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/35 px-2 py-2.5 text-center">
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold font-mono tabular-nums",
          accent && "text-primary",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss"
        )}
      >
        {value}
      </div>
    </div>
  );
}
