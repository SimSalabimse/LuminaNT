/**
 * D18 — Watch coverage_health.level + stale risk schema and fire opt-in OS toasts.
 * Mount once at app root. Pure transition logic lives in lib/osNotify.
 */
import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { deriveRiskStatus } from "@/lib/riskStatus";
import {
  evaluateOsNotifyTransitions,
  showOsNotification,
  type OsNotifyKind,
  type OsNotifyTrackedState,
} from "@/lib/osNotify";

export function useOsNotifications(): void {
  const snapshot = useDataStore((s) => s.snapshot);
  const demoMode = useAppStore((s) => s.settings.demoMode);
  const notifyCoverageCritical = useAppStore(
    (s) => s.settings.notifyCoverageCritical === true
  );
  const notifyStaleRisk = useAppStore(
    (s) => s.settings.notifyStaleRisk === true
  );

  const prevRef = useRef<OsNotifyTrackedState | null>(null);
  const lastFiredRef = useRef<Partial<Record<OsNotifyKind, number>>>({});
  // Reset baseline when leaving demo so we do not notify immediately on exit
  // for a condition that was already true under demo.
  const wasDemoRef = useRef(demoMode);

  useEffect(() => {
    if (demoMode) {
      wasDemoRef.current = true;
      // Keep tracked state in sync while silent so exit does not false-edge.
      if (snapshot) {
        const status = deriveRiskStatus(
          snapshot.risk,
          snapshot.bankroll,
          snapshot.phase
        );
        const level =
          snapshot.coverage_health &&
          typeof snapshot.coverage_health === "object"
            ? String(
                (snapshot.coverage_health as { level?: unknown }).level ?? ""
              )
            : "";
        const r = evaluateOsNotifyTransitions({
          demoMode: true,
          notifyCoverageCritical,
          notifyStaleRisk,
          coverageLevel: level,
          staleRiskSchema: status.staleRiskSchema,
          prev: prevRef.current,
          lastFiredAt: lastFiredRef.current,
        });
        prevRef.current = r.next;
        lastFiredRef.current = r.lastFiredAt;
      }
      return;
    }

    // Leaving demo → re-baseline (no fire for pre-existing critical/stale).
    if (wasDemoRef.current) {
      wasDemoRef.current = false;
      prevRef.current = null;
    }

    if (!snapshot) return;
    // Nothing enabled → still track so enabling later only fires on next edge.
    if (!notifyCoverageCritical && !notifyStaleRisk) {
      const status = deriveRiskStatus(
        snapshot.risk,
        snapshot.bankroll,
        snapshot.phase
      );
      const level =
        snapshot.coverage_health &&
        typeof snapshot.coverage_health === "object"
          ? String(
              (snapshot.coverage_health as { level?: unknown }).level ?? ""
            )
          : "";
      const r = evaluateOsNotifyTransitions({
        demoMode: false,
        notifyCoverageCritical: false,
        notifyStaleRisk: false,
        coverageLevel: level,
        staleRiskSchema: status.staleRiskSchema,
        prev: prevRef.current,
        lastFiredAt: lastFiredRef.current,
      });
      prevRef.current = r.next;
      lastFiredRef.current = r.lastFiredAt;
      return;
    }

    const status = deriveRiskStatus(
      snapshot.risk,
      snapshot.bankroll,
      snapshot.phase
    );
    const level =
      snapshot.coverage_health && typeof snapshot.coverage_health === "object"
        ? String((snapshot.coverage_health as { level?: unknown }).level ?? "")
        : "";

    const r = evaluateOsNotifyTransitions({
      demoMode: false,
      notifyCoverageCritical,
      notifyStaleRisk,
      coverageLevel: level,
      staleRiskSchema: status.staleRiskSchema,
      prev: prevRef.current,
      lastFiredAt: lastFiredRef.current,
    });
    prevRef.current = r.next;
    lastFiredRef.current = r.lastFiredAt;

    for (const kind of r.fire) {
      void showOsNotification(kind);
    }
  }, [snapshot, demoMode, notifyCoverageCritical, notifyStaleRisk]);
}
