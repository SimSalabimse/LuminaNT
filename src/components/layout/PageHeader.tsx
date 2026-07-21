import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

/** Consistent page chrome across all LuminaNT views. */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
  badge,
}: PageHeaderProps) {
  return (
    <header className={cn("page-header", className)}>
      <div className="min-w-0 flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{title}</h1>
            {badge}
          </div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
