/**
 * Full ReasoningChain expand sections:
 * line · light+promo · sources · p_model · haircut EV · stake · ControlSignals
 * Engine SSOT only — never invent haircut formulas.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReasoningChain } from "@/types";
import { cn, formatNokPlain } from "@/lib/utils";

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  let n = Number(v);
  if (Math.abs(n) > 1.5) n = n / 100; // tolerate 4.2 vs 0.042
  return `${(n * 100).toFixed(digits)}%`;
}

function blobText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  try {
    return JSON.stringify(v, null, 0);
  } catch {
    return String(v);
  }
}

function ExpandSection({
  title,
  defaultOpen = false,
  children,
  empty,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (empty) {
    return (
      <div className="rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1.5">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/70">{title}</span>
          <span className="ml-2">—</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-semibold text-foreground/90 hover:bg-white/[0.03] min-h-[32px]"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {title}
      </button>
      {open && (
        <div className="px-2.5 pb-2 pt-0.5 text-[12px] leading-relaxed text-muted-foreground border-t border-white/[0.05]">
          {children}
        </div>
      )}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-mono text-right text-foreground/90 break-all">
        {value ?? "—"}
      </span>
    </div>
  );
}

export function ReasoningChainView({
  chain,
  className,
}: {
  chain: ReasoningChain;
  className?: string;
}) {
  const lightText = blobText(chain.light);
  const promoText = blobText(chain.promo);
  const sources = Array.isArray(chain.sources) ? chain.sources : [];
  const signals = Array.isArray(chain.control_signals)
    ? chain.control_signals
    : [];
  const steps = Array.isArray(chain.steps) ? chain.steps : [];
  const haircut =
    chain.haircut_ev != null
      ? Number(chain.haircut_ev)
      : chain.ev != null
        ? null // do not re-label raw ev as haircut
        : null;
  const stake =
    chain.stake_nok != null && Number.isFinite(Number(chain.stake_nok))
      ? Number(chain.stake_nok)
      : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <ExpandSection title="Line" defaultOpen>
        <div className="space-y-0.5">
          <Kv label="Match" value={chain.match || "—"} />
          <Kv label="Selection" value={chain.selection || "—"} />
          <Kv
            label="Odds"
            value={
              chain.decimal_odds != null
                ? Number(chain.decimal_odds).toFixed(2)
                : "—"
            }
          />
          <Kv label="Day" value={chain.day || "—"} />
          <Kv label="Decision" value={chain.decision || "—"} />
          <Kv label="Kind" value={chain.kind || "—"} />
          {chain.bet_id != null && chain.bet_id !== "" && (
            <Kv label="Bet ID" value={String(chain.bet_id)} />
          )}
          {chain.reasoning_chain_id && (
            <Kv label="Chain ID" value={String(chain.reasoning_chain_id)} />
          )}
        </div>
      </ExpandSection>

      <ExpandSection
        title="Light + promo"
        empty={!lightText && !promoText}
        defaultOpen={Boolean(lightText || promoText)}
      >
        {lightText ? (
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Light
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-[12px]">
              {lightText}
            </pre>
          </div>
        ) : null}
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
      </ExpandSection>

      <ExpandSection title="Sources" empty={sources.length === 0}>
        <ul className="list-disc pl-4 space-y-0.5">
          {sources.map((s, i) => (
            <li key={i} className="break-words">
              {typeof s === "string" ? s : blobText(s)}
            </li>
          ))}
        </ul>
      </ExpandSection>

      <ExpandSection title="p_model · EV · stake" defaultOpen>
        <div className="space-y-0.5">
          <Kv label="p_model" value={fmtPct(chain.p_model ?? null)} />
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
                : chain.haircut_ev == null
                  ? "— (engine SSOT only)"
                  : "—"
            }
          />
          <Kv
            label="Stake"
            value={
              stake != null ? `${formatNokPlain(stake)} NOK` : "—"
            }
          />
        </div>
      </ExpandSection>

      <ExpandSection title="ControlSignals" empty={signals.length === 0}>
        <ul className="space-y-1">
          {signals.map((sig, i) => (
            <li
              key={i}
              className="rounded border border-white/[0.05] bg-black/20 px-2 py-1 font-mono text-[11px] break-all"
            >
              {typeof sig === "string" ? sig : blobText(sig)}
            </li>
          ))}
        </ul>
      </ExpandSection>

      <ExpandSection title="Steps" empty={steps.length === 0}>
        <ol className="list-decimal pl-4 space-y-1">
          {steps.map((step, i) => (
            <li key={i} className="break-words">
              {blobText(step)}
            </li>
          ))}
        </ol>
      </ExpandSection>
    </div>
  );
}
