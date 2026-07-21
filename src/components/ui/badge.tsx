import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/15 text-primary",
        secondary:
          "border-white/[0.06] bg-secondary/80 text-secondary-foreground",
        outline: "text-foreground border-white/[0.1]",
        accent: "border-accent/30 bg-accent/15 text-accent",
        violet: "border-violet/30 bg-violet/15 text-violet",
        success: "border-profit/25 bg-profit/12 text-profit",
        warning: "border-pending/30 bg-pending/12 text-pending",
        loss: "border-loss/30 bg-loss/12 text-loss",
        // aliases kept for existing call sites
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
