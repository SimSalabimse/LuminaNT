import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bet, DecisionRecord, EdgeRecord } from "@/types";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/stores/data-store";
import { cn, formatNokPlain, plColor, resultBadgeClass } from "@/lib/utils";
import { marketFamilyLabel } from "@/lib/markets";
import { isTauri, readTextFile } from "@/lib/tauri";

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

/** Shared Case File body — used in dual-pane dock and modal */
export function CaseFileContent({ bet }: { bet: Bet }) {
  const snapshot = useDataStore((s) => s.snapshot);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [packLoading, setPackLoading] = useState(false);

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
    const processLabel =
      p_model != null &&
      ["A", "B"].includes((bet.research_grade || "").toUpperCase())
        ? "Solid / partial process"
        : ev != null
          ? "Recovered / thin meta"
          : bet.source === "era_archive"
            ? "Archive era"
            : "Unknown process";
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
  }, [bet, snapshot]);

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
              : snapshot?.risk?.remaining_risk_nok != null
                ? Number(snapshot.risk.remaining_risk_nok)
                : null;
          const hasDecision =
            stakeRec != null || sizeMode != null || unit != null || rules != null;

          if (!hasDecision) {
            return (
              <p className="text-sm text-muted-foreground py-1">
                No stake decision recorded for this ticket. Ledger stake{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatNokPlain(bet.stake_nok)} NOK
                </span>
                .
              </p>
            );
          }

          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Final stake
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-primary tabular-nums">
                    {stakeRec != null
                      ? `${formatNokPlain(stakeRec)} NOK`
                      : `${formatNokPlain(bet.stake_nok)} NOK`}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Unit
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                    {unit != null ? `${formatNokPlain(unit)} NOK` : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Size mode
                  </div>
                  <div className="mt-0.5 text-sm font-bold tracking-wide">
                    {sizeMode || "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Ledger stake
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                    {formatNokPlain(bet.stake_nok)} NOK
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Room (at place)
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                    {room != null ? `${formatNokPlain(room)} NOK` : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Rule version
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-semibold">
                    {rules || "—"}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sizing audit trail in{" "}
                <span className="font-mono">data/state/stake_decisions.jsonl</span>.
              </p>
            </div>
          );
        })()}
      </Section>

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
    </div>
  );
}
