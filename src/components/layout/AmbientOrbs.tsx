/**
 * Minimal ambient depth — almost none. Data and chrome must win.
 */
export function AmbientOrbs() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute -top-40 left-0 h-[20rem] w-[20rem] rounded-full bg-primary/[0.025] blur-[120px]" />
    </div>
  );
}
