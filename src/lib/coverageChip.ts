/**
 * Coverage Health chip model for DeskStrip + Shortlist (pill parity with Phase/Mode/Can Bet).
 * Missing coverage_health.json → loaded=false, value "—", calm tooltip. Never invent COV OK.
 */
import type { CoverageHealth } from "@/types";
import { isCoverageHealthLoaded } from "@/lib/emptySlip";

export type CoverageChipVariant = "success" | "warning" | "loss" | "secondary";

export type CoverageChipModel = {
  loaded: boolean;
  level: string;
  /** Short chip value: OK | WARN | CRIT | — */
  value: string;
  /** Full label for badge-style chips: "COV OK" | "COV —" */
  label: string;
  variant: CoverageChipVariant;
  title: string;
  /** Shell classes for DeskStrip-style chips */
  shell: string;
  valueClass: string;
};

function formatPct(v: unknown): string | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return `${(n * 100).toFixed(0)}%`;
  return `${n.toFixed(0)}%`;
}

/**
 * Shared Coverage chip model from snapshot.coverage_health.
 * Fail-closed when file absent — value "—", not NOT LOADED shouting.
 */
export function coverageChipModel(
  coverage: CoverageHealth | Record<string, unknown> | null | undefined
): CoverageChipModel {
  const loaded = isCoverageHealthLoaded(coverage);
  if (!loaded) {
    return {
      loaded: false,
      level: "—",
      value: "—",
      label: "COV —",
      variant: "secondary",
      title:
        "No coverage_health.json on snapshot — run board/recommend to write SSOT. Not a UI wiring bug.",
      shell: "border-white/10 bg-white/5",
      valueClass: "text-muted-foreground",
    };
  }

  const c = (coverage || {}) as CoverageHealth;
  const rawLevel = String(c.level ?? "")
    .trim()
    .toLowerCase();
  let level = rawLevel || "—";
  let value = "—";
  let label = "COV —";
  let variant: CoverageChipVariant = "secondary";
  let shell = "border-white/10 bg-white/5";
  let valueClass = "text-muted-foreground";

  if (rawLevel === "ok") {
    level = "ok";
    value = "OK";
    label = "COV OK";
    variant = "success";
    shell = "border-profit/35 bg-profit/10";
    valueClass = "text-profit";
  } else if (rawLevel === "warn" || rawLevel === "warning") {
    level = "warn";
    value = "WARN";
    label = "COV WARN";
    variant = "warning";
    shell = "border-pending/40 bg-pending/12";
    valueClass = "text-pending";
  } else if (rawLevel === "critical" || rawLevel === "crit") {
    level = "critical";
    value = "CRIT";
    label = "COV CRIT";
    variant = "loss";
    shell = "border-loss/40 bg-loss/12";
    valueClass = "text-loss";
  } else if (rawLevel) {
    value = rawLevel.slice(0, 6).toUpperCase();
    label = `COV ${value}`;
  }

  const tipParts: string[] = [`Coverage: ${label}`];
  const deep = formatPct(c.shortlist_deep_pct);
  if (deep) tipParts.push(`Deep ${deep}`);
  if (c.mid_unresearched_n != null && Number.isFinite(Number(c.mid_unresearched_n))) {
    tipParts.push(`Mid unresearched ${Number(c.mid_unresearched_n)}`);
  }
  if (c.updated_at) {
    tipParts.push(`Updated ${String(c.updated_at).slice(0, 19)}`);
  }
  if (c.force_coverage_active) tipParts.push("COV FORCE active");

  return {
    loaded: true,
    level,
    value,
    label,
    variant,
    title: tipParts.join(" · "),
    shell,
    valueClass,
  };
}
