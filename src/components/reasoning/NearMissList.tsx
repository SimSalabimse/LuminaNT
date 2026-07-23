/**
 * Collapsible Near-miss / Rejected list from reasoning_chains kinds.
 * Count badge always visible; defaultOpen when rows.length ≤ 8; quiet row chrome.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Ban } from "lucide-react";
import type { ReasoningChain } from "@/types";
import {
  listNearMissChains,
  simpleModeSummary,
  trafficLightFromChain,
  trafficLightTone,
} from "@/lib/resolveReasoningChain";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SimpleModeCard } from "@/components/reasoning/SimpleModeCard";

/** Live volume ~24 → collapsed + badge; small demo lists open by default. */
const DEFAULT_OPEN_MAX = 8;

export function NearMissList({
  chains,
  simpleMode = true,
  className,
}: {
  chains: ReasoningChain[] | null | undefined;
  simpleMode?: boolean;
  className?: string;
}) {
  const rows = useMemo(() => listNearMissChains(chains), [chains]);
  const [open, setOpen] = useState(() => rows.length > 0 && rows.length <= DEFAULT_OPEN_MAX);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-card/40 overflow-hidden",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] min-h-[44px]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold tracking-tight text-muted-foreground">
                Near-miss / Rejected
              </p>
              <Badge variant="secondary" className="h-5 px-1.5 font-mono tabular-nums text-[10px]">
                {rows.length}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Engine chains with kind near_miss or rejected_* · quieter than
              recommended
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-3 py-3 space-y-2">
          {rows.map((c, idx) => {
            const id =
              String(c.reasoning_chain_id || "") ||
              `${normKey(c.match)}|${normKey(c.selection)}|${idx}`;
            const light = trafficLightFromChain(c);
            const tone = trafficLightTone(light);
            const isExp = expandedId === id;
            return (
              <div
                key={id}
                className="rounded-xl border border-white/[0.05] bg-black/15 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExp ? null : id)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.02]"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full opacity-80",
                      tone.dot
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium truncate text-foreground/90">
                        {c.match || "(unknown match)"}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {String(c.kind || "near_miss")}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">
                      {c.selection || "—"} · {simpleModeSummary(c)}
                    </p>
                  </div>
                  {isExp ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  )}
                </button>
                {isExp && (
                  <div className="px-3 pb-3">
                    <SimpleModeCard
                      chain={c}
                      simpleMode={simpleMode}
                      emphasis="quiet"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normKey(s: string | null | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, 48);
}
