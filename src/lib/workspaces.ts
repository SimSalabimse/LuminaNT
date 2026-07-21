/**
 * Forensic Desk Triad — workspace IA for LuminaNT.
 * Views map into workspaces (+ system/settings).
 */
import type { ViewId } from "@/types";

export type WorkspaceId =
  | "desk"
  | "analyze"
  | "ledger"
  | "odds"
  | "ops"
  | "research"
  | "system";

export type FilterScope = "full" | "filtered";

export type WorkspaceDef = {
  id: WorkspaceId;
  label: string;
  blurb: string;
  /** Primary sub-view when selecting the workspace tab */
  defaultView: ViewId;
  /** Sub-views shown in sidebar under this workspace */
  views: ViewId[];
  /** Keyboard digit for primary view */
  key?: string;
};

export const WORKSPACES: WorkspaceDef[] = [
  {
    id: "desk",
    label: "Desk",
    blurb: "Risk · pending · pulse",
    defaultView: "dashboard",
    views: ["dashboard"],
    key: "1",
  },
  {
    id: "analyze",
    label: "Analyze",
    blurb: "Performance · calibration",
    defaultView: "performance",
    views: ["performance", "calibration"],
    key: "2",
  },
  {
    id: "ledger",
    label: "Ledger",
    blurb: "Bets · case files",
    defaultView: "bets",
    views: ["bets"],
    key: "4",
  },
  {
    id: "odds",
    label: "Odds",
    blurb: "NT Oddsen board",
    defaultView: "odds",
    views: ["odds"],
    key: "6",
  },
  {
    id: "research",
    label: "Research",
    blurb: "Shortlist · learnings · packs",
    defaultView: "shortlist",
    views: ["shortlist", "learnings", "evidence", "agent"],
    key: "5",
  },
  {
    id: "ops",
    label: "Ops",
    blurb: "Plan · CLI · place slips",
    defaultView: "capital",
    views: ["capital", "workflow"],
    key: "7",
  },
];

export const SYSTEM_VIEWS: ViewId[] = ["settings"];

export const VIEW_META: Record<
  ViewId,
  { label: string; blurb: string; workspace: WorkspaceId }
> = {
  dashboard: { label: "Desk", blurb: "Risk · pending · equity pulse", workspace: "desk" },
  performance: {
    label: "Performance",
    blurb: "Charts · forensic drill",
    workspace: "analyze",
  },
  calibration: {
    label: "Calibration",
    blurb: "p_model reliability",
    workspace: "analyze",
  },
  bets: { label: "Ledger", blurb: "Bets · case files", workspace: "ledger" },
  odds: {
    label: "Odds",
    blurb: "Collected NT Oddsen lines",
    workspace: "odds",
  },
  workflow: { label: "CLI", blurb: "Commands · place slips", workspace: "ops" },
  plans: { label: "Plan", blurb: "Bankroll rules · rooms", workspace: "ops" },
  capital: {
    label: "Plan",
    blurb: "Bankroll · rooms · freeze",
    workspace: "ops",
  },
  shortlist: {
    label: "Shortlist",
    blurb: "Ranked place cards · outcomes",
    workspace: "research",
  },
  learnings: {
    label: "Learnings",
    blurb: "Multipliers · lessons",
    workspace: "research",
  },
  evidence: { label: "Evidence", blurb: "Research packs", workspace: "research" },
  agent: { label: "Agent", blurb: "AI analysis", workspace: "research" },
  settings: { label: "Settings", blurb: "Repo · preferences", workspace: "system" },
};

export function workspaceOfView(view: ViewId): WorkspaceId {
  return VIEW_META[view]?.workspace ?? "desk";
}

export function workspaceDef(id: WorkspaceId): WorkspaceDef | undefined {
  return WORKSPACES.find((w) => w.id === id);
}

export function defaultViewForWorkspace(id: WorkspaceId): ViewId {
  if (id === "system") return "settings";
  return workspaceDef(id)?.defaultView ?? "dashboard";
}
