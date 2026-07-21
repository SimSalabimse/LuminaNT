/**
 * Premium shortlist decision board — ranked, dense, no empty voids.
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { buildShortlistCards, type ShortlistCard } from "@/lib/capital";
import { formatNokPlain, cn } from "@/lib/utils";
import { deriveGateChips } from "@/lib/gateChips";
import { activeControlSignals } from "@/lib/phaseRadar";
import { deriveRiskStatus, modeBadgeVariant } from "@/lib/riskStatus";

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

function statusLabel(status: ShortlistCard["status"]) {
  if (status === "planned") return "To place";
  if (status === "open") return "Open";
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
  const setView = useAppStore((s) => s.setView);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const [expanded, setExpanded] = useState<string | null>(null);

  const status = useMemo(
    () => deriveRiskStatus(snapshot?.risk, snapshot?.bankroll, snapshot?.phase),
    [snapshot]
  );

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
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-card/50 px-8 py-16 text-center max-w-2xl mx-auto">
          <Shield className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-base font-medium">No shortlist yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Run recommend from Ops to build a place slip. Cards appear here with
            stake, size mode, and rationale.
          </p>
          <Button
            size="default"
            variant="outline"
            className="mt-6"
            onClick={() => setView("workflow")}
          >
            Open Ops
          </Button>
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
                      {statusLabel(c.status)}
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

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setView("workflow")}>
          Run recommend in Ops →
        </Button>
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
