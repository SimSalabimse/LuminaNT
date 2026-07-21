/**
 * Subtle ambient depth only — Phase 1 visual discipline.
 * No large animated aurora; data/chrome must win over decoration.
 */
export function AmbientOrbs() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute -top-48 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/[0.06] blur-[100px]" />
      <div className="absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-violet/[0.05] blur-[90px]" />
    </div>
  );
}
