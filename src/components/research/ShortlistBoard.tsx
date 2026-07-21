/**
 * Premium shortlist cards — ranked, status-forward, expandable stake rationale.
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
import { buildShortlistCards, sizeModeTone, type ShortlistCard } from "@/lib/capital";
import { formatNokPlain, cn } from "@/lib/utils";
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
  if (status === "win") return "border-profit/35 bg-profit/[0.04]";
  if (status === "loss") return "border-loss/25 bg-loss/[0.03]";
  if (status === "open") return "border-pending/35 bg-pending/[0.05]";
  if (status === "planned") return "border-primary/30 bg-primary/[0.04]";
  return "border-white/[0.08] bg-card/40";
}

function statusLabel(status: ShortlistCard["status"]) {
  if (status === "planned") return "Pending place";
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
    const evA = a.ev ?? -999;
    const evB = b.ev ?? -999;
    return evB - evA;
  });
}

function stakeRationale(c: ShortlistCard): { short: string; detail: string } {
  const parts: string[] = [];
  if (c.unit != null) parts.push(`unit ${formatNokPlain(c.unit)}`);
  if (c.sizeMode) parts.push(c.sizeMode);
  if (c.band) parts.push(`band ${c.band}`);
  if (c.rules) parts.push(c.rules);
  const short =
    c.status === "planned"
      ? c.stake
        ? `Recommended ${formatNokPlain(c.stake)} NOK`
        : "Awaiting stake"
      : c.stake
        ? `Stake ${formatNokPlain(c.stake)} NOK`
        : "No stake";
  const detail =
    parts.length > 0
      ? `${parts.join(" · ")} · ${c.statusReason}`
      : c.statusReason || c.notes || "No extra sizing detail";
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 tracking-tight">
            <ListChecks className="h-5 w-5 text-primary" />
            Shortlist
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Ranked place-slip and live tickets. Primary action order is top-left.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[11px] h-7 px-2.5">
            {cards.length} cards
          </Badge>
          {totalOpenStake > 0 && (
            <Badge variant="outline" className="font-mono text-[11px] h-7 px-2.5 border-pending/30 text-pending">
              {formatNokPlain(totalOpenStake)} open/planned
            </Badge>
          )}
          {status.v2 && (
            <Badge
              variant={modeBadgeVariant(status.sizeMode)}
              className="text-[11px] h-7 px-2.5 font-bold"
            >
              Desk {status.sizeMode}
            </Badge>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] bg-black/25 px-8 py-16 text-center">
          <Shield className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground/90">No shortlist yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Run recommend from Ops to build a place slip. Cards will appear here with
            stake, size mode, and rationale.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-5 gap-1.5"
            onClick={() => setView("workflow")}
          >
            Open Ops
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            cards.length === 1 && "max-w-xl",
            cards.length === 2 && "sm:grid-cols-2 max-w-4xl",
            cards.length >= 3 && "sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {cards.map((c, idx) => {
            const modeTone = sizeModeTone(c.sizeMode);
            const rationale = stakeRationale(c);
            const isOpen = expanded === c.id;
            const riskShare =
              status.liquid > 0 && c.stake
                ? (c.stake / status.liquid) * 100
                : null;

            return (
              <div
                key={c.id}
                className={cn(
                  "group relative flex flex-col rounded-2xl border p-5 transition-all duration-200",
                  "hover:shadow-[0_0_40px_-14px_hsl(var(--primary)/0.35)]",
                  statusShell(c.status)
                )}
              >
                {/* Rank badge */}
                <div className="absolute -top-2.5 left-4">
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-[11px] font-bold font-mono",
                      idx === 0
                        ? "bg-primary text-primary-foreground shadow-[0_0_16px_-2px_hsl(var(--primary)/0.6)]"
                        : "bg-black/60 border border-white/15 text-muted-foreground"
                    )}
                  >
                    #{idx + 1}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold leading-snug line-clamp-2">
                      {c.match}
                    </div>
                    <div className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                      {c.selection}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusIcon status={c.status} />
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
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
                  {c.grade && (
                    <Badge variant="outline" className="text-[11px] h-6">
                      Grade {c.grade}
                    </Badge>
                  )}
                  {c.sizeMode && (
                    <Badge
                      variant={
                        modeTone === "loss"
                          ? "warning"
                          : modeTone === "pending"
                            ? "accent"
                            : "success"
                      }
                      className="text-[11px] h-6 font-bold"
                    >
                      {c.sizeMode}
                    </Badge>
                  )}
                  {c.band && (
                    <Badge variant="secondary" className="text-[11px] h-6 font-mono">
                      {c.band}
                    </Badge>
                  )}
                  {riskShare != null && riskShare > 0 && (c.status === "open" || c.status === "planned") && (
                    <Badge variant="outline" className="text-[11px] h-6 font-mono text-pending border-pending/25">
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

                <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
                  <p className="text-[12px] font-medium text-foreground/90 leading-snug">
                    {rationale.short}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(isOpen ? null : c.id);
                    }}
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
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
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground border-t border-white/[0.05] pt-2">
                      {rationale.detail}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openCard(c)}
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/30 transition-colors min-h-[40px]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Ledger
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs min-h-[36px]"
          onClick={() => setView("workflow")}
        >
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
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-2 py-2.5 text-center">
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
