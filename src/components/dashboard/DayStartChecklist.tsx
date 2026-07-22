/**
 * Persistent day-start process checklist on Desk (not a modal).
 * Checkbox state in localStorage, keyed by Oslo calendar day.
 * Lightweight — navigation only; no new backend.
 */
import { useCallback, useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/types";

const STORAGE_KEY = "luminant-day-start-checklist";

type StepId =
  | "settle"
  | "odds"
  | "board"
  | "packs"
  | "recommend"
  | "place"
  | "place-ack";

type StepDef = {
  id: StepId;
  label: string;
  hint: string;
  view: ViewId;
  /** When true, step is only required if COV is critical/warn */
  covConditional?: boolean;
};

const STEPS: StepDef[] = [
  {
    id: "settle",
    label: "Settle pending results",
    hint: "Ops · SettleDesk / settle CLI",
    view: "workflow",
  },
  {
    id: "odds",
    label: "Odds dump ready",
    hint: "Confirm inbox odds file",
    view: "odds",
  },
  {
    id: "board",
    label: "Research board",
    hint: "Ops · Board (shortlist + coverage)",
    view: "workflow",
  },
  {
    id: "packs",
    label: "Deep packs if COV critical/warn",
    hint: "Expand packs on survivable band",
    view: "evidence",
    covConditional: true,
  },
  {
    id: "recommend",
    label: "Recommend dry-run",
    hint: "Ops · Recommend (dry-run default)",
    view: "workflow",
  },
  {
    id: "place",
    label: "Place on NT",
    hint: "Execute place slip on Norsk Tipping",
    view: "shortlist",
  },
  {
    id: "place-ack",
    label: "Place-ack",
    hint: "Pending → ConfirmedPlaced",
    view: "workflow",
  },
];

type StoredState = {
  day: string;
  checked: Partial<Record<StepId, boolean>>;
};

function osloDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function readStored(day: string): Partial<Record<StepId, boolean>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed?.day !== day || !parsed.checked) return {};
    return parsed.checked;
  } catch {
    return {};
  }
}

function writeStored(day: string, checked: Partial<Record<StepId, boolean>>) {
  try {
    const payload: StoredState = { day, checked };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota — ignore */
  }
}

function covLevelFromSnapshot(
  coverage: unknown
): "ok" | "warn" | "critical" | "unknown" {
  if (!coverage || typeof coverage !== "object") return "unknown";
  const level = String(
    (coverage as { level?: unknown }).level ?? ""
  )
    .trim()
    .toLowerCase();
  if (level === "critical") return "critical";
  if (level === "warn" || level === "warning") return "warn";
  if (level === "ok") return "ok";
  return "unknown";
}

/**
 * Day-start process checklist — settle → odds → board → packs? → recommend → place → place-ack.
 */
export function DayStartChecklist() {
  const setView = useAppStore((s) => s.setView);
  const coverage = useDataStore((s) => s.snapshot?.coverage_health);
  const day = useMemo(() => osloDayKey(), []);
  const [checked, setChecked] = useState<Partial<Record<StepId, boolean>>>(
    () => readStored(day)
  );

  const covLevel = useMemo(() => covLevelFromSnapshot(coverage), [coverage]);
  const packsNeeded = covLevel === "critical" || covLevel === "warn";

  const toggle = useCallback(
    (id: StepId) => {
      setChecked((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        writeStored(day, next);
        return next;
      });
    },
    [day]
  );

  const reset = useCallback(() => {
    setChecked({});
    writeStored(day, {});
  }, [day]);

  /** Progress: packs step auto-counts when COV does not require it */
  const { done, total, allDone } = useMemo(() => {
    let d = 0;
    let t = 0;
    for (const step of STEPS) {
      if (step.covConditional && !packsNeeded) {
        // Not required today — still count toward total as satisfied
        t += 1;
        d += 1;
        continue;
      }
      t += 1;
      if (checked[step.id]) d += 1;
    }
    return { done: d, total: t, allDone: d >= t };
  }, [checked, packsNeeded]);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/50 overflow-hidden",
        allDone
          ? "border-profit/25"
          : packsNeeded
            ? "border-pending/30"
            : "border-white/[0.08]"
      )}
    >
      <div className="px-4 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary shrink-0" />
            Day-start process
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Settle → odds → board → packs if COV↓ → recommend dry-run → place →
            place-ack
            <span className="font-mono opacity-70 ml-1.5">{day}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={allDone ? "default" : "secondary"}
            className={cn(
              "tabular-nums text-[10px] font-mono h-7",
              allDone && "bg-profit/20 text-profit border-profit/30"
            )}
          >
            {done}/{total}
          </Badge>
          {packsNeeded && (
            <Badge
              className={cn(
                "text-[10px] h-7 font-semibold uppercase tracking-wide",
                covLevel === "critical"
                  ? "bg-loss/15 text-loss border-loss/35"
                  : "bg-pending/15 text-pending border-pending/35"
              )}
            >
              COV {covLevel}
            </Badge>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] gap-1 text-muted-foreground"
            onClick={reset}
            title="Reset checklist for today"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      <ol className="divide-y divide-white/[0.04]">
        {STEPS.map((step, idx) => {
          const isPacks = step.covConditional === true;
          const skipOk = isPacks && !packsNeeded;
          const isChecked = skipOk || Boolean(checked[step.id]);
          const emphasize = isPacks && packsNeeded && !checked[step.id];

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 min-h-[44px]",
                emphasize && "bg-pending/[0.06]",
                skipOk && "opacity-60"
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                aria-label={`${step.label}${isChecked ? " (done)" : ""}`}
                disabled={skipOk}
                onClick={() => {
                  if (!skipOk) toggle(step.id);
                }}
                className={cn(
                  "h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors",
                  "focus-ring",
                  isChecked
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : emphasize
                      ? "border-pending/50 bg-pending/10"
                      : "border-white/15 bg-black/30 hover:border-white/30",
                  skipOk && "cursor-default"
                )}
              >
                {isChecked && <Check className="h-3 w-3" strokeWidth={2.5} />}
              </button>

              <span className="text-[10px] font-mono text-muted-foreground w-4 tabular-nums shrink-0">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-[13px] font-medium leading-tight",
                    isChecked && !skipOk && "line-through text-muted-foreground"
                  )}
                >
                  {step.label}
                  {skipOk && (
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground no-underline">
                      (not needed · COV ok)
                    </span>
                  )}
                  {emphasize && (
                    <span className="ml-1.5 text-[10px] font-semibold text-pending no-underline">
                      required
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {step.hint}
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-[11px] gap-1 shrink-0 text-primary"
                onClick={() => setView(step.view)}
              >
                Go
                <ArrowRight className="h-3 w-3" />
              </Button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
