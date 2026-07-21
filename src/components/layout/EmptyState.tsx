import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "empty-state relative overflow-hidden",
        compact ? "py-8 px-4" : "py-14 px-6",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />
      <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center relative shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]">
        <Icon className="h-5 w-5 text-primary/80" strokeWidth={1.75} />
      </div>
      <div className="space-y-1 max-w-sm relative">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-1 relative">{action}</div>}
    </div>
  );
}
