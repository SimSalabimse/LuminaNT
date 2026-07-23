import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Keyboard,
  Layers,
  Sparkles,
  Workflow,
  X,
  GraduationCap,
  Link2,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Kbd } from "@/components/layout/Kbd";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabId = "flow" | "chips" | "skills" | "learn" | "keys";

const TABS: { id: TabId; label: string; icon: typeof Workflow }[] = [
  { id: "flow", label: "Daily flow", icon: Workflow },
  { id: "chips", label: "Desk chips", icon: Layers },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "learn", label: "Learn & chain", icon: GraduationCap },
  { id: "keys", label: "Keys", icon: Keyboard },
];

const DAILY_FLOW: { step: string; detail: string }[] = [
  {
    step: "Odds",
    detail: "Ingest / confirm today's dump (inbox odds file · Odds workspace).",
  },
  {
    step: "Research",
    detail: "Market-scan → board + light research. Shortlist + Coverage Health.",
  },
  {
    step: "Deep",
    detail:
      "Work engine deep queue; write evidence packs. Prefer CFLOOR scaffolds over shortcuts.",
  },
  {
    step: "Recommend",
    detail: "Dry-run first (Ops). Live recommend only when packs + gates are honest.",
  },
  {
    step: "PLACE",
    detail: "Execute slip on NT from PLACE_THESE.md → place-ack (Pending → ConfirmedPlaced).",
  },
  {
    step: "Settle",
    detail: "SettleDesk / settle CLI with score, skill vs variance, root cause.",
  },
  {
    step: "Taxonomy learn",
    detail:
      "predictability × variance_class → learning_weight; mults & ControlSignals follow weight.",
  },
];

const DESK_CHIPS: { chip: string; meaning: string }[] = [
  {
    chip: "COV",
    meaning:
      "Coverage Health level (ok / warn / critical). COV FORCE = engine prioritises deep packs when coverage is weak.",
  },
  {
    chip: "CFLOOR",
    meaning:
      "Coverage floor (Mechanism A): dynamic deep target, top-promo scaffolds, sport rotation. Expands what to research — never softens min_EV or invents p_model.",
  },
  {
    chip: "EV-RELAX",
    meaning:
      "temp_ev_relax (Mechanism B): safety net ControlSignal on large empty-queue boards. ≤2pp min_EV soften + stake ×0.80, TTL 24h. Never stack over process_gate; never hand-lower min_EV.",
  },
  {
    chip: "Phase 1A+",
    meaning:
      "Hybrid half-steps (1A+/1B+…). Display phase may be half-step; hard gates inherit parent (phase_hard_id). Progress bar = progress_inside_phase from engine.",
  },
  {
    chip: "Unit (cont.)",
    meaning:
      "Continuous unit sizing when phase_continuous is on — unit grows with equity inside the band. Ladder is fallback/diagnostic only.",
  },
  {
    chip: "Secure skim",
    meaning:
      "Variant A: soft skim at 1.25× HWM (15%), hard at 1.50× (30%). Secure bucket is non-risked. Unlock after settled threshold or manual cooldown.",
  },
];

const SKILLS: {
  slash: string;
  role: string;
  docs: string;
}[] = [
  {
    slash: "/daily-run",
    role: "Full day: results → odds → board+light → deep → recommend + chains → PLACE → place-ack",
    docs: "docs/DESK_SKILLS.md · docs/RESEARCH_WORKFLOW.md",
  },
  {
    slash: "/missed-audit",
    role: "Why mid-band (1.80–2.20) missed deep; promotion_score parts; cheapest fix",
    docs: "docs/DESK_SKILLS.md · docs/RESEARCH_GATES.md",
  },
  {
    slash: "/chain-explain",
    role: "Full Reasoning Chain template: context → light → promo → deep → EV → stake → decision",
    docs: "docs/DESK_SKILLS.md",
  },
  {
    slash: "/bankroll-tune",
    role: "Secure / phase / unit / regime proposal → MC + capital CLI",
    docs: "docs/CAPITAL_HYBRID_PROGRESSION.md · docs/BANKROLL_PLAN.md",
  },
  {
    slash: "/learning-rootcause",
    role: "Taxonomy + learning_weight + ControlSignals; settlement backfill",
    docs: "docs/SETTLEMENT_LEARNING.md · AGENTS.md",
  },
];

const KEY_SECTIONS: { title: string; rows: { keys: string[]; action: string }[] }[] =
  [
    {
      title: "Workspaces",
      rows: [
        { keys: ["1"], action: "Desk" },
        { keys: ["2"], action: "Analyze · Performance" },
        { keys: ["3"], action: "Analyze · Calibration" },
        { keys: ["4"], action: "Ledger" },
        { keys: ["5"], action: "Research · Learnings" },
        { keys: ["6"], action: "Odds (NT board)" },
        { keys: ["7"], action: "Ops" },
        { keys: ["8"], action: "Research · Evidence" },
        { keys: ["9"], action: "Research · Agent" },
        { keys: ["0"], action: "Settings" },
        { keys: ["g", "d"], action: "Go Desk" },
        { keys: ["g", "b"], action: "Go Ledger" },
        { keys: ["g", "o"], action: "Go Odds" },
        { keys: ["g", "p"], action: "Go Analyze" },
      ],
    },
    {
      title: "Actions",
      rows: [
        { keys: ["Ctrl", "R"], action: "Refresh data" },
        { keys: ["?"], action: "Toggle this help" },
        { keys: ["Esc"], action: "Close modal / clear forensic / odds detail" },
        { keys: ["/"], action: "Focus Ledger or Odds search" },
        { keys: ["Ctrl", "K"], action: "Command palette" },
      ],
    },
    {
      title: "Forensics",
      rows: [
        { keys: ["Click chart"], action: "Drill → Ledger (bet_ids)" },
        { keys: ["Click mult row"], action: "Research → sport/band tickets" },
        { keys: ["Click edge"], action: "Open Case File ticket" },
        { keys: ["Esc"], action: "Clear forensic trail" },
      ],
    },
  ];

function ChipBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center font-mono text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded-md border border-primary/30 bg-primary/10 text-primary shrink-0">
      {children}
    </span>
  );
}

export function HelpOverlay() {
  const open = useAppStore((s) => s.helpOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const [tab, setTab] = useState<TabId>("flow");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setHelpOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            aria-label="Close help"
            onClick={() => setHelpOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative glass-strong rounded-3xl shadow-glass-lg w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col border-primary/25"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-overlay-title"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <BookOpen className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h2
                    id="help-overlay-title"
                    className="font-semibold tracking-tight"
                  >
                    2026 desk flow
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    ~2 min orientation · engines in nt/ remain law
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setHelpOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1 px-4 pt-3 pb-1 border-b border-border/40">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto p-5 flex-1 min-h-0">
              {tab === "flow" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Operator loop for a capital day. Prefer Grok{" "}
                    <code className="text-primary text-[11px] font-mono bg-primary/10 px-1 rounded">
                      /daily-run
                    </code>{" "}
                    (agent owns the full CLI map). UI surfaces Desk, Shortlist,
                    Ops, and Case File — no separate Day-start checklist.
                  </p>
                  <ol className="space-y-2">
                    {DAILY_FLOW.map((row, i) => (
                      <li
                        key={row.step}
                        className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                      >
                        <span className="h-6 w-6 rounded-lg bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold tracking-tight">
                            {row.step}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {row.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="text-[11px] text-muted-foreground">
                    UI path: Desk · Shortlist · Ops Board/Recommend/Settle · Odds
                    · Case File. Never invent p_model, equity, or hand-softened
                    min_EV.
                  </p>
                </div>
              )}

              {tab === "chips" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Capital strip (DeskStrip) + research surfaces. Values come
                    from engine JSON only — UI never invents caps or units.
                  </p>
                  <ul className="space-y-2">
                    {DESK_CHIPS.map((row) => (
                      <li
                        key={row.chip}
                        className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                      >
                        <ChipBadge>{row.chip}</ChipBadge>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {row.meaning}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    Also on strip: Equity · Liquid · Open risk · DD% · Regime
                    (Exploration→Survival→Normal) · Mode (NORMAL/REDUCED/FROZEN)
                    · Can bet.
                  </p>
                </div>
              )}

              {tab === "skills" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    User-scope Grok skills under{" "}
                    <code className="text-[11px] font-mono bg-muted px-1 rounded">
                      ~/.grok/skills/
                    </code>
                    . Repo pointer: tracker{" "}
                    <code className="text-[11px] font-mono bg-muted px-1 rounded">
                      docs/DESK_SKILLS.md
                    </code>{" "}
                    + root AGENTS.md. Skills encode workflows; engines stay law.
                  </p>
                  <ul className="space-y-2">
                    {SKILLS.map((s) => (
                      <li
                        key={s.slash}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-mono font-semibold text-primary">
                            {s.slash}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {s.role}
                        </p>
                        <p className="text-[11px] text-muted-foreground/90 inline-flex items-start gap-1.5">
                          <Link2 className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
                          <span>
                            Tracker docs:{" "}
                            <span className="font-mono text-[10px]">
                              {s.docs}
                            </span>
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    PowerShell (tracker root):{" "}
                    <code className="font-mono">.\scripts\skill_list.ps1</code>{" "}
                    ·{" "}
                    <code className="font-mono">
                      .\scripts\skill_invoke.ps1 daily-run
                    </code>
                  </p>
                </div>
              )}

              {tab === "learn" && (
                <div className="space-y-4">
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold tracking-tight">
                      Reasoning chain · Simple Mode
                    </h3>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-muted-foreground leading-relaxed space-y-2">
                      <p>
                        <strong className="text-foreground">
                          Engine SSOT (when present):
                        </strong>{" "}
                        <code className="font-mono text-[10px] bg-muted px-1 rounded">
                          data/state/reasoning_chains.jsonl
                        </code>{" "}
                        — context → light → promo → deep → EV → stake →
                        decision. Snapshot field{" "}
                        <code className="font-mono text-[10px]">
                          reasoning_chains
                        </code>{" "}
                        is tolerated when the loader ships it.
                      </p>
                      <p>
                        <strong className="text-foreground">
                          Simple Mode (progressive disclosure):
                        </strong>{" "}
                        default on in Settings. One-line verdict + traffic light
                        (green / amber / red / gray) + Why this / Why not, then
                        expand full chain (line · light+promo · sources ·
                        p_model · haircut EV · stake · ControlSignals). Wired on{" "}
                        <strong className="text-foreground">Case File</strong>{" "}
                        section 0, Shortlist card expand, optional DeskStrip RC
                        chip, and Near-miss / Rejected list. Engine SSOT only —
                        do not invent haircut EV from notes. Also{" "}
                        <code className="font-mono text-[10px]">
                          /chain-explain
                        </code>
                        .
                      </p>
                      <p>
                        Do not synthesize haircut formulas from recovered notes
                        EV when chain SSOT is missing.
                      </p>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold tracking-tight">
                      Learning taxonomy
                    </h3>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-muted-foreground leading-relaxed space-y-2">
                      <p>
                        Every settle should classify{" "}
                        <strong className="text-foreground">
                          predictability
                        </strong>{" "}
                        (how knowable at research time) and{" "}
                        <strong className="text-foreground">
                          variance_class
                        </strong>{" "}
                        (systematic miss vs one-off luck). Engine computes{" "}
                        <code className="font-mono text-[10px]">
                          learning_weight = clamp(base × pred_mult, 0, 1)
                        </code>
                        .
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>
                          <strong className="text-foreground">
                            High weight
                          </strong>{" "}
                          (process miss / systematic script) → mults move;
                          temp_gate may fire.
                        </li>
                        <li>
                          <strong className="text-foreground">
                            Near-zero weight
                          </strong>{" "}
                          (true randomness / one-off injury-ref) → barely moves
                          learnings; no process gate on noise.
                        </li>
                      </ul>
                      <p>
                        Predictability down-weights even “systematic” labels when
                        the outcome was weakly knowable. See tracker{" "}
                        <code className="font-mono text-[10px]">
                          docs/SETTLEMENT_LEARNING.md
                        </code>{" "}
                        and skill{" "}
                        <code className="font-mono text-[10px]">
                          /learning-rootcause
                        </code>
                        .
                      </p>
                    </div>
                  </section>
                </div>
              )}

              {tab === "keys" && (
                <div className="grid sm:grid-cols-2 gap-6">
                  {KEY_SECTIONS.map((sec) => (
                    <div key={sec.title}>
                      <div className="section-label mb-2">{sec.title}</div>
                      <ul className="space-y-1.5">
                        {sec.rows.map((row) => (
                          <li
                            key={row.action + row.keys.join("+")}
                            className="flex items-center justify-between gap-3 text-sm py-1"
                          >
                            <span className="text-muted-foreground text-xs">
                              {row.action}
                            </span>
                            <span className="inline-flex items-center gap-1 shrink-0">
                              {row.keys.map((k) => (
                                <Kbd key={k}>{k}</Kbd>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border/60 text-[11px] text-muted-foreground flex flex-wrap justify-between gap-2">
              <span>
                Press <Kbd>?</Kbd> anytime · TopBar help · Ctrl+K → Help
              </span>
              <span>Code is law · UI only presents</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
