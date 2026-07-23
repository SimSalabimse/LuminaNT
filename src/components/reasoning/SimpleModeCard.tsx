/**
 * Simple Mode chrome — one sentence + traffic light + Why this / Why not.
 * Expand → full ReasoningChainView (progressive disclosure).
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReasoningChain } from "@/types";
import {
  simpleModeSummary,
  trafficLightFromChain,
  trafficLightLabel,
  trafficLightTone,
  whyNotText,
  whyThisText,
} from "@/lib/resolveReasoningChain";
import { cn } from "@/lib/utils";
import { ReasoningChainView } from "@/components/reasoning/ReasoningChainView";

export function SimpleModeCard({
  chain,
  /** When false, always show full chain (settings.simpleMode off). */
  simpleMode = true,
  compact = false,
  className,
}: {
  chain: ReasoningChain | null | undefined;
  simpleMode?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [openWhy, setOpenWhy] = useState(false);
  const [openFull, setOpenFull] = useState(!simpleMode);
  const light = trafficLightFromChain(chain);
  const tone = trafficLightTone(light);
  const summary = simpleModeSummary(chain);
  const why = whyThisText(chain);
  const whyNot = whyNotText(chain);
  const hasWhy = Boolean(why || whyNot);

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

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 space-y-2",
        tone.border,
        tone.bg,
        className
      )}
    >
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

      {hasWhy && (
        <div className="pl-5">
          <button
            type="button"
            onClick={() => setOpenWhy((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary min-h-[28px]"
          >
            {openWhy ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Why this / Why not
          </button>
          {openWhy && (
            <div className="mt-1 space-y-1.5 border-t border-white/[0.06] pt-2 text-[12px] leading-relaxed text-muted-foreground">
              {why ? (
                <p>
                  <span className="font-semibold text-foreground/90">
                    Why this:{" "}
                  </span>
                  {why}
                </p>
              ) : null}
              {whyNot ? (
                <p>
                  <span className="font-semibold text-foreground/90">
                    Why not:{" "}
                  </span>
                  {whyNot}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

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
              <ReasoningChainView chain={chain} />
            </div>
          )}
        </div>
      ) : (
        <ReasoningChainView chain={chain} />
      )}
    </div>
  );
}
