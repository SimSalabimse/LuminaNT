import { motion } from "framer-motion";
import { cn, formatNokPlain, formatPct, plColor } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "profit" | "loss" | "accent" | "warn" | "violet";
  delay?: number;
  onClick?: () => void;
}

const toneOrb: Record<string, string> = {
  default: "from-primary/30 via-primary/10 to-transparent",
  profit: "from-profit/35 via-profit/10 to-transparent",
  loss: "from-loss/35 via-loss/10 to-transparent",
  accent: "from-accent/35 via-accent/10 to-transparent",
  warn: "from-pending/35 via-pending/10 to-transparent",
  violet: "from-violet/35 via-violet/10 to-transparent",
};

const toneIcon: Record<string, string> = {
  default: "text-primary border-primary/20 bg-primary/10",
  profit: "text-profit border-profit/20 bg-profit/10",
  loss: "text-loss border-loss/20 bg-loss/10",
  accent: "text-accent border-accent/20 bg-accent/10",
  warn: "text-pending border-pending/20 bg-pending/10",
  violet: "text-violet border-violet/20 bg-violet/10",
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  delay = 0,
  onClick,
}: MetricCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "metric-card text-left w-full",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div
        className={cn(
          "absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl opacity-60 pointer-events-none",
          toneOrb[tone]
        )}
      />
      <div className="flex items-center justify-between gap-2 relative">
        <span className="section-label">{label}</span>
        {Icon && (
          <div
            className={cn(
              "h-8 w-8 rounded-xl border flex items-center justify-center",
              toneIcon[tone]
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="mt-3 text-[1.65rem] font-bold tracking-tight tabular-nums relative leading-none">
        {value}
      </div>
      {hint && (
        <div className="mt-2 text-xs text-muted-foreground relative leading-snug">
          {hint}
        </div>
      )}
    </motion.button>
  );
}

export function equityTone(n: number): MetricCardProps["tone"] {
  if (n > 0) return "profit";
  if (n < 0) return "loss";
  return "default";
}

export function formatEquity(n: number) {
  return `${formatNokPlain(n)} NOK`;
}

export function formatSignedPl(n: number) {
  return (
    <span className={plColor(n)}>
      {n > 0 ? "+" : ""}
      {formatNokPlain(n)} NOK
    </span>
  );
}

export function formatRoi(n: number) {
  return formatPct(n);
}
