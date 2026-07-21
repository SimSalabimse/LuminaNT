import { useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, X, Filter, Table2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { useScopeBets } from "@/hooks/use-tracker-data";
import { uniqueValues } from "@/lib/parse-bets";
import { BetDetailModal } from "@/components/bets/BetDetailModal";
import { CaseFileContent } from "@/components/bets/CaseFileContent";
import type { Bet } from "@/types";
import {
  cn,
  formatNokPlain,
  isPending,
  plColor,
  resultBadgeClass,
  resultDisplayLabel,
  truncate,
} from "@/lib/utils";

function useWideLedger(minPx = 1440) {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= minPx : true
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`);
    const fn = () => setWide(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [minPx]);
  return wide;
}

function ChipMulti({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      {options.slice(0, 14).map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== o) : [...selected, o])
            }
            className={cn(
              "text-[11px] rounded-md border px-1.5 py-0.5 transition-colors",
              on
                ? "bg-primary/20 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {o || "(empty)"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Ledger workspace — full-height dual-pane blotter + Case File.
 * ≥1440px: side-by-side · narrower: Case File modal.
 */
export function BetsExplorer() {
  const allBets = useDataStore((s) => s.bets);
  const scoped = useScopeBets();
  const filterScope = useAppStore((s) => s.filterScope);
  const filters = useDataStore((s) => s.filters);
  const setFilters = useDataStore((s) => s.setFilters);
  const resetFilters = useDataStore((s) => s.resetFilters);
  const clearForensic = useDataStore((s) => s.clearForensic);
  const selectedBetId = useDataStore((s) => s.selectedBetId);
  const setSelectedBetId = useDataStore((s) => s.setSelectedBetId);
  const wide = useWideLedger(1440);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  // Collapse filters by default when forensic is active
  const forensicActive =
    (filters.betIds && filters.betIds.length > 0) ||
    (filters.forensicTrail && filters.forensicTrail.length > 0);
  const [showFilters, setShowFilters] = useState(!forensicActive);

  useEffect(() => {
    if (forensicActive) setShowFilters(false);
  }, [forensicActive]);

  const displayRows = useMemo(() => {
    const rows = [...scoped];
    const sort = sorting[0];
    const dir = sort?.desc ? -1 : 1;
    const col = sort?.id || "date";

    const cmpField = (a: Bet, b: Bet): number => {
      const av = a[col as keyof Bet];
      const bv = b[col as keyof Bet];
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return (
        String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * dir
      );
    };

    rows.sort((a, b) => {
      const pa = isPending(a.result) ? 0 : 1;
      const pb = isPending(b.result) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return cmpField(a, b);
    });
    return rows;
  }, [scoped, sorting]);

  const columns = useMemo<ColumnDef<Bet>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 96,
        cell: (c) => (
          <span className="font-mono text-xs">{c.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "match",
        header: "Match",
        size: 200,
        cell: (c) => (
          <span className="font-medium" title={c.getValue() as string}>
            {truncate(c.getValue() as string, 38)}
          </span>
        ),
      },
      {
        accessorKey: "selection",
        header: "Selection",
        size: 140,
        cell: (c) => truncate(c.getValue() as string, 26),
      },
      {
        accessorKey: "decimal_odds",
        header: "Odds",
        size: 60,
        cell: (c) => (
          <span className="tabular-nums font-mono text-xs">
            {Number(c.getValue()).toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: "stake_nok",
        header: "Stake",
        size: 60,
        cell: (c) => (
          <span className="tabular-nums text-xs">
            {formatNokPlain(c.getValue() as number, 0)}
          </span>
        ),
      },
      {
        accessorKey: "result",
        header: "Result",
        size: 76,
        cell: (c) => (
          <span
            className={cn(
              "text-[10px] border rounded px-1.5 py-0.5",
              resultBadgeClass(c.getValue() as string)
            )}
          >
            {resultDisplayLabel(c.getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "p_l_nok",
        header: "P/L",
        size: 68,
        cell: (c) => {
          const v = c.getValue() as number;
          return (
            <span className={cn("tabular-nums font-medium text-xs", plColor(v))}>
              {v > 0 ? "+" : ""}
              {v.toFixed(2)}
            </span>
          );
        },
      },
      {
        accessorKey: "phase",
        header: "Phase",
        size: 56,
        cell: (c) => (
          <span className="text-xs">{(c.getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "sport",
        header: "Sport",
        size: 72,
        cell: (c) => (
          <span className="text-xs">{(c.getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "research_grade",
        header: "Grade",
        size: 52,
        cell: (c) => (
          <span className="text-xs">{(c.getValue() as string) || "—"}</span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: displayRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  // Resolve selected bet from full ledger so Case File works if row still selected after filter change
  const selected =
    allBets.find((b) => b.bet_id === selectedBetId) ||
    scoped.find((b) => b.bet_id === selectedBetId) ||
    null;

  const resultOpts = uniqueValues(allBets, "result");
  const sportOpts = uniqueValues(allBets, "sport").map((s) => s || "(empty)");
  const phaseOpts = uniqueValues(allBets, "phase").map((s) => s || "(empty)");
  const gradeOpts = uniqueValues(allBets, "research_grade").map(
    (s) => s || "(empty)"
  );
  const bandOpts = uniqueValues(allBets, "odds_band").map((s) => s || "(empty)");
  const marketOpts = uniqueValues(allBets, "market_type").map(
    (s) => s || "(empty)"
  );

  const showDock = wide && !!selected;
  const showModal = !wide && !!selected;

  const selectRow = (id: string) => {
    setSelectedBetId(selectedBetId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-start justify-between gap-3 pb-3 px-0.5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center text-primary">
            <Table2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="page-title !text-xl md:!text-2xl">Ledger</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scoped.length} of {allBets.length} bets
              {filterScope === "filtered" ? (
                <span className="text-primary"> · filtered scope</span>
              ) : (
                <span> · full book</span>
              )}
              {" · "}
              <kbd className="kbd">/</kbd> search · click row for Case File
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>
          {forensicActive && (
            <Button size="sm" variant="default" onClick={clearForensic}>
              <X className="h-3.5 w-3.5" />
              Clear forensic
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        </div>
      </div>

      {/* Multi-hop forensic breadcrumb */}
      {forensicActive && (
        <div className="forensic-banner shrink-0 text-xs mb-3 flex flex-wrap items-center gap-1.5">
          <span className="font-semibold shrink-0">Trail</span>
          {(filters.forensicTrail || []).map((t, i) => (
            <span key={`${t.dim}-${t.value}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-primary/50 shrink-0" />
              )}
              <span className="rounded-md bg-primary/20 text-primary px-2 py-0.5 font-medium">
                {t.label}
              </span>
            </span>
          ))}
          {filters.betIds?.length > 0 && (
            <span className="text-primary/80 font-mono ml-1">
              {filters.betIds.length} bet_ids
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs ml-auto text-primary"
            onClick={clearForensic}
          >
            Esc · clear
          </Button>
        </div>
      )}

      {/* Search — P2 full-text: multi-token AND across ledger fields */}
      <div className="relative shrink-0 mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-shortcut="bets-search"
          className="pl-9 pr-16 font-mono text-sm h-10 rounded-xl bg-card/60"
          placeholder="Full-text: tokens AND · id:BET123 · match, notes, grade…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          title="Multi-token AND search across match, selection, notes, sport, market, grade, phase, source. Prefix id: for exact bet_id."
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className="kbd">/</kbd>
        </span>
      </div>
      {filters.search.trim().split(/\s+/).filter((t) => t.length >= 2).length >
        1 && (
        <p className="text-[10px] text-muted-foreground -mt-2 mb-2 font-mono">
          Full-text AND ·{" "}
          {filters.search
            .trim()
            .split(/\s+/)
            .filter((t) => t.length >= 2)
            .join(" ∩ ")}
        </p>
      )}

      {showFilters && (
        <div className="rounded-xl border border-white/[0.08] bg-card p-4 space-y-3 shrink-0 mb-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                From
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ dateFrom: e.target.value })}
                className="h-10 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                To
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ dateTo: e.target.value })}
                className="h-10 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Odds min
              </label>
              <Input
                type="number"
                step="0.01"
                value={filters.oddsMin}
                onChange={(e) => setFilters({ oddsMin: e.target.value })}
                className="h-10 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Odds max
              </label>
              <Input
                type="number"
                step="0.01"
                value={filters.oddsMax}
                onChange={(e) => setFilters({ oddsMax: e.target.value })}
                className="h-10 text-sm font-mono"
              />
            </div>
          </div>
          <ChipMulti
            label="Result"
            options={resultOpts}
            selected={filters.results}
            onChange={(results) => setFilters({ results })}
          />
          <ChipMulti
            label="Phase"
            options={phaseOpts}
            selected={filters.phases}
            onChange={(phases) => setFilters({ phases })}
          />
          <ChipMulti
            label="Sport"
            options={sportOpts}
            selected={filters.sports}
            onChange={(sports) => setFilters({ sports })}
          />
          <ChipMulti
            label="Grade"
            options={gradeOpts}
            selected={filters.grades}
            onChange={(grades) => setFilters({ grades })}
          />
          <ChipMulti
            label="Band"
            options={bandOpts}
            selected={filters.oddsBands}
            onChange={(oddsBands) => setFilters({ oddsBands })}
          />
          <ChipMulti
            label="Market"
            options={marketOpts}
            selected={filters.marketTypes}
            onChange={(marketTypes) => setFilters({ marketTypes })}
          />
        </div>
      )}

      {/* Dual pane work surface */}
      <div
        className={cn(
          "flex-1 min-h-0 flex gap-3",
          showDock ? "flex-row" : "flex-col"
        )}
      >
        {/* Blotter */}
        <div
          className={cn(
            "glass rounded-2xl flex flex-col overflow-hidden holo-border min-h-0",
            showDock ? "flex-[1.15] min-w-0" : "flex-1"
          )}
        >
          <div className="overflow-x-auto border-b border-white/[0.06] shrink-0">
            <div className="min-w-[900px]">
              <div className="flex bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className="px-2 py-2 text-left font-medium hover:text-foreground shrink-0"
                      style={{ width: h.getSize() }}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[h.column.getIsSorted() as string] ?? null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
            <div
              className="min-w-[900px] relative"
              style={{ height: Math.max(virtualizer.getTotalSize(), 1) }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index];
                const active = selectedBetId === row.original.bet_id;
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "absolute left-0 w-full flex items-center border-b border-white/[0.04] text-sm cursor-pointer hover:bg-primary/5 transition-colors",
                      active && "bg-primary/12 ring-1 ring-inset ring-primary/25"
                    )}
                    style={{
                      height: vi.size,
                      transform: `translateY(${vi.start}px)`,
                    }}
                    onClick={() => selectRow(row.original.bet_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectRow(row.original.bet_id);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        className="px-2 py-1 truncate shrink-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {rows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No bets match filters.
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-white/[0.06] text-xs text-muted-foreground flex items-center gap-2 shrink-0">
            <Badge variant="secondary">{scoped.length} rows</Badge>
            <span>
              Pending on top ·{" "}
              {wide
                ? "Case File docks on the right"
                : "Case File opens as modal"}
            </span>
          </div>
        </div>

        {/* Case File dock ≥1440 */}
        {showDock && selected && (
          <div className="flex-[0.95] min-w-[340px] max-w-[480px] glass rounded-2xl holo-border flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06]">
              <div className="section-label !tracking-[0.12em]">Case File</div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setSelectedBetId(null)}
              >
                <X className="h-3.5 w-3.5" />
                Close
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <CaseFileContent bet={selected} />
            </div>
          </div>
        )}
      </div>

      {/* Modal fallback <1440 */}
      <BetDetailModal
        bet={selected}
        open={showModal}
        onOpenChange={(o) => !o && setSelectedBetId(null)}
      />
    </div>
  );
}
