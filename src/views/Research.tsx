import type { ReactNode } from "react";
import { Bot, FileSearch, GraduationCap, ListChecks } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { cn } from "@/lib/utils";
import { LearningsPanel } from "@/views/Learnings";
import { EvidencePanel } from "@/views/Evidence";
import { Agent } from "@/views/Agent";
import { ShortlistBoard } from "@/components/research/ShortlistBoard";

type ResearchTab = "shortlist" | "learnings" | "evidence" | "agent";

/**
 * Research workspace — Shortlist · Learnings · Evidence · Agent
 */
export function Research() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const filters = useDataStore((s) => s.filters);

  const tab: ResearchTab =
    view === "evidence"
      ? "evidence"
      : view === "agent"
        ? "agent"
        : view === "learnings"
          ? "learnings"
          : "shortlist";

  const forensicActive =
    (filters.betIds?.length || 0) > 0 ||
    (filters.forensicTrail?.length || 0) > 0;

  return (
    <div className="page-shell !max-w-[1720px] !space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">Research</h1>
          <p className="page-subtitle">
            Ranked shortlist · multipliers · evidence · agent
            {forensicActive && (
              <span className="text-primary"> · forensic active</span>
            )}
          </p>
        </div>

        <div className="flex rounded-xl border border-white/[0.1] bg-black/40 p-1 shrink-0 flex-wrap gap-0.5 shadow-inner">
          <TabButton
            active={tab === "shortlist"}
            onClick={() => setView("shortlist")}
            icon={<ListChecks className="h-3.5 w-3.5" />}
            label="Shortlist"
          />
          <TabButton
            active={tab === "learnings"}
            onClick={() => setView("learnings")}
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            label="Learnings"
          />
          <TabButton
            active={tab === "evidence"}
            onClick={() => setView("evidence")}
            icon={<FileSearch className="h-3.5 w-3.5" />}
            label="Evidence"
          />
          <TabButton
            active={tab === "agent"}
            onClick={() => setView("agent")}
            icon={<Bot className="h-3.5 w-3.5" />}
            label="Agent"
          />
        </div>
      </div>

      {tab === "shortlist" && <ShortlistBoard />}
      {tab === "learnings" && <LearningsPanel />}
      {tab === "evidence" && <EvidencePanel />}
      {tab === "agent" && (
        <div className="-mx-0">
          <Agent embedded />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors min-h-[40px]",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
