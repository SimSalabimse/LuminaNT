import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-premium focus-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-110",
        secondary:
          "bg-secondary/90 text-secondary-foreground border border-white/[0.05] hover:bg-secondary hover:border-white/[0.08]",
        outline:
          "border border-white/[0.08] bg-white/[0.02] hover:bg-secondary/70 hover:border-primary/35",
        ghost: "hover:bg-white/[0.05] text-muted-foreground hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110",
        glow: "bg-primary text-primary-foreground font-semibold hover:brightness-110",
        violet:
          "bg-violet/20 text-violet border border-violet/30 hover:bg-violet/30",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[40px]",
        sm: "h-9 rounded-lg px-3.5 text-xs min-h-[36px]",
        lg: "h-11 rounded-xl px-6 text-[15px] min-h-[44px]",
        icon: "h-10 w-10 min-h-[40px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
