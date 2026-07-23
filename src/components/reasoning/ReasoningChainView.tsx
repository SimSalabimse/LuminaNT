/**
 * Flat forensic ReasoningChain sections (always visible after parent expand):
 * Odds → Light+promo → Sources → p_model → Haircut EV → Stake → ControlSignals → Steps
 * Engine SSOT only — never invent haircut; never re-label raw ev as haircut.
 */
import type { ReactNode } from "react";
import type { ControlSignal, ReasoningChain } from "@/types";
import {
  haircutEvOf,
  stakeNokOf,
  unitNokOf,
} from "@/lib/resolveReasoningChain";
import { cn, formatNokPlain } from "@/lib/utils";

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  let n = Number(v);
  if (Math.abs(n) > 1.5) n = n / 100;
  return `${(n * 100).toFixed(digits)}%`;
}

function blobText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function basename(path: string | null | undefined): string {
  const p = String(path || "").trim();
  if (!p) return "";
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {title}
      </div>
      <div className="text-[12px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-mono tabular-nums text-right text-foreground/90 break-all">
        {value ?? "—"}
      </span>
    </div>
  );
}

function dash(v: ReactNode): ReactNode {
  if (v == null || v === "") return "—";
  return v;
}

export function ReasoningChainView({
  chain,
  className,
  activeSignals,
}: {
  chain: ReasoningChain;
  className?: string;
  activeSignals?: ControlSignal[] | null;
}) {
  const lightText = blobText(chain.light);
  const promoText = blobText(chain.promo);
  const sources = Array.isArray(chain.sources) ? chain.sources : [];
  const evidenceName = basename(chain.evidence_path);
  const signals = Array.isArray(chain.control_signals)
    ? chain.control_signals
    : [];
  const steps = Array.isArray(chain.steps) ? chain.steps : [];
  const reasons = Array.isArray(chain.reasons) ? chain.reasons : [];
  const haircut = haircutEvOf(chain);
  const stake = stakeNokOf(chain);
  const unit = unitNokOf(chain);
  const controls = chain.controls as
    | {
        size_mode?: string;
        unit_nok?: number;
        explore?: boolean;
        [key: string]: unknown;
      }
    | null
    | undefined;
  const haircutRate =
    chain.haircut != null && Number.isFinite(Number(chain.haircut))
      ? Number(chain.haircut)
      : null;

  const notesBlob = `${chain.notes || ""} ${blobText(chain.light)}`;
  const hasTempEvRelax =
    /temp_ev_relax|ev.?relax/i.test(notesBlob) ||
    signals.some(
      (s) =>
        typeof s === "object" &&
        s &&
        /temp_ev_relax/i.test(String((s as { kind?: string }).kind || ""))
    ) ||
    (activeSignals || []).some((s) => /temp_ev_relax/i.test(String(s.kind || "")));
  const hasProcessGate =
    /process_gate|process_error|process\+/i.test(notesBlob) ||
    signals.some(
      (s) =>
        typeof s === "object" &&
        s &&
        /process_gate|temp_gate/i.test(String((s as { kind?: string }).kind || ""))
    );

  const sport = String(chain.sport || "").toLowerCase();
  const matchedActive = (activeSignals || []).filter(
    (s) =>
      !sport ||
      !s.sport ||
      String(s.sport).toLowerCase() === sport
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <Section title="Odds">
        <div className="space-y-0.5">
          <Kv label="Match" value={dash(chain.match)} />
          <Kv label="Selection" value={dash(chain.selection)} />
          <Kv
            label="Odds"
            value={
              chain.decimal_odds != null
                ? Number(chain.decimal_odds).toFixed(2)
                : "—"
            }
          />
          <Kv label="Day" value={dash(chain.day)} />
          <Kv label="Band" value={dash(chain.odds_band)} />
          <Kv label="Sport" value={dash(chain.sport)} />
          <Kv label="Market" value={dash(chain.market_key)} />
          <Kv label="Kind" value={dash(chain.kind)} />
          <Kv label="Decision" value={dash(chain.decision)} />
          {chain.bet_id != null && chain.bet_id !== "" && (
            <Kv label="Bet ID" value={String(chain.bet_id)} />
          )}
          {chain.reasoning_chain_id && (
            <Kv label="Chain ID" value={String(chain.reasoning_chain_id)} />
          )}
        </div>
      </Section>

      <Section title="Light + promo">
        {lightText ? (
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Light (text only — not traffic color)
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-[12px]">
              {lightText}
            </pre>
          </div>
        ) : (
          <p className="text-muted-foreground">—</p>
        )}
        {promoText ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Promo
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-[12px]">
              {promoText}
            </pre>
          </div>
        ) : null}
      </Section>

      <Section title="Sources">
        {sources.length > 0 ? (
          <ul className="list-disc pl-4 space-y-0.5">
            {sources.map((s, i) => (
              <li key={i} className="break-words">
                {typeof s === "string" ? s : blobText(s)}
              </li>
            ))}
          </ul>
        ) : evidenceName ? (
          <p className="font-mono text-[11px]">{evidenceName}</p>
        ) : (
          <p>—</p>
        )}
      </Section>

      <Section title="p_model">
        <Kv label="p_model" value={fmtPct(chain.p_model ?? null)} />
      </Section>

      <Section title="Haircut EV">
        <div className="space-y-0.5">
          <Kv
            label="EV (model)"
            value={
              chain.ev != null
                ? `${Number(chain.ev) >= 0 ? "+" : ""}${fmtPct(chain.ev)}`
                : "—"
            }
          />
          <Kv
            label="Haircut EV"
            value={
              haircut != null
                ? `${haircut >= 0 ? "+" : ""}${fmtPct(haircut)}`
                : "— (engine SSOT only)"
            }
          />
          <Kv
            label="Haircut rate"
            value={haircutRate != null ? fmtPct(haircutRate) : "—"}
          />
        </div>
      </Section>

      <Section title="Stake">
        <div className="space-y-0.5">
          <Kv
            label="Stake"
            value={stake != null ? `${formatNokPlain(stake)} NOK` : "—"}
          />
          <Kv
            label="Unit"
            value={unit != null ? `${formatNokPlain(unit)} NOK` : "—"}
          />
          <Kv
            label="Size mode"
            value={dash(controls?.size_mode || null)}
          />
          <Kv label="Grade" value={dash(chain.grade || null)} />
          <Kv
            label="Explore"
            value={
              controls?.explore === true
                ? "yes"
                : controls?.explore === false
                  ? "no"
                  : "—"
            }
          />
          <Kv
            label="temp_ev_relax"
            value={hasTempEvRelax ? "flagged" : "—"}
          />
          <Kv
            label="process_gate"
            value={hasProcessGate ? "flagged" : "—"}
          />
        </div>
      </Section>

      <Section title="Active ControlSignals">
        {signals.length === 0 && matchedActive.length === 0 ? (
          <p>—</p>
        ) : (
          <ul className="space-y-1">
            {signals.map((sig, i) => (
              <li
                key={`c-${i}`}
                className="rounded border border-white/[0.05] bg-black/20 px-2 py-1 font-mono text-[11px] break-all"
              >
                {typeof sig === "string" ? sig : blobText(sig)}
              </li>
            ))}
            {matchedActive.map((sig, i) => (
              <li
                key={`a-${i}`}
                className="rounded border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[11px] break-all"
              >
                {sig.kind || "signal"}
                {sig.sport ? ` · ${sig.sport}` : ""}
                {sig.min_ev_raise != null ? ` · +${sig.min_ev_raise}` : ""}
                {sig.delta_ev != null ? ` · Δev ${sig.delta_ev}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(steps.length > 0 || reasons.length > 0) && (
        <Section title="Steps / reasons">
          {reasons.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5 mb-2">
              {reasons.map((r, i) => (
                <li key={i} className="break-words">
                  {String(r)}
                </li>
              ))}
            </ul>
          )}
          {steps.length > 0 && (
            <ol className="list-decimal pl-4 space-y-1">
              {steps.map((step, i) => (
                <li key={i} className="break-words">
                  {blobText(step)}
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}
    </div>
  );
}
