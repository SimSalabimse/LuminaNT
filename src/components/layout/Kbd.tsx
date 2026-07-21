import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

export function KbdHint({
  keys,
  label,
}: {
  keys: string[];
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-0.5">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
