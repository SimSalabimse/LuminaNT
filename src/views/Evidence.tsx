import { useEffect, useMemo, useState } from "react";
import { FileJson, Lightbulb, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDataStore } from "@/stores/data-store";
import { readTextFile, isTauri } from "@/lib/tauri";
import { cn, formatNokPlain, plColor, resultBadgeClass, truncate } from "@/lib/utils";
import type { EdgeRecord } from "@/types";

export function Evidence() {
  return <EvidencePanel />;
}

/** Evidence body — also embedded in Research workspace */
export function EvidencePanel() {
  const snapshot = useDataStore((s) => s.snapshot);
  const bets = useDataStore((s) => s.bets);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const researchShortlist = useDataStore((s) => s.researchShortlist);
  const clearResearchShortlist = useDataStore((s) => s.clearResearchShortlist);
  const removeFromResearchShortlist = useDataStore(
    (s) => s.removeFromResearchShortlist
  );
  const edges = snapshot?.edges || [];
  const evidence = snapshot?.evidence || [];
  const evidenceLinks = snapshot?.evidence_links || [];
  const [q, setQ] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"evidence" | "edges">("evidence");

  const filteredEvidence = evidence.filter((f) =>
    f.name.toLowerCase().includes(q.toLowerCase())
  );

  const filteredEdges = edges.filter((e) => {
    const hay =
      `${e.match} ${e.selection} ${e.note || ""} ${e.bet_id || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  /** Bet ids linked to selected evidence pack path */
  const linkedBetIds = useMemo(() => {
    if (!selectedPath) return [] as string[];
    const base = selectedPath.split(/[/\\]/).pop() || selectedPath;
    const ids = new Set<string>();
    for (const l of evidenceLinks) {
      const p = String(l.evidence_path || "");
      if (
        p === selectedPath ||
        p.endsWith(base) ||
        p.includes(base.replace(/\.json$/i, ""))
      ) {
        if (l.bet_id) ids.add(String(l.bet_id));
      }
    }
    // Soft-match by match name in pack if no links
    if (ids.size === 0 && parsed?.match) {
      const m = String(parsed.match).toLowerCase();
      for (const b of bets) {
        if ((b.match || "").toLowerCase().includes(m.slice(0, 16)) || m.includes((b.match || "").toLowerCase().slice(0, 12))) {
          ids.add(b.bet_id);
        }
      }
    }
    return [...ids];
  }, [selectedPath, evidenceLinks, parsed, bets]);

  useEffect(() => {
    if (!selectedPath) {
      setContent("");
      setParsed(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let text = "";
        if (isTauri() && !selectedPath.startsWith("demo-data")) {
          text = await readTextFile(selectedPath);
        } else {
          const res = await fetch(`/${selectedPath.replace(/^\/+/, "")}`);
          text = res.ok ? await res.text() : "";
        }
        if (cancelled) return;
        setContent(text);
        try {
          setParsed(JSON.parse(text));
        } catch {
          setParsed(null);
        }
      } catch (e) {
        if (!cancelled) {
          setContent(String(e));
          setParsed(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  const openLinkedBets = () => {
    if (!linkedBetIds.length) return;
    drillForensic({
      dim: "evidence",
      value: selectedPath || "pack",
      label: `Evidence: ${(selectedPath || "").split(/[/\\]/).pop() || "pack"}`,
      betIds: linkedBetIds,
    });
  };

  const openEdge = (e: EdgeRecord) => {
    if (!e.bet_id) return;
    drillForensic({
      dim: "edge",
      value: String(e.bet_id),
      label: e.match || `Bet ${e.bet_id}`,
      betIds: [String(e.bet_id)],
    });
  };

  return (
    <div className="space-y-4 h-full min-h-0 flex flex-col">
      {researchShortlist.length > 0 && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.07] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-cyan-200 tracking-wide uppercase">
              From Odds · research queue ({researchShortlist.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => clearResearchShortlist()}
            >
              Clear
            </Button>
          </div>
          <ul className="space-y-1 max-h-28 overflow-y-auto">
            {researchShortlist.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate min-w-0">
                  <span className="text-muted-foreground">{line.sport}</span>
                  {" · "}
                  {line.match} — {line.selection_label}{" "}
                  <span className="font-mono text-primary">
                    @{line.decimal_odds.toFixed(2)}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-loss shrink-0"
                  onClick={() => removeFromResearchShortlist(line.id)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Write honest evidence packs for these lines, then run recommend from Ops.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Research packs ({evidence.length}) · lessons ({edges.length}) · open
            linked tickets in Ledger
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("evidence")}
            className={cn(
              "text-xs rounded-lg px-3 py-1.5 border",
              tab === "evidence"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            <FileJson className="inline h-3.5 w-3.5 mr-1" />
            Evidence
          </button>
          <button
            type="button"
            onClick={() => setTab("edges")}
            className={cn(
              "text-xs rounded-lg px-3 py-1.5 border",
              tab === "edges"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            <Lightbulb className="inline h-3.5 w-3.5 mr-1" />
            Edges
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={
            tab === "evidence" ? "Filter evidence files…" : "Search edges…"
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === "evidence" ? (
        <div className="grid lg:grid-cols-5 gap-3 flex-1 min-h-0">
          <div className="lg:col-span-2 glass rounded-xl overflow-hidden flex flex-col min-h-[360px] holo-border">
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                {filteredEvidence.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedPath(f.path)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                      selectedPath === f.path
                        ? "bg-primary/15 text-primary"
                        : "hover:bg-secondary/70 text-foreground"
                    )}
                  >
                    <div className="font-mono text-xs truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {(f.size / 1024).toFixed(1)} KB
                    </div>
                  </button>
                ))}
                {filteredEvidence.length === 0 && (
                  <p className="text-sm text-muted-foreground p-3">
                    No evidence files.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="lg:col-span-3 glass rounded-xl p-4 min-h-[360px] overflow-y-auto holo-border">
            {!selectedPath && (
              <p className="text-sm text-muted-foreground">
                Select a research pack to view structured evidence.
              </p>
            )}
            {parsed && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {String(parsed.match || selectedPath)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {String(parsed.selection || "")}
                    </p>
                    {parsed.p_model != null && (
                      <Badge className="mt-2" variant="secondary">
                        p_model {String(parsed.p_model)}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={!linkedBetIds.length}
                    onClick={openLinkedBets}
                    title={
                      linkedBetIds.length
                        ? `Open ${linkedBetIds.length} linked tickets`
                        : "No bet_ids linked to this pack"
                    }
                  >
                    Open in Ledger
                    {linkedBetIds.length > 0
                      ? ` (${linkedBetIds.length})`
                      : ""}
                  </Button>
                </div>
                {parsed.summary != null && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Summary
                    </h3>
                    <p className="text-sm leading-relaxed">
                      {String(parsed.summary)}
                    </p>
                  </section>
                )}
                {parsed.failure_modes != null && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Failure modes
                    </h3>
                    <p className="text-sm text-loss/90 leading-relaxed">
                      {String(parsed.failure_modes)}
                    </p>
                  </section>
                )}
                {Array.isArray(parsed.sources) && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Sources ({(parsed.sources as unknown[]).length})
                    </h3>
                    <div className="space-y-2">
                      {(
                        parsed.sources as { url?: string; takeaway?: string }[]
                      ).map((s, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                        >
                          {s.url && (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent text-xs font-mono break-all hover:underline"
                            >
                              {s.url}
                            </a>
                          )}
                          {s.takeaway && (
                            <p className="mt-1 text-muted-foreground">
                              {s.takeaway}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Raw JSON
                  </summary>
                  <pre className="mt-2 font-mono whitespace-pre-wrap bg-muted/40 p-3 rounded-lg max-h-64 overflow-y-auto">
                    {content}
                  </pre>
                </details>
              </div>
            )}
            {selectedPath && !parsed && content && (
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {content}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden flex-1 min-h-[360px] holo-border">
          <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
            {filteredEdges.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No edges recorded yet.
              </p>
            )}
            {[...filteredEdges].reverse().map((e: EdgeRecord, i) => (
              <button
                key={`${e.bet_id}-${i}`}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors"
                onClick={() => openEdge(e)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{e.match || "—"}</div>
                  <div className="flex items-center gap-2">
                    {e.result && (
                      <span
                        className={cn(
                          "text-[10px] border rounded px-1.5 py-0.5",
                          resultBadgeClass(String(e.result))
                        )}
                      >
                        {String(e.result)}
                      </span>
                    )}
                    {e.p_l != null && (
                      <span
                        className={cn(
                          "text-xs tabular-nums font-medium",
                          plColor(Number(e.p_l))
                        )}
                      >
                        {Number(e.p_l) > 0 ? "+" : ""}
                        {formatNokPlain(Number(e.p_l))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {e.selection} · @{e.odds} · band {e.odds_band || "—"} · grade{" "}
                  {e.grade || "—"} · phase {e.phase || "—"}
                </div>
                {e.note && (
                  <p className="text-xs mt-1 text-foreground/80">
                    {truncate(String(e.note), 200)}
                  </p>
                )}
                <div className="text-[10px] font-mono text-primary/80 mt-1">
                  {e.ts} · {e.bet_id || "no bet_id"} · open Ledger
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
