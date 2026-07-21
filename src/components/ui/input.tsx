import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-sm",
      "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition-all duration-200",
      "placeholder:text-muted-foreground/70",
      "focus-ring focus:border-primary/40 focus:bg-white/[0.04] focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
