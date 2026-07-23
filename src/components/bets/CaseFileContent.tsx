import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bet, DecisionRecord, EdgeRecord } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import {
  cn,
  formatNokPlain,
  isOpenRisk,
  plColor,
  resultBadgeClass,
  resultDisplayLabel,
} from "@/lib/utils";
import { marketFamilyLabel } from "@/lib/markets";
import { isTauri, readTextFile } from "@/lib/tauri";
import {
  activeControlSignals,
  parsePostSettlementPacket,
} from "@/lib/phaseRadar";
import { resolveReasoningChain } from "@/lib/resolveReasoningChain";
import { SimpleModeCard } from "@/components/reasoning/SimpleModeCard";

function parseNotesMeta(notes: string) {
  const out: {
    p_model?: number;
    ev?: number;
    explore?: boolean;
    stake_rec?: number;
    size_mode?: string;
    unit?: number;
    rules?: string;
  } = {};
  const pm = notes.match(/\bp_model\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
  if (pm) {
    let v = Number(pm[1].replace(",", "."));
    if (v > 1) v /= 100;
    out.p_model = v;
  }
  const ev = notes.match(/\bEV\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
  if (ev) {
    let v = Number(ev[1].replace(",", "."));
    if (Math.abs(v) > 1) v /= 100;
    out.ev = v;
  }
  if (/\bEXPLORE\b/i.test(notes)) out.explore = true;
  const sr = notes.match(/\bstake_rec\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
  if (sr) out.stake_rec = Number(sr[1].replace(",", "."));
  const sm = notes.match(/\bsize_mode\s*=\s*([A-Za-z_]+)/i);
  if (sm) out.size_mode = sm[1].toUpperCase();
  const un = notes.match(/\bunit\s*=\s*([+-]?\d+(?:[.,]\d+)?)/i);
  if (un) out.unit = Number(un[1].replace(",", "."));
  const rules = notes.match(/\brules\s*=\s*([^\s;]+)/i);
  if (rules) out.rules = rules[1];
  return out;
}

function latestDecision(
  decisions: DecisionRecord[] | undefined,
  betId: string
): DecisionRecord | null {
  if (!decisions?.length) return null;
  let best: DecisionRecord | null = null;
  for (const d of decisions) {
    if (String(d.bet_id) === String(betId)) best = d;
  }
  return best;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2 relative overflow-hidden">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <h4 className="section-label">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-border/30 py-1">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="font-mono text-xs text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

function StakeCell({
  label,
  value,
  accent,
  bold,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/30 px-2.5 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm tabular-nums",
          mono || accent ? "font-mono" : "font-mono",
          accent && "font-bold text-primary",
          bold && "font-bold tracking-wide",
          !accent && !bold && "font-semibold"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Shared Case File body — used in dual-pane dock and modal */
export function CaseFileContent({ bet }: { bet: Bet }) {
  const snapshot = useDataStore((s) => s.snapshot);
  const allBets = useDataStore((s) => s.bets);
  const setView = useAppStore((s) => s.setView);
  const simpleMode = useAppStore((s) => s.settings.simpleMode !== false);
  const drillForensic = useDataStore((s) => s.drillForensic);
  const setSelectedBetId = useDataStore((s) => s.setSelectedBetId);
  const setFilters = useDataStore((s) => s.setFilters);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [packLoading, setPackLoading] = useState(false);

  const reasoningChain = useMemo(
    () =>
      resolveReasoningChain(snapshot?.reasoning_chains, {
        betId: bet.bet_id,
        match: bet.match,
        selection: bet.selection,
        day: bet.date,
        reasoningChainId:
          bet.reasoning_chain_id != null
            ? String(bet.reasoning_chain_id)
            : null,
      }),
    [snapshot?.reasoning_chains, bet]
  );

  /** P2 bidirectional: related open risk on same match / sport for re-trigger */
  const relatedOpen = useMemo(() => {
    const matchKey = (bet.match || "").trim().toLowerCase();
    const sportKey = (bet.sport || "").trim().toLowerCase();
    const sameMatch: Bet[] = [];
    const sameSportOpen: Bet[] = [];
    for (const b of allBets) {
      if (String(b.bet_id) === String(bet.bet_id)) continue;
      if (!isOpenRisk(b.result)) continue;
      const m = (b.match || "").trim().toLowerCase();
      const s = (b.sport || "").trim().toLowerCase();
      if (matchKey && m === matchKey) sameMatch.push(b);
      else if (sportKey && s === sportKey) sameSportOpen.push(b);
    }
    // Cap sport peers so the panel stays scannable
    return {
      sameMatch,
      sameSportOpen: sameSportOpen.slice(0, 8),
      sportOpenCount: sameSportOpen.length,
    };
  }, [allBets, bet.bet_id, bet.match, bet.sport]);

  const dossier = useMemo(() => {
    const dec =
      latestDecision(snapshot?.decisions, bet.bet_id) ||
      ({} as DecisionRecord);
    const notesMeta = parseNotesMeta(bet.notes || "");
    const p_model = dec.p_model ?? notesMeta.p_model;
    const ev = dec.ev ?? notesMeta.ev;
    const explore = Boolean(dec.explore ?? notesMeta.explore);
    const edges = (snapshot?.edges || []).filter(
      (e: EdgeRecord) =>
        String(e.bet_id || "") === String(bet.bet_id) ||
        (e.match && e.match === bet.match)
    );
    const cal = (snapshot?.calibration || []).find(
      (c) => String(c.bet_id) === String(bet.bet_id)
    );
    const link = (snapshot?.evidence_links || []).find(
      (l) => String(l.bet_id) === String(bet.bet_id)
    );
    const evidenceFile =
      (link?.evidence_path as string | undefined) ||
      (dec.evidence_path as string | undefined) ||
      snapshot?.evidence?.find((f) => {
        const n = (f.name || "").toLowerCase();
        const m = bet.match.toLowerCase().slice(0, 12).replace(/\s+/g, "_");
        return (
          n.includes(m) || n.includes(bet.selection.toLowerCase().slice(0, 8))
        );
      })?.path;
    const matchMethod =
      (link?.match_method as string | undefined) ||
      (dec.evidence_match as string | undefined) ||
      "none";
    const linkConf = link?.confidence as number | undefined;
    const sportLearn = snapshot?.learning?.sports?.[bet.sport || ""];
    const chainGrade = reasoningChain
      ? String(reasoningChain.grade || "").trim().toUpperCase()
      : "";
    const ledgerGrade = String(bet.research_grade || "").trim().toUpperCase();
    const gradeForLabel = chainGrade || ledgerGrade;
    const chainKind = reasoningChain
      ? String(reasoningChain.kind || "").trim()
      : "";
    // Prefer chain grade + raw kind before falling to "Unknown process"
    let processLabel = "Unknown process";
    if (reasoningChain && (gradeForLabel || chainKind)) {
      const parts = ["Chain"];
      if (gradeForLabel) parts.push(`Grade ${gradeForLabel}`);
      if (chainKind) parts.push(chainKind);
      processLabel = parts.join(" · ");
    } else if (
      p_model != null &&
      ["A", "B"].includes(ledgerGrade)
    ) {
      processLabel = "Solid / partial process";
    } else if (ev != null) {
      processLabel = "Recovered / thin meta";
    } else if (bet.source === "era_archive") {
      processLabel = "Archive era";
    }
    return {
      dec,
      p_model,
      ev,
      explore,
      notesMeta,
      edges,
      cal,
      evidenceFile,
      matchMethod,
      linkConf,
      sportLearn,
      processLabel,
      marketKey:
        (dec.market_key as string) ||
        bet.market_family ||
        marketFamilyLabel(bet.market_type),
    };
  }, [bet, snapshot, reasoningChain]);

  useEffect(() => {
    if (!dossier.evidenceFile) {
      setPack(null);
      setPackError(null);
      setPackLoading(false);
      return;
    }
    let cancelled = false;
    const path = String(dossier.evidenceFile);
    setPackLoading(true);
    setPackError(null);
    (async () => {
      try {
        let text = "";
        if (isTauri() && !path.startsWith("demo-data")) {
          try {
            text = await readTextFile(path);
          } catch {
            const hit = snapshot?.evidence?.find(
              (f) =>
                f.path === path ||
                f.name === path.split(/[/\\]/).pop() ||
                f.path.endsWith(path.split(/[/\\]/).pop() || "")
            );
            if (hit?.path) text = await readTextFile(hit.path);
            else throw new Error(`Cannot read ${path}`);
          }
        } else {
          const res = await fetch(`/${path.replace(/^\/+/, "")}`);
          text = res.ok ? await res.text() : "";
          if (!text) throw new Error("Pack not available in browser/demo mode");
        }
        if (cancelled) return;
        try {
          setPack(JSON.parse(text) as Record<string, unknown>);
        } catch {
          setPack({ raw: text.slice(0, 4000) });
        }
      } catch (e) {
        if (!cancelled) {
          setPack(null);
          setPackError(String(e));
        }
      } finally {
        if (!cancelled) setPackLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dossier.evidenceFile, snapshot?.evidence]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 pb-1">
        <h2 className="text-base font-semibold tracking-tight leading-snug pr-6">
          {bet.match}
        </h2>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-muted-foreground">{bet.selection}</span>
          <span
            className={cn(
              "text-xs border rounded-md px-1.5 py-0.5",
              resultBadgeClass(bet.result)
            )}
          >
            {bet.result}
          </span>
          <span className={cn("tabular-nums font-medium", plColor(bet.p_l_nok))}>
            {bet.p_l_nok > 0 ? "+" : ""}
            {formatNokPlain(bet.p_l_nok)} NOK
          </span>
          <Badge variant="secondary">{dossier.processLabel}</Badge>
        </div>
      </div>

      <Section title="0 · Reasoning (Simple Mode)">
        <SimpleModeCard
          chain={reasoningChain}
          simpleMode={simpleMode}
          fallbackGrade={bet.research_grade}
          activeSignals={activeControlSignals(snapshot?.control_signals || [])}
          emphasis="primary"
        />
      </Section>

      <Section title="1 · Ledger">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Row label="Bet ID" value={bet.bet_id} />
          <Row label="Date" value={bet.date} />
          <Row label="Odds" value={bet.decimal_odds} />
          <Row label="Stake" value={`${formatNokPlain(bet.stake_nok)} NOK`} />
          <Row label="Sport" value={bet.sport || "—"} />
          <Row
            label="Market"
            value={dossier.marketKey || bet.market_type || "—"}
          />
          <Row label="Band" value={bet.odds_band || "—"} />
          <Row label="Phase" value={bet.phase || "—"} />
          <Row label="Grade" value={bet.research_grade || "—"} />
          <Row label="Source" value={bet.source || "—"} />
        </div>
      </Section>

      <Section title="2 · Decision / model">
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Row
            label="p_model"
            value={
              dossier.p_model != null
                ? `${(dossier.p_model * 100).toFixed(1)}%`
                : "— (missing)"
            }
          />
          <Row
            label="EV"
            value={
              dossier.ev != null
                ? `${(dossier.ev * 100).toFixed(1)}pp`
                : "— (missing)"
            }
          />
          <Row
            label="Implied"
            value={
              bet.decimal_odds > 1
                ? `${((1 / bet.decimal_odds) * 100).toFixed(1)}%`
                : "—"
            }
          />
          <Row label="Explore" value={dossier.explore ? "yes" : "no"} />
          <Row
            label="p_model source"
            value={String(
              dossier.dec.p_model_source ||
                (dossier.p_model != null ? "notes/engine" : "—")
            )}
          />
          <Row
            label="Learn stake ×"
            value={
              dossier.dec.learning_stake_mult != null
                ? String(dossier.dec.learning_stake_mult)
                : "—"
            }
          />
        </div>
        {Array.isArray(dossier.dec.reasons) && dossier.dec.reasons.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {(dossier.dec.reasons as string[]).slice(0, 6).join(" · ")}
          </p>
        )}
      </Section>

      <Section title="2b · Stake decision">
        {(() => {
          const sd = (snapshot?.stake_decisions || [])
            .slice()
            .reverse()
            .find((d) => String(d.bet_id || "") === String(bet.bet_id)) as
            | Record<string, unknown>
            | undefined;
          const unit =
            dossier.notesMeta.unit ??
            (sd?.active_unit_nok != null ? Number(sd.active_unit_nok) : null);
          const sizeMode =
            dossier.notesMeta.size_mode ||
            (sd?.size_mode ? String(sd.size_mode).toUpperCase() : null);
          const stakeRec =
            dossier.notesMeta.stake_rec ??
            (sd?.final_stake_nok != null
              ? Number(sd.final_stake_nok)
              : sd?.stake_nok != null
                ? Number(sd.stake_nok)
                : null);
          const rules =
            dossier.notesMeta.rules ||
            (sd?.rule_bundle_version ? String(sd.rule_bundle_version) : null);
          const room =
            sd?.remaining_risk_nok != null
              ? Number(sd.remaining_risk_nok)
              : null;
          const finalStake = stakeRec ?? Number(bet.stake_nok) ?? 0;
          const hasMeta =
            stakeRec != null || sizeMode != null || unit != null || rules != null;

          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StakeCell
                  label="Final stake"
                  value={`${formatNokPlain(finalStake)} NOK`}
                  accent
                />
                <StakeCell
                  label="Unit"
                  value={unit != null ? `${formatNokPlain(unit)} NOK` : "—"}
                />
                <StakeCell label="Size mode" value={sizeMode || "—"} bold />
                <StakeCell
                  label="Ledger stake"
                  value={`${formatNokPlain(bet.stake_nok)} NOK`}
                />
                <StakeCell
                  label="Room at place"
                  value={room != null ? `${formatNokPlain(room)} NOK` : "—"}
                />
                <StakeCell label="Rule version" value={rules || "—"} mono />
              </div>
              {!hasMeta && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  No sizing audit fields on this ticket — showing ledger stake only.
                </p>
              )}
            </div>
          );
        })()}
      </Section>

      <Section title="2c · Deep-dive">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => {
              drillForensic({
                dim: "bet_id",
                value: bet.bet_id,
                label: bet.match,
                betIds: [bet.bet_id],
                filterPatch: {},
                targetView: "bets",
              });
            }}
          >
            Ledger focus
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => {
              drillForensic({
                dim: "calibration",
                value: bet.bet_id,
                label: `Cal · ${bet.match}`,
                betIds: [bet.bet_id],
                filterPatch: {},
                targetView: "calibration",
              });
              setView("calibration");
            }}
          >
            Calibration
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setView("shortlist")}
          >
            Shortlist
          </Button>
          {dossier.evidenceFile && (
            <span className="text-[11px] font-mono text-muted-foreground self-center max-w-[220px] truncate" title={String(dossier.evidenceFile)}>
              {String(dossier.evidenceFile).split(/[/\\]/).pop()}
            </span>
          )}
        </div>
      </Section>

      {/* P2 bidirectional re-trigger: Case File → open-risk peers */}
      {(relatedOpen.sameMatch.length > 0 ||
        relatedOpen.sameSportOpen.length > 0 ||
        isOpenRisk(bet.result)) && (
        <Section title="2d · Related open risk">
          <div className="flex flex-wrap gap-2 mb-2">
            {relatedOpen.sameMatch.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[11px]"
                onClick={() => {
                  const ids = relatedOpen.sameMatch.map((b) => b.bet_id);
                  drillForensic({
                    dim: "open_match",
                    value: bet.match,
                    label: `Open · ${bet.match}`,
                    betIds: ids,
                    filterPatch: {
                      results: Array.from(
                        new Set(relatedOpen.sameMatch.map((b) => b.result))
                      ),
                    },
                    targetView: "bets",
                  });
                }}
              >
                Same match open ({relatedOpen.sameMatch.length})
              </Button>
            )}
            {(relatedOpen.sportOpenCount > 0 || isOpenRisk(bet.result)) &&
              bet.sport && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={() => {
                    const peers = allBets.filter(
                      (b) =>
                        isOpenRisk(b.result) &&
                        (b.sport || "").trim().toLowerCase() ===
                          (bet.sport || "").trim().toLowerCase()
                    );
                    drillForensic({
                      dim: "open_sport",
                      value: bet.sport || "",
                      label: `Open risk · ${bet.sport}`,
                      betIds: peers.map((b) => b.bet_id),
                      filterPatch: {
                        sports: [bet.sport || ""],
                        results: Array.from(
                          new Set(peers.map((b) => b.result).filter(Boolean))
                        ),
                      },
                      targetView: "bets",
                    });
                    setView("dashboard");
                  }}
                >
                  Sport open heatmap ({relatedOpen.sportOpenCount}
                  {isOpenRisk(bet.result) ? "+self" : ""})
                </Button>
              )}
          </div>
          {relatedOpen.sameMatch.length === 0 &&
            relatedOpen.sameSportOpen.length === 0 &&
            isOpenRisk(bet.result) && (
              <p className="text-[11px] text-muted-foreground">
                This ticket is open — no other open peers on same match/sport.
              </p>
            )}
          {relatedOpen.sameMatch.map((b) => (
            <button
              key={b.bet_id}
              type="button"
              className="w-full text-left text-xs border-b border-border/30 py-1.5 hover:bg-primary/10 rounded-md px-1.5 flex justify-between gap-2"
              onClick={() => setSelectedBetId(b.bet_id)}
              title="Open related Case File"
            >
              <span className="truncate">
                <span className="text-pending mr-1.5">
                  {resultDisplayLabel(b.result)}
                </span>
                {b.selection}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {formatNokPlain(b.stake_nok)}
              </span>
            </button>
          ))}
          {relatedOpen.sameMatch.length === 0 &&
            relatedOpen.sameSportOpen.slice(0, 4).map((b) => (
              <button
                key={b.bet_id}
                type="button"
                className="w-full text-left text-xs border-b border-border/30 py-1.5 hover:bg-primary/10 rounded-md px-1.5 flex justify-between gap-2"
                onClick={() => setSelectedBetId(b.bet_id)}
                title="Open related Case File"
              >
                <span className="truncate">
                  <span className="text-muted-foreground mr-1.5">
                    {b.match}
                  </span>
                  {b.selection}
                </span>
                <span className="font-mono tabular-nums shrink-0 text-pending">
                  {formatNokPlain(b.stake_nok)}
                </span>
              </button>
            ))}
        </Section>
      )}

      <Section title="3 · Evidence">
        <Row
          label="Link"
          value={
            dossier.evidenceFile ? (
              <span className="text-primary break-all">
                {String(dossier.evidenceFile)}
              </span>
            ) : (
              "No pack linked (honest empty)"
            )
          }
        />
        <Row label="Match method" value={String(dossier.matchMethod || "none")} />
        {dossier.linkConf != null && (
          <Row label="Link confidence" value={String(dossier.linkConf)} />
        )}
        {packLoading && (
          <p className="text-xs text-muted-foreground">Loading pack…</p>
        )}
        {packError && (
          <p className="text-xs text-loss/90">Could not load pack: {packError}</p>
        )}
        {pack && (
          <div className="mt-2 space-y-2 rounded-md border border-border/50 bg-background/40 p-2 max-h-48 overflow-y-auto">
            {pack.p_model != null && (
              <Row label="Pack p_model" value={String(pack.p_model)} />
            )}
            {pack.match != null && (
              <Row label="Pack match" value={String(pack.match)} />
            )}
            {pack.selection != null && (
              <Row label="Pack selection" value={String(pack.selection)} />
            )}
            {pack.summary != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  Summary
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {String(pack.summary)}
                </p>
              </div>
            )}
            {pack.thesis != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                  Thesis
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {String(pack.thesis)}
                </p>
              </div>
            )}
            {pack.raw != null && (
              <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground">
                {String(pack.raw)}
              </pre>
            )}
          </div>
        )}
      </Section>

      <Section title="4 · Edges / lessons">
        {dossier.edges.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No edges.jsonl rows for this bet
          </p>
        ) : (
          dossier.edges.slice(0, 5).map((e, i) => (
            <div key={i} className="text-xs border-b border-border/30 py-1">
              <span className="font-mono">{e.result}</span>
              {e.p_l != null && (
                <span className={cn("ml-2", plColor(Number(e.p_l)))}>
                  {Number(e.p_l) > 0 ? "+" : ""}
                  {formatNokPlain(Number(e.p_l))}
                </span>
              )}
              {e.note && (
                <p className="text-muted-foreground mt-0.5">{String(e.note)}</p>
              )}
            </div>
          ))
        )}
      </Section>

      <Section title="5 · Calibration">
        {dossier.cal ? (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Row label="p_model" value={String(dossier.cal.p_model ?? "—")} />
            <Row label="y (1=win)" value={String(dossier.cal.y ?? "—")} />
            <Row label="Brier" value={String(dossier.cal.brier ?? "—")} />
            <Row label="Result" value={String(dossier.cal.result ?? "—")} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No calibration row (needs trustworthy p_model at settle)
          </p>
        )}
      </Section>

      <Section title="6 · Learning context">
        <Row
          label="Sport mult now"
          value={
            dossier.sportLearn
              ? `×${dossier.sportLearn.stake_mult ?? 1} · ${dossier.sportLearn.status || "—"} · n=${dossier.sportLearn.n ?? "?"}`
              : "—"
          }
        />
        <Row
          label="Learn EV boost"
          value={
            dossier.dec.learning_ev_boost != null
              ? `${(Number(dossier.dec.learning_ev_boost) * 100).toFixed(1)}pp`
              : "—"
          }
        />
      </Section>

      <Section title="7 · Notes">
        <div className="rounded-md bg-background/50 border border-border/40 p-2 max-h-40 overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {bet.notes || "(no notes)"}
          </p>
        </div>
      </Section>

      {/* P0 PostSettlementPacket + process deep-dive */}
      <Section title="8 · PostSettlementPacket">
        {(() => {
          const psp = parsePostSettlementPacket(bet.notes);
          const review = (snapshot?.settlement_reviews || [])
            .slice()
            .reverse()
            .find((r) => String(r.bet_id || "") === String(bet.bet_id));
          const signals = activeControlSignals(snapshot?.control_signals || []).filter(
            (s) =>
              String(s.bet_id || "") === String(bet.bet_id) ||
              (s.sport &&
                bet.sport &&
                String(s.sport).toLowerCase() === String(bet.sport).toLowerCase())
          );
          const hasPacket =
            psp ||
            review?.process_root_cause ||
            (review && String(review.variance_class || "") === "process_error");

          if (!hasPacket && !psp) {
            return (
              <p className="text-xs text-muted-foreground">
                No packet (settled before P0, non-strict settle, or tags not set)
              </p>
            );
          }

          const score =
            psp?.score ||
            (review as { score?: string } | undefined)?.score ||
            "—";
          const xi = psp?.xi || "—";
          const xiDelta = psp?.xi_delta || "—";
          const script = psp?.script || "—";
          const root =
            psp?.root ||
            String(review?.process_root_cause || "—");

          return (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-x-4">
                <Row label="actual_score" value={score} />
                <Row label="actual_lineup_status" value={xi} />
                <Row label="xi_delta" value={xiDelta} />
                <Row label="script_realized" value={script} />
                <Row label="process_root_cause" value={root} />
                <Row
                  label="variance_class"
                  value={String(review?.variance_class || "—")}
                />
                <Row
                  label="research_retro"
                  value={String(review?.research_quality_retro || "—")}
                />
              </div>
              {signals.length > 0 && (
                <p className="text-[11px] text-pending">
                  Linked ControlSignal: {signals[0].sport}
                  {signals[0].market ? ` / ${signals[0].market}` : ""} · +
                  {signals[0].min_ev_raise} EV · src={signals[0].source}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={() => {
                    const peers = allBets
                      .filter(
                        (b) =>
                          b.result === "Loss" &&
                          (b.sport || "").toLowerCase() ===
                            (bet.sport || "").toLowerCase()
                      )
                      .map((b) => b.bet_id);
                    drillForensic({
                      dim: "process_peer",
                      value: bet.sport || "",
                      label: `Losses · ${bet.sport || "sport"}`,
                      betIds: peers.length ? peers : [bet.bet_id],
                      filterPatch: {
                        sports: bet.sport ? [bet.sport] : [],
                        results: ["Loss"],
                      },
                      targetView: "bets",
                    });
                  }}
                >
                  Similar sport losses
                </Button>
                {root && root !== "—" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px]"
                    onClick={() => {
                      setFilters({ search: String(root) });
                      setView("bets");
                    }}
                  >
                    Search root cause
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Section>
    </div>
  );
}
