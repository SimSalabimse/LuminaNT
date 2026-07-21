import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-10 w-full min-h-[40px] rounded-xl border border-white/15 bg-secondary/70 px-3 py-2 text-sm text-foreground",
      "transition-colors duration-150",
      "placeholder:text-muted-foreground",
      "focus-ring focus:border-primary/50 focus:bg-secondary focus:ring-2 focus:ring-primary/20",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "[&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
      "[&::-webkit-calendar-picker-indicator]:invert-[0.85]",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
