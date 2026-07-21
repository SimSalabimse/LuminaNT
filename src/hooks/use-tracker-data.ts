import { useMemo } from "react";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { computeMetrics, filterBets } from "@/lib/analytics";
import type { Bet, DerivedMetrics } from "@/types";

/** Stable filtered bets — always applies global filters (forensic grain included). */
export function useFilteredBets(): Bet[] {
  const bets = useDataStore((s) => s.bets);
  const filters = useDataStore((s) => s.filters);
  return useMemo(() => filterBets(bets, filters), [bets, filters]);
}

/**
 * Scope-aware bets for Desk / shared metrics:
 * - full → entire ledger (ignores filters)
 * - filtered → respects global filters + forensic
 */
export function useScopeBets(): Bet[] {
  const bets = useDataStore((s) => s.bets);
  const filters = useDataStore((s) => s.filters);
  const filterScope = useAppStore((s) => s.filterScope);
  return useMemo(() => {
    if (filterScope === "full") return bets;
    return filterBets(bets, filters);
  }, [bets, filters, filterScope]);
}

/** Metrics from filtered bets (Analyze / forensic). */
export function useMetrics(): DerivedMetrics {
  const filtered = useFilteredBets();
  const baseline = useDataStore(
    (s) => Number(s.snapshot?.bankroll?.baseline_nok) || 500
  );
  return useMemo(() => computeMetrics(filtered, baseline), [filtered, baseline]);
}

/** Metrics respecting Full book vs Filtered toggle. */
export function useScopeMetrics(): DerivedMetrics {
  const scoped = useScopeBets();
  const baseline = useDataStore(
    (s) => Number(s.snapshot?.bankroll?.baseline_nok) || 500
  );
  return useMemo(() => computeMetrics(scoped, baseline), [scoped, baseline]);
}
