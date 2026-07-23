/**
 * Simple Mode chrome — traffic light + summary + Why + metric chips.
 * One expand → flat ReasoningChainView (progressive disclosure).
 * Never titles "UNKNOWN pick"; Partial only for missing numeric SSOT.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ControlSignal, ReasoningChain } from "@/types";
import {
  chainCompleteness,
  evTone,
  gradeTone,
  haircutEvOf,
  simpleModeSummary,
  stakeNokOf,
  trafficLightFromChain,
  trafficLightLabel,
  trafficLightTone,
  unitNokOf,
  whyNotText,
  whyThisText,
} from "@/lib/resolveReasoningChain";
import { cn, formatNokPlain } from "@/lib/utils";
import { ReasoningChainView } from "@/components/reasoning/ReasoningChainView";

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  let n = Number(v);
  if (Math.abs(n) > 1.5) n = n / 100;
  return `${(n * 100).toFixed(digits)}%`;
}

function MetricChip({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-black/25 px-1.5 py-0.5 text-[10px]",
        className
      )}
    >
      <span className="uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <span className="font-mono tabular-nums text-foreground/90">{value}</span>
    </span>
  );
}

function controlSignalChips(
  chain: ReasoningChain,
  activeSignals?: ControlSignal[] | null
): string[] {
  const out: string[] = [];
  const controls = chain.controls as
    | { explore?: boolean; size_mode?: string }
    | null
    | undefined;
  if (controls?.explore) out.push("Explore");
  if (controls?.size_mode && String(controls.size_mode).toUpperCase() !== "LEGACY") {
    out.push(String(controls.size_mode).toUpperCase());
  }
  const local = Array.isArray(chain.control_signals) ? chain.control_signals : [];
  for (const sig of local) {
    if (typeof sig === "string" && sig.trim()) {
      out.push(sig.trim());
      continue;
    }
    if (sig && typeof sig === "object") {
      const kind = String((sig as { kind?: string }).kind || "").trim();
      if (kind) out.push(kind);
    }
  }
  const sport = String(chain.sport || "").toLowerCase();
  if (activeSignals?.length && sport) {
    for (const s of activeSignals) {
      if (
        s.sport &&
        String(s.sport).toLowerCase() === sport &&
        s.kind &&
        !out.includes(String(s.kind))
      ) {
        out.push(String(s.kind));
      }
    }
  }
  // Dedupe preserve order
  return [...new Set(out)].slice(0, 6);
}

export function SimpleModeCard({
  chain,
  /** When false, always show full chain (settings.simpleMode off). */
  simpleMode = true,
  compact = false,
  className,
  /** Visual hierarchy: recommended cards use primary yellow emphasis */
  emphasis = "default",
  /** Optional ledger grade if chain.grade empty */
  fallbackGrade,
  /** Active ControlSignals for sport (from snapshot) */
  activeSignals,
}: {
  chain: ReasoningChain | null | undefined;
  simpleMode?: boolean;
  compact?: boolean;
  className?: string;
  emphasis?: "primary" | "default" | "quiet";
  fallbackGrade?: string | null;
  activeSignals?: ControlSignal[] | null;
}) {
  const [openFull, setOpenFull] = useState(!simpleMode);
  const light = trafficLightFromChain(chain);
  const tone = trafficLightTone(light);
  const summary = simpleModeSummary(chain);
  const why = whyThisText(chain);
  const whyNot = whyNotText(chain);
  const complete = chainCompleteness(chain);

  if (!chain) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-3 py-2.5",
          className
        )}
      >
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          No reasoning chain SSOT for this line — engine may not have emitted{" "}
          <code className="font-mono text-[10px]">reasoning_chains.jsonl</code>{" "}
          yet. Do not invent haircut EV from notes.
        </p>
      </div>
    );
  }

  const grade =
    String(chain.grade || fallbackGrade || "")
      .trim()
      .toUpperCase() || null;
  const gTone = gradeTone(grade);
  const haircut = haircutEvOf(chain);
  const displayEv = haircut ?? (chain.ev != null ? Number(chain.ev) : null);
  const pModel =
    chain.p_model != null && Number.isFinite(Number(chain.p_model))
      ? Number(chain.p_model)
      : null;
  const stake = stakeNokOf(chain);
  const unit = unitNokOf(chain);
  const signalChips = controlSignalChips(chain, activeSignals);
  const evLabel = haircut != null ? "EV" : chain.ev != null ? "EV (raw)" : "EV";

  const shell =
    emphasis === "primary"
      ? "border-primary/35 bg-primary/8"
      : emphasis === "quiet"
        ? "border-white/[0.06] bg-black/15"
        : cn(tone.border, tone.bg);

  return (
    <div className={cn("rounded-xl border px-3 py-2.5 space-y-2", shell, className)}>
      {complete.status === "partial" && complete.banner ? (
        <div className="rounded-md border border-pending/35 bg-pending/10 px-2 py-1 text-[11px] text-pending font-medium">
          {complete.banner}
        </div>
      ) : null}

      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-black/30",
            tone.dot
          )}
          title={trafficLightLabel(light)}
          aria-label={`Traffic light: ${trafficLightLabel(light)}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                tone.text
              )}
            >
              {trafficLightLabel(light)}
            </span>
            {chain.kind && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {String(chain.kind)}
              </span>
            )}
            {grade && (
              <span
                className={cn(
                  "rounded border px-1.5 py-0 text-[10px] font-semibold",
                  gTone.text,
                  gTone.border,
                  gTone.bg
                )}
              >
                Grade {grade}
              </span>
            )}
          </div>
          <p
            className={cn(
              "mt-1 text-[13px] font-medium leading-snug text-foreground",
              compact && "line-clamp-2"
            )}
          >
            {summary}
          </p>
        </div>
      </div>

      {(why || whyNot) && (
        <div className="pl-5 space-y-1 text-[12px] leading-relaxed text-muted-foreground">
          {why ? (
            <p>
              <span className="font-semibold text-foreground/90">Why this: </span>
              {why}
            </p>
          ) : null}
          {whyNot ? (
            <p>
              <span className="font-semibold text-foreground/90">Why not: </span>
              {whyNot}
            </p>
          ) : null}
        </div>
      )}

      <div className="pl-5 flex flex-wrap gap-1.5">
        <MetricChip
          label={evLabel}
          value={
            displayEv != null
              ? `${displayEv >= 0 ? "+" : ""}${fmtPct(displayEv)}`
              : "—"
          }
          className={evTone(displayEv)}
        />
        <MetricChip label="p" value={pModel != null ? fmtPct(pModel, 0) : "—"} />
        <MetricChip
          label="Stake"
          value={stake != null ? formatNokPlain(stake) : "—"}
        />
        <MetricChip
          label="Unit"
          value={unit != null ? formatNokPlain(unit) : "—"}
        />
        {signalChips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          >
            {chip}
          </span>
        ))}
      </div>

      {simpleMode ? (
        <div className="pl-5">
          <button
            type="button"
            onClick={() => setOpenFull((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary min-h-[28px]"
          >
            {openFull ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {openFull ? "Hide full chain" : "Full reasoning chain"}
          </button>
          {openFull && (
            <div className="mt-2">
              <ReasoningChainView chain={chain} activeSignals={activeSignals} />
            </div>
          )}
        </div>
      ) : (
        <ReasoningChainView chain={chain} activeSignals={activeSignals} />
      )}
    </div>
  );
}
