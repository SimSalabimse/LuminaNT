import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  WORKSPACES,
  workspaceOfView,
  type WorkspaceId,
} from "@/lib/workspaces";

/**
 * Primary workspace switcher — Desk | Analyze | Ledger | Ops | Research
 */
export function WorkspaceTabs() {
  const view = useAppStore((s) => s.view);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const active = workspaceOfView(view);

  // Settings / system: still show tabs but none active as "system"
  const show = active !== "system" || true;

  if (!show) return null;

  return (
    <div className="shrink-0 border-b border-white/[0.05] px-4 pt-2 pb-0 bg-background/40">
      <div className="flex items-end gap-1 overflow-x-auto">
        {WORKSPACES.map((ws) => {
          const isActive = active === ws.id;
          return (
            <button
              key={ws.id}
              type="button"
              onClick={() => setWorkspace(ws.id as WorkspaceId)}
              className={cn(
                "relative px-3.5 py-2 text-sm font-medium tracking-tight rounded-t-lg transition-colors shrink-0",
                isActive
                  ? "text-primary bg-primary/[0.08]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
              )}
            >
              <span className="flex items-center gap-2">
                {ws.label}
                {ws.key && (
                  <span
                    className={cn(
                      "text-[10px] font-mono opacity-40 hidden sm:inline",
                      isActive && "opacity-60"
                    )}
                  >
                    {ws.key}
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
