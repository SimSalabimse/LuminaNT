/**
 * Coverage Health panel — deep% / surv% / mid unresearched / COV FORCE /
 * empty-slip classification + HV v3 funnel chips from `coverage_health.json`.
 *
 * Explicitly out of scope for composition: preferred_share / short_main_share
 * bars (DeepQueuePanel / deep_queue.json).
 */
import { useMemo } from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import {
  classifyEmptySlip,
  emptySlipInputFromCoverage,
  funnelFromCoverage,
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
    case "clearability_miss":
      return { variant: "warning", label: "Clearability miss" };
    case "no_research":
      return { variant: "loss", label: "No research" };
    case "coverage_unavailable":
      return { variant: "secondary", label: "Coverage unavailable" };
    case "risk_block":
      return { variant: "loss", label: "Risk block" };
    case "has_picks":
      return { variant: "outline", label: "Has picks" };
    default:
      return { variant: "secondary", label: kind };
  }
}

function formatEv(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(3)}`;
}

function formatShare(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 0 && n <= 1) return `${(n * 100).toFixed(0)}%`;
  return `${n.toFixed(0)}%`;
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

  const funnel = useMemo(
    () => funnelFromCoverage(snapshot?.coverage_health),
    [snapshot?.coverage_health]
  );

  const level = String(coverage.level ?? "").trim() || "—";
  const levelLower = level.toLowerCase();
  const covForce = Boolean(coverage.force_coverage_active);
  const forceSignal = coverage.force_coverage_signal;
  const starvationKind = String(coverage.starvation_kind ?? "").trim();
  const reasons = Array.isArray(coverage.reasons)
    ? coverage.reasons.map(String).filter(Boolean)
    : [];
  const slipTone = emptySlipTone(emptySlip.kind);
  const hasFunnel =
    funnel != null &&
    (funnel.n_raw_ev_pass != null ||
      funnel.median_raw_ev != null ||
      funnel.clearable_track_share != null ||
      funnel.second_pass_ran != null);

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
            <Badge variant="secondary" className="h-7 px-2.5 font-bold">
              NOT LOADED
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
          {starvationKind && starvationKind !== "none" && (
            <Badge
              variant={
                starvationKind === "honest_no_edge"
                  ? "success"
                  : starvationKind === "clearability_miss"
                    ? "warning"
                    : "loss"
              }
              className="h-7 px-2.5 font-mono text-[10px]"
              title="Engine starvation_kind SSOT"
            >
              {starvationKind}
            </Badge>
          )}
          {Boolean(coverage.force_clearability_active) && (
            <Badge variant="warning" className="h-7 px-2.5 font-bold">
              CL FORCE
            </Badge>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="px-5 py-6 text-sm text-muted-foreground leading-relaxed">
          No Coverage Health signal on this snapshot (
          <span className="font-mono text-[12px]">
            data/state/coverage_health.json
          </span>
          ). Fail-closed: do not treat an empty slip as success until board /
          research writes health.
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

          {hasFunnel && funnel && (
            <div className="px-5 py-3 border-t border-white/[0.06] bg-black/15">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
                Funnel (engine)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <FunnelChip
                  label="n_raw_ev_pass"
                  value={formatCount(funnel.n_raw_ev_pass)}
                  tone={
                    funnel.n_raw_ev_pass != null && funnel.n_raw_ev_pass > 0
                      ? "profit"
                      : "pending"
                  }
                />
                <FunnelChip
                  label="median_raw_ev"
                  value={formatEv(funnel.median_raw_ev)}
                />
                <FunnelChip
                  label="clearable_track"
                  value={formatShare(funnel.clearable_track_share)}
                />
                <FunnelChip
                  label="second_pass"
                  value={
                    funnel.second_pass_ran == null
                      ? "—"
                      : funnel.second_pass_ran
                        ? funnel.second_pass_completed
                          ? "done"
                          : "ran"
                        : "no"
                  }
                  tone={
                    funnel.second_pass_ran
                      ? "profit"
                      : funnel.second_pass_ran === false
                        ? "pending"
                        : undefined
                  }
                />
              </div>
            </div>
          )}

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

function FunnelChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pending" | "profit";
}) {
  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-card/80 px-3 py-2 text-center"
      title={label}
    >
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold font-mono tabular-nums",
          tone === "pending" && "text-pending",
          tone === "profit" && "text-profit"
        )}
      >
        {value}
      </div>
    </div>
  );
}
