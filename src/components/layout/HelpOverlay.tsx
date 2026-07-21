import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Kbd } from "@/components/layout/Kbd";
import { Button } from "@/components/ui/button";

const SECTIONS: { title: string; rows: { keys: string[]; action: string }[] }[] = [
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

export function HelpOverlay() {
  const open = useAppStore((s) => s.helpOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);

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
            className="relative glass-strong rounded-3xl shadow-glass-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border-primary/25"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Keyboard className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold tracking-tight">Keyboard & power tips</h2>
                  <p className="text-xs text-muted-foreground">
                    LuminaNT forensic desk shortcuts
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
            <div className="overflow-y-auto p-5 grid sm:grid-cols-2 gap-6">
              {SECTIONS.map((sec) => (
                <div key={sec.title}>
                  <div className="section-label mb-2">{sec.title}</div>
                  <ul className="space-y-1.5">
                    {sec.rows.map((row) => (
                      <li
                        key={row.action + row.keys.join("+")}
                        className="flex items-center justify-between gap-3 text-sm py-1"
                      >
                        <span className="text-muted-foreground text-xs">{row.action}</span>
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
            <div className="px-5 py-3 border-t border-border/60 text-[11px] text-muted-foreground flex justify-between">
              <span>
                Press <Kbd>?</Kbd> anytime
              </span>
              <span>Engines in nt/ remain law · UI only presents</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
