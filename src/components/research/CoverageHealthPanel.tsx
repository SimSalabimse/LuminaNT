/**
 * Coverage Health panel — deep% / surv% / mid unresearched / COV FORCE /
 * empty-slip classification from `coverage_health.json` only.
 *
 * Explicitly out of scope (PR8b): preferred_share / short_main_share bars.
 */
import { useMemo } from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import {
  classifyEmptySlip,
  emptySlipInputFromCoverage,
  isCoverageHealthLoaded,
  type EmptySlipKind,
} from "@/lib/emptySlip";
import type { CoverageHealth } from "@/types";
import { cn } from "@/lib/utils";

function asCoverage(
  raw: CoverageHealth | Record<string, unknown> | null | undefined
): CoverageHealth {
  if (raw == null || typeof raw !== "object") return {};
  return raw as CoverageHealth;
}

/** Format engine pct: accept 0–1 fraction or already-scaled 0–100. */
function formatPct(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 0 && n <= 1) return `${(n * 100).toFixed(0)}%`;
  return `${n.toFixed(0)}%`;
}

function formatCount(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return String(Math.trunc(n));
}

function levelBadgeVariant(
  level: string
): "success" | "warning" | "loss" | "secondary" {
  const l = level.toLowerCase();
  if (l === "ok") return "success";
  if (l === "warn") return "warning";
  if (l === "critical") return "loss";
  return "secondary";
}

function emptySlipTone(kind: EmptySlipKind): {
  variant: "success" | "warning" | "loss" | "secondary" | "outline";
  label: string;
} {
  switch (kind) {
    case "honest_no_edge":
      return { variant: "success", label: "Honest no-edge" };
    case "process_miss":
      return { variant: "loss", label: "Process miss" };
    case "process_miss_soft":
      return { variant: "warning", label: "Soft process miss" };
    case "no_research":
      return { variant: "loss", label: "No research" };
    case "coverage_unavailable":
      return { variant: "secondary", label: "Coverage unavailable" };
    case "has_picks":
      return { variant: "outline", label: "Has picks" };
    default:
      return { variant: "secondary", label: kind };
  }
}

export type CoverageHealthPanelProps = {
  /**
   * True when the shortlist / place board has no cards (empty slip).
   * Feeds empty-slip taxonomy via emptySlip.ts.
   */
  placeEmpty?: boolean;
  className?: string;
};

export function CoverageHealthPanel({
  placeEmpty = false,
  className,
}: CoverageHealthPanelProps) {
  const snapshot = useDataStore((s) => s.snapshot);
  const coverage = asCoverage(snapshot?.coverage_health);
  const loaded = isCoverageHealthLoaded(snapshot?.coverage_health);

  const emptySlip = useMemo(
    () =>
      classifyEmptySlip(
        emptySlipInputFromCoverage(placeEmpty, snapshot?.coverage_health)
      ),
    [placeEmpty, snapshot?.coverage_health]
  );

  const level = String(coverage.level ?? "").trim() || "—";
  const levelLower = level.toLowerCase();
  const covForce = Boolean(coverage.force_coverage_active);
  const forceSignal = coverage.force_coverage_signal;
  const reasons = Array.isArray(coverage.reasons)
    ? coverage.reasons.map(String).filter(Boolean)
    : [];
  const slipTone = emptySlipTone(emptySlip.kind);

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
            <Activity className="h-4 w-4 text-primary" />
            Coverage Health
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Engine SSOT · shortlist deep / survivable / mid unresearched
            {coverage.updated_at
              ? ` · updated ${String(coverage.updated_at).slice(0, 16)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loaded ? (
            <Badge
              variant={levelBadgeVariant(levelLower)}
              className="h-7 px-2.5 font-bold uppercase tracking-wide"
            >
              {level}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="h-7 px-2.5 font-semibold"
              title="No coverage_health.json on snapshot — fail-closed until board/recommend writes SSOT"
            >
              No signal
            </Badge>
          )}
          {covForce && (
            <Badge
              variant="warning"
              className="h-7 px-2.5 font-bold"
              title={
                forceSignal
                  ? [
                      forceSignal.target_odds_band
                        ? `band ${forceSignal.target_odds_band}`
                        : null,
                      forceSignal.min_deep_packs != null
                        ? `min deep ${forceSignal.min_deep_packs}`
                        : null,
                      forceSignal.expires_at
                        ? `expires ${forceSignal.expires_at}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "COV FORCE active"
                  : "COV FORCE active"
              }
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1 inline-block align-text-bottom" />
              COV FORCE
            </Badge>
          )}
          {Boolean(coverage.empty_slip_risk) && (
            <Badge variant="loss" className="h-7 px-2.5 font-bold">
              EMPTY-SLIP RISK
            </Badge>
          )}
          {Boolean(coverage.soft_gate) && (
            <Badge variant="outline" className="h-7 px-2.5 font-mono text-[10px]">
              soft_gate
            </Badge>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="px-5 py-6 text-sm text-muted-foreground leading-relaxed space-y-1.5">
          <p className="font-medium text-foreground/80">No signal</p>
          <p>
            No{" "}
            <span className="font-mono text-[12px]">
              coverage_health.json
            </span>{" "}
            on this snapshot. Fail-closed: do not treat an empty slip as success
            until board / research writes health. Chip shows{" "}
            <span className="font-mono">—</span> on Desk / Shortlist (expected
            until engine writes SSOT).
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04]">
            <Metric
              label="Deep %"
              value={formatPct(coverage.shortlist_deep_pct)}
              hint={
                coverage.shortlist_with_deep_n != null ||
                coverage.shortlist_n != null
                  ? `${formatCount(coverage.shortlist_with_deep_n)} / ${formatCount(coverage.shortlist_n)} deep on shortlist`
                  : "shortlist_deep_pct"
              }
              tone={
                levelLower === "critical"
                  ? "loss"
                  : levelLower === "warn"
                    ? "pending"
                    : undefined
              }
            />
            <Metric
              label="Surv %"
              value={formatPct(coverage.deep_survivable_pct)}
              hint={
                coverage.deep_survivable_n != null
                  ? `${formatCount(coverage.deep_survivable_n)} deep survivable`
                  : "deep_survivable_pct"
              }
            />
            <Metric
              label="Mid unresearched"
              value={formatCount(coverage.mid_unresearched_n)}
              hint="mid_unresearched_n"
              tone={
                Number(coverage.mid_unresearched_n) > 0 ? "pending" : undefined
              }
            />
            <Metric
              label="Deep packs"
              value={formatCount(coverage.shortlist_with_deep_n)}
              hint="shortlist_with_deep_n (empty-slip SSOT)"
            />
          </div>

          <div className="px-5 py-3 border-t border-white/[0.06] flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                  Empty-slip class
                </span>
                <Badge variant={slipTone.variant} className="h-6 px-2 text-[11px]">
                  {slipTone.label}
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {emptySlip.kind}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {emptySlip.title}
                {placeEmpty
                  ? ""
                  : " (board has cards — classification for empty gate only)"}
              </p>
              {placeEmpty && (
                <p className="text-[11px] text-muted-foreground/90 leading-relaxed">
                  {emptySlip.detail}
                </p>
              )}
            </div>
            {covForce && forceSignal && (
              <div className="rounded-xl border border-pending/25 bg-pending/5 px-3 py-2 text-[11px] space-y-0.5 min-w-[12rem]">
                <div className="font-semibold text-pending">Force signal</div>
                {forceSignal.target_odds_band && (
                  <div className="font-mono">
                    band {forceSignal.target_odds_band}
                  </div>
                )}
                {forceSignal.min_deep_packs != null && (
                  <div className="font-mono">
                    min deep {forceSignal.min_deep_packs}
                  </div>
                )}
                {Array.isArray(forceSignal.prefer) &&
                  forceSignal.prefer.length > 0 && (
                    <div className="font-mono">
                      prefer {forceSignal.prefer.join(", ")}
                    </div>
                  )}
                {forceSignal.expires_at && (
                  <div className="text-muted-foreground">
                    exp {String(forceSignal.expires_at).slice(0, 16)}
                  </div>
                )}
              </div>
            )}
          </div>

          {reasons.length > 0 && (
            <div className="px-5 py-2.5 border-t border-white/[0.06] bg-black/20">
              <ul className="space-y-1">
                {reasons.slice(0, 6).map((r, i) => (
                  <li
                    key={`${i}-${r.slice(0, 24)}`}
                    className="text-[11px] text-muted-foreground leading-snug font-mono"
                  >
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pending" | "loss" | "profit";
}) {
  return (
    <div className="bg-card px-4 py-3 text-center" title={hint}>
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold font-mono tabular-nums",
          tone === "pending" && "text-pending",
          tone === "loss" && "text-loss",
          tone === "profit" && "text-profit"
        )}
      >
        {value}
      </div>
    </div>
  );
}
