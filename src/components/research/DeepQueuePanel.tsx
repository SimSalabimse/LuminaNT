/**
 * Deep queue composition bars — preferred ≥55% / short-main ≤25%.
 * SSOT: `data/state/deep_queue.json` via snapshot.deep_queue only.
 * Never invent shares; null-safe when file missing or empty.
 * HV v3: surface clearability_score + track when engine writes them (optional).
 */
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import type {
  DeepQueueComposition,
  DeepQueueLine,
  DeepQueueState,
} from "@/types";
import { cn } from "@/lib/utils";

/** Engine floors/caps (display targets only — shares still come from JSON). */
const PREFERRED_FLOOR = 0.55;
const SHORT_MAIN_CAP = 0.25;

function asDeepQueue(
  raw: DeepQueueState | Record<string, unknown> | null | undefined
): DeepQueueState {
  if (raw == null || typeof raw !== "object") return {};
  return raw as DeepQueueState;
}

/**
 * True when snapshot carries a real deep_queue payload (not missing-file `{}`).
 * Require at least one share field or a composition object / queue array.
 */
export function isDeepQueueLoaded(
  raw: DeepQueueState | Record<string, unknown> | null | undefined
): boolean {
  if (raw == null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (Object.keys(o).length === 0) return false;
  if (typeof o.preferred_share === "number" && Number.isFinite(o.preferred_share))
    return true;
  if (
    typeof o.short_main_share === "number" &&
    Number.isFinite(o.short_main_share)
  )
    return true;
  if (
    o.deep_queue_composition != null &&
    typeof o.deep_queue_composition === "object"
  )
    return true;
  if (Array.isArray(o.deep_queue)) return true;
  return false;
}

/** Resolve share 0–1 from top-level or composition; null if absent. */
function resolveShare(
  top: unknown,
  composition: DeepQueueComposition | undefined,
  key: "preferred_share" | "short_main_share"
): number | null {
  if (typeof top === "number" && Number.isFinite(top)) return top;
  const fromComp = composition?.[key];
  if (typeof fromComp === "number" && Number.isFinite(fromComp)) return fromComp;
  return null;
}

function formatSharePct(share: number | null): string {
  if (share == null) return "—";
  // Accept 0–1 fraction; if engine ever sends 0–100, scale down.
  const n = share > 1 && share <= 100 ? share / 100 : share;
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

function shareToBarWidth(share: number | null): number {
  if (share == null || !Number.isFinite(share)) return 0;
  const n = share > 1 && share <= 100 ? share / 100 : share;
  return Math.max(0, Math.min(100, n * 100));
}

function formatClearability(v: unknown): string | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1);
}

export type DeepQueuePanelProps = {
  className?: string;
  /** Show optional queue line list under the bars (engine lines only). */
  showLines?: boolean;
};

export function DeepQueuePanel({
  className,
  showLines = true,
}: DeepQueuePanelProps) {
  const snapshot = useDataStore((s) => s.snapshot);
  const dq = asDeepQueue(snapshot?.deep_queue);
  const loaded = isDeepQueueLoaded(snapshot?.deep_queue);

  const composition =
    dq.deep_queue_composition != null &&
    typeof dq.deep_queue_composition === "object"
      ? (dq.deep_queue_composition as DeepQueueComposition)
      : undefined;

  const preferredShare = resolveShare(
    dq.preferred_share,
    composition,
    "preferred_share"
  );
  const shortMainShare = resolveShare(
    dq.short_main_share,
    composition,
    "short_main_share"
  );

  const meetsPreferred =
    composition?.meets_preferred_floor != null
      ? Boolean(composition.meets_preferred_floor)
      : preferredShare != null
        ? preferredShare + 1e-9 >= PREFERRED_FLOOR
        : null;
  const meetsShortMain =
    composition?.meets_short_main_cap != null
      ? Boolean(composition.meets_short_main_cap)
      : shortMainShare != null
        ? shortMainShare <= SHORT_MAIN_CAP + 1e-9
        : null;

  const queue: DeepQueueLine[] = Array.isArray(dq.deep_queue)
    ? (dq.deep_queue as DeepQueueLine[])
    : [];
  const n =
    typeof composition?.n === "number"
      ? composition.n
      : queue.length > 0
        ? queue.length
        : null;
  const anyScores = queue.some(
    (line) =>
      formatClearability(line.clearability_score) != null ||
      (line.track != null && String(line.track).trim() !== "")
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-card overflow-hidden",
        className
      )}
    >
      <div className="px-5 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 tracking-tight">
            <Layers className="h-4 w-4 text-primary" />
            Deep queue composition
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Engine SSOT · preferred ≥55% · short-main ≤25%
            {dq.updated_at
              ? ` · updated ${String(dq.updated_at).slice(0, 16)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loaded ? (
            <>
              {n != null && (
                <Badge variant="secondary" className="h-7 px-2.5 font-mono">
                  n={n}
                </Badge>
              )}
              {meetsPreferred != null && (
                <Badge
                  variant={meetsPreferred ? "success" : "warning"}
                  className="h-7 px-2.5 font-bold"
                >
                  PREF {meetsPreferred ? "OK" : "LOW"}
                </Badge>
              )}
              {meetsShortMain != null && (
                <Badge
                  variant={meetsShortMain ? "success" : "warning"}
                  className="h-7 px-2.5 font-bold"
                >
                  SM {meetsShortMain ? "OK" : "HIGH"}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="secondary" className="h-7 px-2.5 font-bold">
              NOT LOADED
            </Badge>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="px-5 py-6 text-sm text-muted-foreground leading-relaxed">
          No deep queue composition on this snapshot (
          <span className="font-mono text-[12px]">
            data/state/deep_queue.json
          </span>
          ). Bars stay empty until board / light research writes the file —
          composition is never invented client-side.
        </div>
      ) : (
        <>
          <div className="px-5 py-4 space-y-4">
            <CompositionBar
              label="Preferred"
              targetLabel="≥55%"
              share={preferredShare}
              target={PREFERRED_FLOOR}
              mode="floor"
              meets={meetsPreferred}
              counts={
                composition?.preferred_n != null && composition?.n != null
                  ? `${composition.preferred_n} / ${composition.n}`
                  : undefined
              }
            />
            <CompositionBar
              label="Short-main"
              targetLabel="≤25%"
              share={shortMainShare}
              target={SHORT_MAIN_CAP}
              mode="cap"
              meets={meetsShortMain}
              counts={
                composition?.short_main_n != null && composition?.n != null
                  ? `${composition.short_main_n} / ${composition.n}`
                  : undefined
              }
            />
          </div>

          {showLines && queue.length > 0 && (
            <div className="border-t border-white/[0.06] bg-black/20">
              <div className="px-5 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                Queue lines
              </div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-white/[0.04]">
                {queue.slice(0, 12).map((line, i) => {
                  const cl = formatClearability(line.clearability_score);
                  const track =
                    line.track != null && String(line.track).trim() !== ""
                      ? String(line.track).trim()
                      : null;
                  return (
                    <li
                      key={`${i}-${String(line.match ?? "").slice(0, 24)}`}
                      className="px-5 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]"
                    >
                      <span className="font-medium min-w-0 flex-1 line-clamp-1">
                        {String(line.match || "—")}
                      </span>
                      <span className="text-muted-foreground font-mono tabular-nums shrink-0">
                        {line.decimal_odds != null &&
                        Number.isFinite(Number(line.decimal_odds))
                          ? Number(line.decimal_odds).toFixed(2)
                          : "—"}
                      </span>
                      {anyScores && cl != null && (
                        <span
                          className="font-mono tabular-nums text-[11px] text-primary/90 shrink-0"
                          title="clearability_score (engine)"
                        >
                          cl {cl}
                        </span>
                      )}
                      <span className="flex gap-1 shrink-0">
                        {track ? (
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 text-[10px] font-mono"
                            title="queue track (engine)"
                          >
                            {track}
                          </Badge>
                        ) : null}
                        {line.preferred ? (
                          <Badge
                            variant="success"
                            className="h-5 px-1.5 text-[10px]"
                          >
                            pref
                          </Badge>
                        ) : null}
                        {line.short_main ? (
                          <Badge
                            variant="warning"
                            className="h-5 px-1.5 text-[10px]"
                          >
                            sm
                          </Badge>
                        ) : null}
                        {line.inject ? (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 text-[10px]"
                          >
                            inj
                          </Badge>
                        ) : null}
                      </span>
                      <span className="w-full text-[11px] text-muted-foreground line-clamp-1 font-mono">
                        {String(line.selection || "")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {queue.length > 12 && (
                <div className="px-5 py-1.5 text-[11px] text-muted-foreground border-t border-white/[0.04]">
                  +{queue.length - 12} more lines in snapshot
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CompositionBar({
  label,
  targetLabel,
  share,
  target,
  mode,
  meets,
  counts,
}: {
  label: string;
  targetLabel: string;
  share: number | null;
  target: number;
  mode: "floor" | "cap";
  meets: boolean | null;
  counts?: string;
}) {
  const width = shareToBarWidth(share);
  const targetPct = target * 100;
  const tone =
    meets == null ? undefined : meets ? ("profit" as const) : ("pending" as const);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            {label}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            target {targetLabel}
          </span>
          {counts && (
            <span className="text-[11px] text-muted-foreground font-mono">
              · {counts}
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-sm font-semibold font-mono tabular-nums",
            tone === "profit" && "text-profit",
            tone === "pending" && "text-pending"
          )}
        >
          {formatSharePct(share)}
        </span>
      </div>
      <div
        className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden"
        title={
          share == null
            ? `${label}: no share on snapshot`
            : `${label} ${formatSharePct(share)} · ${mode} ${targetLabel}`
        }
      >
        {/* Threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/35 z-[1]"
          style={{ left: `${targetPct}%` }}
          aria-hidden
        />
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            meets === true && "bg-profit/80",
            meets === false && "bg-pending/80",
            meets == null && "bg-primary/50"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
