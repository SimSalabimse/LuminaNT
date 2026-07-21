/**
 * Odds workspace — NT Oddsen collection overview (separate from ledger bets).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronRight,
  Clock,
  Filter,
  FlaskConical,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import {
  filterOddsLines,
  formatKickoffDisplay,
  sortOddsLines,
  uniqueOddsField,
} from "@/lib/odds";
import type { OddsLine, OddsTimeWindow } from "@/types";
import { cn, formatPctPoints, truncate } from "@/lib/utils";

const TIME_WINDOWS: { id: OddsTimeWindow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "next_3h", label: "Next 3h" },
  { id: "today", label: "Today" },
  { id: "today_tomorrow", label: "Today + tomorrow" },
  { id: "tomorrow", label: "Tomorrow" },
];

function ChipMulti({
  label,
  options,
  selected,
  onChange,
  max = 16,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      {options.slice(0, max).map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== o) : [...selected, o])
            }
            className={cn(
              "text-[11px] rounded-md border px-1.5 py-0.5 transition-colors max-w-[160px] truncate",
              on
                ? "bg-primary/20 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
            title={o}
          >
            {o || "(empty)"}
          </button>
        );
      })}
      {options.length > max && (
        <span className="text-[10px] text-muted-foreground">
          +{options.length - max}
        </span>
      )}
    </div>
  );
}

function SortTh({
  id,
  label,
  sorting,
  onSort,
  className,
}: {
  id: string;
  label: string;
  sorting: { id: string; desc: boolean };
  onSort: (id: string) => void;
  className?: string;
}) {
  const active = sorting.id === id;
  return (
    <button
      type="button"
      onClick={() => onSort(id)}
      className={cn(
        "text-left text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors",
        active && "text-primary",
        className
      )}
    >
      {label}
      {active ? (sorting.desc ? " ↓" : " ↑") : ""}
    </button>
  );
}

function OddsDetailPanel({
  line,
  siblings,
  onClose,
  onSend,
  onSelectSibling,
}: {
  line: OddsLine;
  siblings: OddsLine[];
  onClose: () => void;
  onSend: () => void;
  onSelectSibling: (id: string) => void;
}) {
  return (
    <div className="glass-strong rounded-2xl border border-white/[0.08] h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 p-4 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Match detail
          </div>
          <h2 className="text-base font-semibold leading-snug truncate">
            {line.match}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {line.sport}
            {line.league ? ` · ${line.league}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/[0.06]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-black/25 border border-white/[0.05] p-3">
            <div className="text-[10px] uppercase text-muted-foreground">
              Kick-off
            </div>
            <div className="font-mono mt-0.5">
              {line.kickoff_iso || line.kickoff || "—"}
            </div>
          </div>
          <div className="rounded-xl bg-black/25 border border-white/[0.05] p-3">
            <div className="text-[10px] uppercase text-muted-foreground">
              Event id
            </div>
            <div className="font-mono text-xs mt-0.5 truncate">
              {line.event_id}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/25 bg-primary/[0.07] p-3">
          <div className="text-[10px] uppercase tracking-wider text-primary/80">
            Selected line
          </div>
          <div className="font-medium mt-1">{line.selection_label}</div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-2xl font-semibold tabular-nums text-primary">
              {line.decimal_odds.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">
              implied {formatPctPoints(line.implied_prob * 100, 1)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Market: {line.market || "—"}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Other markets · same match ({siblings.length})
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {siblings.map((s) => {
              const active = s.id === line.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSibling(s.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 text-left text-xs rounded-lg px-2.5 py-1.5 border transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate">{s.selection_label}</span>
                  <span className="font-mono tabular-nums shrink-0">
                    {s.decimal_odds.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/[0.06] flex flex-col gap-2">
        <Button className="w-full gap-2" onClick={onSend}>
          <FlaskConical className="h-4 w-4" />
          Send to Research
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">
          Adds to shortlist · opens Evidence workspace
        </p>
      </div>
    </div>
  );
}

export function Odds() {
  const odds = useDataStore((s) => s.odds);
  const filters = useDataStore((s) => s.oddsFilters);
  const setFilters = useDataStore((s) => s.setOddsFilters);
  const resetFilters = useDataStore((s) => s.resetOddsFilters);
  const selectedId = useDataStore((s) => s.selectedOddsLineId);
  const setSelectedId = useDataStore((s) => s.setSelectedOddsLineId);
  const collectOdds = useDataStore((s) => s.collectOdds);
  const collecting = useDataStore((s) => s.oddsCollecting);
  const refresh = useDataStore((s) => s.refresh);
  const refreshing = useDataStore((s) => s.refreshing);
  const shortlist = useDataStore((s) => s.researchShortlist);
  const addToShortlist = useDataStore((s) => s.addToResearchShortlist);
  const snapshot = useDataStore((s) => s.snapshot);

  const [showFilters, setShowFilters] = useState(true);
  const [sorting, setSorting] = useState({ id: "kickoff", desc: false });
  const parentRef = useRef<HTMLDivElement>(null);

  const sports = useMemo(
    () => uniqueOddsField(odds.lines, "sport"),
    [odds.lines]
  );
  const leagues = useMemo(
    () => uniqueOddsField(odds.lines, "league"),
    [odds.lines]
  );

  const rows = useMemo(() => {
    const filtered = filterOddsLines(odds.lines, filters);
    return sortOddsLines(filtered, sorting.id, sorting.desc);
  }, [odds.lines, filters, sorting]);

  const selected = useMemo(
    () => odds.lines.find((l) => l.id === selectedId) || null,
    [odds.lines, selectedId]
  );

  const siblings = useMemo(() => {
    if (!selected) return [];
    return odds.lines
      .filter((l) => l.event_id === selected.event_id)
      .sort((a, b) => a.decimal_odds - b.decimal_odds);
  }, [odds.lines, selected]);

  const nMatches = useMemo(() => {
    const set = new Set(rows.map((r) => r.event_id));
    return set.size;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 18,
  });

  useEffect(() => {
    // Prefer first row selected when opening empty selection with data
    if (!selectedId && rows.length && !selected) {
      /* leave unselected until click — cleaner scan */
    }
  }, [selectedId, rows.length, selected]);

  const onSort = (id: string) => {
    setSorting((s) =>
      s.id === id ? { id, desc: !s.desc } : { id, desc: id === "kickoff" ? false : true }
    );
  };

  const collectedLabel = odds.collected_at
    ? new Date(odds.collected_at).toLocaleString("nb-NO", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const hasFilters =
    filters.search ||
    filters.sports.length > 0 ||
    filters.leagues.length > 0 ||
    filters.timeWindow !== "all" ||
    filters.minOdds ||
    filters.maxOdds;

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="page-title">Odds</h1>
          <p className="page-subtitle flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {odds.n_events} matches · {odds.n_lines} lines
              {hasFilters && (
                <span className="text-primary">
                  {" "}
                  · showing {nMatches} / {rows.length} lines
                </span>
              )}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Updated {collectedLabel}
            </span>
            {odds.source && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-mono text-[11px] truncate max-w-[280px]" title={odds.source}>
                  {odds.source.split(/[/\\]/).slice(-2).join("/")}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {shortlist.length > 0 && (
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
              Shortlist {shortlist.length}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={refreshing || collecting}
            onClick={() => refresh({ runNtRefresh: false })}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Reload
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={collecting}
            onClick={() => collectOdds()}
          >
            {collecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Collect from NT
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass rounded-xl border border-white/[0.06] p-3 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                data-shortcut="odds-search"
                className="pl-8 h-8 text-sm"
                placeholder="Search match, selection, league…"
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Min odds
              </span>
              <Input
                className="h-8 w-16 text-sm font-mono"
                inputMode="decimal"
                placeholder="1.5"
                value={filters.minOdds}
                onChange={(e) => setFilters({ minOdds: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-muted-foreground">
                Max
              </span>
              <Input
                className="h-8 w-16 text-sm font-mono"
                inputMode="decimal"
                placeholder="5"
                value={filters.maxOdds}
                onChange={(e) => setFilters({ maxOdds: e.target.value })}
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => resetFilters()}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14">
              Time
            </span>
            {TIME_WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setFilters({ timeWindow: w.id })}
                className={cn(
                  "text-[11px] rounded-md border px-2 py-0.5 transition-colors",
                  filters.timeWindow === w.id
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          <ChipMulti
            label="Sport"
            options={sports}
            selected={filters.sports}
            onChange={(sports) => setFilters({ sports })}
          />
          <ChipMulti
            label="League"
            options={leagues}
            selected={filters.leagues}
            onChange={(leagues) => setFilters({ leagues })}
            max={12}
          />
        </div>
      )}

      {/* Table + detail */}
      <div
        className={cn(
          "flex-1 min-h-0 grid gap-3",
          selected ? "lg:grid-cols-[1fr_minmax(280px,360px)]" : "grid-cols-1"
        )}
      >
        <div className="glass rounded-2xl border border-white/[0.06] flex flex-col min-h-0 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[72px_minmax(100px,0.9fr)_minmax(140px,1.3fr)_minmax(140px,1.4fr)_56px_52px_28px] gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/20 shrink-0">
            <SortTh id="kickoff" label="Start" sorting={sorting} onSort={onSort} />
            <SortTh id="sport" label="Sport / league" sorting={sorting} onSort={onSort} />
            <SortTh id="match" label="Match" sorting={sorting} onSort={onSort} />
            <SortTh id="selection" label="Selection" sorting={sorting} onSort={onSort} />
            <SortTh id="odds" label="Odds" sorting={sorting} onSort={onSort} className="text-right" />
            <SortTh id="implied" label="Impl." sorting={sorting} onSort={onSort} className="text-right" />
            <span />
          </div>

          {rows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground max-w-sm">
                {odds.n_lines === 0
                  ? "No odds loaded. Collect from Norsk Tipping or connect a tracker folder with artifacts/odds_structured.json."
                  : "No lines match the current filters."}
              </p>
              {odds.n_lines === 0 && (
                <Button size="sm" disabled={collecting} onClick={() => collectOdds()}>
                  Collect from NT
                </Button>
              )}
              {!snapshot && (
                <p className="text-xs text-muted-foreground">
                  Connect the tracker repo in Settings first.
                </p>
              )}
            </div>
          ) : (
            <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto">
              <div
                style={{ height: virtualizer.getTotalSize(), position: "relative" }}
              >
                {virtualizer.getVirtualItems().map((vr) => {
                  const line = rows[vr.index];
                  const ko = formatKickoffDisplay(line);
                  const active = line.id === selectedId;
                  const onShortlist = shortlist.some((s) => s.id === line.id);
                  return (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => setSelectedId(line.id)}
                      className={cn(
                        "absolute left-0 w-full grid grid-cols-[72px_minmax(100px,0.9fr)_minmax(140px,1.3fr)_minmax(140px,1.4fr)_56px_52px_28px] gap-2 px-3 items-center text-left text-[13px] border-b border-white/[0.03] transition-colors",
                        active
                          ? "bg-primary/[0.12]"
                          : "hover:bg-white/[0.03]",
                        onShortlist && "ring-1 ring-inset ring-cyan-500/20"
                      )}
                      style={{
                        height: vr.size,
                        transform: `translateY(${vr.start}px)`,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-mono tabular-nums text-xs">
                          {ko.primary}
                        </div>
                        {ko.secondary && (
                          <div className="text-[10px] text-muted-foreground leading-none">
                            {ko.secondary}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-xs">
                          {line.sport}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {truncate(line.league, 36)}
                        </div>
                      </div>
                      <div className="truncate font-medium" title={line.match}>
                        {line.match}
                      </div>
                      <div
                        className="truncate text-muted-foreground"
                        title={line.selection_label}
                      >
                        {line.selection_label}
                      </div>
                      <div className="font-mono tabular-nums text-right font-semibold text-primary">
                        {line.decimal_odds.toFixed(2)}
                      </div>
                      <div className="font-mono tabular-nums text-right text-[11px] text-muted-foreground">
                        {(line.implied_prob * 100).toFixed(0)}%
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground/40 justify-self-end",
                          active && "text-primary"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selected && (
          <div className="min-h-0 hidden lg:block">
            <OddsDetailPanel
              line={selected}
              siblings={siblings}
              onClose={() => setSelectedId(null)}
              onSend={() => addToShortlist(selected)}
              onSelectSibling={(id) => setSelectedId(id)}
            />
          </div>
        )}
      </div>

      {/* Mobile detail modal-ish bar */}
      {selected && (
        <div className="lg:hidden shrink-0 glass-strong rounded-xl border border-white/[0.08] p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">
              {selected.match}
            </div>
            <div className="text-sm font-medium truncate">
              {selected.selection_label}{" "}
              <span className="text-primary font-mono">
                @{selected.decimal_odds.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            <Button size="sm" onClick={() => addToShortlist(selected)}>
              Research
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
