import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNok(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} NOK`;
}

export function formatNokPlain(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("nb-NO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

export function formatPctPoints(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function truncate(s: string, len = 80): string {
  if (!s) return "";
  if (s.length <= len) return s;
  return `${s.slice(0, len - 1)}…`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function plColor(n: number): string {
  if (n > 0) return "text-profit";
  if (n < 0) return "text-loss";
  return "text-muted-foreground";
}

/** Canonical engine open-risk states (count against daily risk). */
export const OPEN_RISK_RESULTS = new Set(["pending", "confirmedplaced"]);

/** Performance sample (phase / ROI) — excludes Abandoned. */
export const PERFORMANCE_SETTLED_RESULTS = new Set([
  "win",
  "loss",
  "refunded",
  "void",
  "push",
]);

export function normalizeResultKey(result: string): string {
  return (result || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function resultBadgeClass(result: string): string {
  const r = normalizeResultKey(result);
  if (r === "win") return "bg-profit/15 text-profit border-profit/30";
  if (r === "loss") return "bg-loss/15 text-loss border-loss/30";
  if (r === "pending") return "bg-pending/15 text-pending border-pending/30";
  if (r === "confirmedplaced")
    return "bg-pending/20 text-pending border-pending/45 ring-1 ring-pending/20";
  if (r === "refunded" || r === "void" || r === "push")
    return "bg-violet/15 text-violet border-violet/30";
  if (r === "abandoned")
    return "bg-muted/80 text-muted-foreground border-border line-through decoration-muted-foreground/40";
  return "bg-muted text-muted-foreground border-border";
}

/** True for Win/Loss/Refunded/Void/Push — performance sample, not Abandoned. */
export function isSettled(result: string): boolean {
  return PERFORMANCE_SETTLED_RESULTS.has(normalizeResultKey(result));
}

export function isWin(result: string): boolean {
  return normalizeResultKey(result) === "win";
}

export function isLoss(result: string): boolean {
  return normalizeResultKey(result) === "loss";
}

/**
 * Open risk (engine OPEN_RISK_RESULTS): Pending intent OR ConfirmedPlaced live on NT.
 * Use for blotter, open-risk filters, and liability display.
 */
export function isPending(result: string): boolean {
  return OPEN_RISK_RESULTS.has(normalizeResultKey(result));
}

/** Alias for clarity in new call sites. */
export function isOpenRisk(result: string): boolean {
  return isPending(result);
}

export function isAbandoned(result: string): boolean {
  return normalizeResultKey(result) === "abandoned";
}

export function isConfirmedPlaced(result: string): boolean {
  return normalizeResultKey(result) === "confirmedplaced";
}

/** Human-readable short label for dense tables. */
export function resultDisplayLabel(result: string): string {
  const raw = (result || "").trim();
  if (!raw) return "—";
  const r = normalizeResultKey(raw);
  if (r === "confirmedplaced") return "Confirmed";
  if (r === "abandoned") return "Abandoned";
  if (r === "refunded") return "Refunded";
  return raw;
}

/**
 * Settlement calendar day in Europe/Oslo (engine risk kill-switch convention).
 * Prefers `updated_at` (UTC ISO); falls back to match `date`.
 */
export function settlementCalendarDay(
  row: { updated_at?: string; date?: string; created_at?: string },
  tz = "Europe/Oslo"
): string {
  const ua = (row.updated_at || "").trim();
  if (ua) {
    try {
      const raw = ua.includes("T") ? ua : ua.replace(" ", "T");
      const dt = new Date(raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`);
      if (!Number.isNaN(dt.getTime())) {
        // en-CA → YYYY-MM-DD
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(dt);
      }
    } catch {
      /* fall through */
    }
  }
  const d = (row.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const ca = (row.created_at || "").trim();
  if (ca) {
    try {
      const dt = new Date(ca);
      if (!Number.isNaN(dt.getTime())) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(dt);
      }
    } catch {
      /* ignore */
    }
  }
  return d.slice(0, 10) || "";
}

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}
