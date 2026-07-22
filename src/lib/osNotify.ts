/**
 * D18 — Opt-in OS notifications for COV CRITICAL / stale risk.
 *
 * Design:
 * - Default off (settings flags).
 * - Short OS toast only — no bet / selection details.
 * - Fire once per rising-edge transition (debounced cooldown to avoid flap).
 * - Demo mode: no-op.
 * - Transport: browser Notification API (WebView2 + desktop browser).
 *   tauri-plugin-notification is not wired; browser Notification is the
 *   supported path in Tauri webview and browser demo. See showOsNotification.
 */

export type OsNotifyKind = "coverage_critical" | "stale_risk";

export type OsNotifyTrackedState = {
  coverageCritical: boolean;
  staleRisk: boolean;
};

export type OsNotifyEvalInput = {
  demoMode: boolean;
  notifyCoverageCritical: boolean;
  notifyStaleRisk: boolean;
  coverageLevel: string | null | undefined;
  staleRiskSchema: boolean;
  /** Previous tracked flags; null = first observation (baseline only, no fire). */
  prev: OsNotifyTrackedState | null;
  /**
   * Last fire timestamps by kind (ms). Used for debounce / cooldown.
   * Missing key → never fired.
   */
  lastFiredAt?: Partial<Record<OsNotifyKind, number>>;
  /** Wall clock override for tests */
  nowMs?: number;
  /** Minimum ms between fires of the same kind (default 30s). */
  debounceMs?: number;
};

export type OsNotifyEvalResult = {
  /** Rising-edge transitions that should fire now */
  fire: OsNotifyKind[];
  /** State to store for next evaluation */
  next: OsNotifyTrackedState;
  /** Updated last-fired map (only keys that fire are bumped) */
  lastFiredAt: Partial<Record<OsNotifyKind, number>>;
};

export const OS_NOTIFY_DEBOUNCE_MS = 30_000;

export function isCoverageCriticalLevel(
  level: string | null | undefined
): boolean {
  return (
    String(level ?? "")
      .trim()
      .toLowerCase() === "critical"
  );
}

/**
 * Pure transition evaluator: rising edge only, skip first observation,
 * demo / disabled flags suppress fire, debounce same-kind spam.
 */
export function evaluateOsNotifyTransitions(
  input: OsNotifyEvalInput
): OsNotifyEvalResult {
  const now = input.nowMs ?? Date.now();
  const debounceMs = input.debounceMs ?? OS_NOTIFY_DEBOUNCE_MS;
  const lastFiredAt = { ...(input.lastFiredAt ?? {}) };

  const next: OsNotifyTrackedState = {
    coverageCritical: isCoverageCriticalLevel(input.coverageLevel),
    staleRisk: Boolean(input.staleRiskSchema),
  };

  // First observation: establish baseline only (no flood on load / reconnect).
  if (input.prev == null) {
    return { fire: [], next, lastFiredAt };
  }

  if (input.demoMode) {
    return { fire: [], next, lastFiredAt };
  }

  const fire: OsNotifyKind[] = [];

  const wantCoverage =
    input.notifyCoverageCritical &&
    next.coverageCritical &&
    !input.prev.coverageCritical;
  if (wantCoverage && canFire(lastFiredAt.coverage_critical, now, debounceMs)) {
    fire.push("coverage_critical");
    lastFiredAt.coverage_critical = now;
  }

  const wantStale =
    input.notifyStaleRisk && next.staleRisk && !input.prev.staleRisk;
  if (wantStale && canFire(lastFiredAt.stale_risk, now, debounceMs)) {
    fire.push("stale_risk");
    lastFiredAt.stale_risk = now;
  }

  return { fire, next, lastFiredAt };
}

function canFire(
  lastAt: number | undefined,
  now: number,
  debounceMs: number
): boolean {
  if (lastAt == null) return true;
  return now - lastAt >= debounceMs;
}

/** Short copy — no bet details (D18). */
export function osNotifyCopy(kind: OsNotifyKind): { title: string; body: string } {
  switch (kind) {
    case "coverage_critical":
      return {
        title: "LuminaNT — Coverage critical",
        body: "Research coverage is CRITICAL. Open the desk to review.",
      };
    case "stale_risk":
      return {
        title: "LuminaNT — Stale risk schema",
        body: "risk.json looks pre-package. Refresh / upgrade the engine.",
      };
  }
}

/**
 * Show a short OS notification via the browser Notification API.
 * Works in Chromium / WebView2 (Tauri) when permission is granted.
 * Returns false if unsupported, denied, or failed — never throws.
 *
 * Note: tauri-plugin-notification is not a dependency; this is the
 * intentional lightweight fallback for desktop webview + browser.
 */
export async function showOsNotification(kind: OsNotifyKind): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return false;

    const { title, body } = osNotifyCopy(kind);
    // tag stabilizes OS collapse of duplicates of the same kind
    new Notification(title, {
      body,
      tag: `luminant-${kind}`,
      // silent false so Windows toast is noticeable when backgrounded
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}

/** Request permission early (e.g. when user enables a toggle). */
export async function ensureNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    if (Notification.permission === "default") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}
