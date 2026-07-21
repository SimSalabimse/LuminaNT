import { useMemo, useState, useCallback, useId, useRef, useEffect } from "react";
import type { EquityPoint } from "@/types";
import { cn } from "@/lib/utils";
import { palette } from "@/lib/palette";

interface Props {
  points: EquityPoint[];
  height?: number;
  className?: string;
}

type Pt = { x: number; y: number };

/** Classic Catmull-Rom sample at t∈[0,1] on segment p1→p2 */
function crPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** High-res organic path via Catmull-Rom sampling (silk-smooth, not angular) */
function sampleCatmullRom(pts: Pt[], samplesPerSeg = 14): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [pts[0]];
  if (pts.length === 2) {
    const out: Pt[] = [];
    for (let s = 0; s <= samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      out.push({
        x: pts[0].x + (pts[1].x - pts[0].x) * t,
        y: pts[0].y + (pts[1].y - pts[0].y) * t,
      });
    }
    return out;
  }
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSeg; s++) {
      out.push(crPoint(p0, p1, p2, p3, s / samplesPerSeg));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function pathFrom(pts: Pt[]): string {
  if (!pts.length) return "";
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  }
  return d;
}

/** Approximate parallel offset for ribbon thickness */
function offsetPath(pts: Pt[], dist: number): Pt[] {
  if (pts.length < 2) return pts;
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    // normal
    return { x: p.x - dy * dist, y: p.y + dx * dist };
  });
}

function areaFrom(linePts: Pt[], floorY: number, leftX: number): string {
  if (!linePts.length) return "";
  const last = linePts[linePts.length - 1];
  return `${pathFrom(linePts)} L ${last.x.toFixed(2)} ${floorY.toFixed(2)} L ${leftX.toFixed(2)} ${floorY.toFixed(2)} Z`;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function FluidPlChart({ points, height = 380, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [box, setBox] = useState({ w: 900, h: height });
  const rootRef = useRef<HTMLDivElement>(null);
  const pad = { t: 24, r: 20, b: 34, l: 50 };

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) {
        setBox({
          w: Math.max(240, cr.width),
          h: Math.max(140, cr.height || height),
        });
      }
    });
    ro.observe(node);
    setBox({
      w: Math.max(240, node.clientWidth || 900),
      h: Math.max(140, node.clientHeight || height),
    });
    return () => ro.disconnect();
  }, [height]);

  const model = useMemo(() => {
    if (!points.length) return null;
    const w = box.w;
    const h = box.h;
    const innerW = Math.max(48, w - pad.l - pad.r);
    const innerH = Math.max(48, h - pad.t - pad.b);

    const ys = points.map((p) => p.cumulativePl);
    let minY = Math.min(...ys, 0);
    let maxY = Math.max(...ys, 0);
    const span = maxY - minY || 1;
    // Fill the frame — bold amplitude
    minY -= span * 0.06;
    maxY += span * 0.08;
    const ySpan = maxY - minY;

    const anchors: Pt[] = points.map((p, i) => {
      const x =
        pad.l +
        (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
      const y = pad.t + innerH - ((p.cumulativePl - minY) / ySpan) * innerH;
      return { x, y };
    });

    // High-res organic samples (this is what makes it feel premium)
    const samples = sampleCatmullRom(anchors, points.length < 20 ? 18 : 12);
    const line = pathFrom(samples);
    const floorY = pad.t + innerH;
    const area = areaFrom(samples, floorY, pad.l);

    // Soft under-ribbon (same cyan family, offset down)
    const under = offsetPath(samples, 10).map((p) => ({
      x: p.x,
      y: p.y + innerH * 0.04,
    }));
    const underLine = pathFrom(under);
    const underArea = areaFrom(under, floorY, pad.l);

    // Slight upper highlight track
    const upper = offsetPath(samples, -3);

    const zeroY =
      minY <= 0 && maxY >= 0
        ? pad.t + innerH - ((0 - minY) / ySpan) * innerH
        : null;

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = minY + (ySpan * i) / ticks;
      const y = pad.t + innerH - ((v - minY) / ySpan) * innerH;
      return { v, y };
    });

    const xLabels: { i: number; x: number; text: string }[] = [];
    const step = Math.max(1, Math.ceil(points.length / 6));
    for (let i = 0; i < points.length; i += step) {
      xLabels.push({ i, x: anchors[i].x, text: points[i].date.slice(5) });
    }
    if (points.length > 1) {
      const lastI = points.length - 1;
      if (xLabels[xLabels.length - 1]?.i !== lastI) {
        xLabels.push({
          i: lastI,
          x: anchors[lastI].x,
          text: points[lastI].date.slice(5),
        });
      }
    }

    // Ambient orb position near peak of last third
    const midStart = Math.floor(samples.length * 0.45);
    let peakIdx = midStart;
    let peakY = Infinity;
    for (let i = midStart; i < samples.length; i++) {
      if (samples[i].y < peakY) {
        peakY = samples[i].y;
        peakIdx = i;
      }
    }
    const peak = samples[peakIdx] ?? samples[samples.length - 1];
    const last = anchors[anchors.length - 1];
    const lastCum = points[points.length - 1]?.cumulativePl ?? 0;

    return {
      anchors,
      samples,
      line,
      area,
      underLine,
      underArea,
      upperPath: pathFrom(upper),
      yTicks,
      xLabels,
      lastCum,
      positive: lastCum >= 0,
      zeroY,
      innerH,
      peak,
      last,
    };
  }, [points, box.w, box.h]);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!model || points.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = box.w / Math.max(1, rect.width);
      const x = (e.clientX - rect.left) * scaleX;
      let best = 0;
      let bestD = Infinity;
      model.anchors.forEach((c, i) => {
        const d = Math.abs(c.x - x);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      setHover(best);
    },
    [model, points.length, box.w]
  );

  if (!points.length) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground rounded-2xl",
          className
        )}
        style={{ height }}
      >
        No settled P/L yet — equity curve appears after settlements.
      </div>
    );
  }

  const hp = hover != null ? points[hover] : null;
  const hc = hover != null && model ? model.anchors[hover] : null;
  const glowCore = model?.positive !== false ? palette.profit : palette.loss;
  const glowIce = model?.positive !== false ? palette.accent : "#FF8A95";
  const clientW = rootRef.current?.clientWidth || box.w;
  const clientH = rootRef.current?.clientHeight || box.h;

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full select-none overflow-hidden", className)}
      style={{ height }}
    >
      {/* Minimal depth wash — no luminous orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#070c16]/50 to-transparent" />
      </div>

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${box.w} ${box.h}`}
        preserveAspectRatio="none"
        className="relative z-[1]"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* Deep God gold stroke — antique → rich gold → warm highlight */}
          <linearGradient id={`${uid}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B6914" />
            <stop offset="18%" stopColor="#A67C1A" />
            <stop offset="40%" stopColor="#C9A227" />
            <stop offset="65%" stopColor="#D4B04A" />
            <stop offset="88%" stopColor="#E0B83A" />
            <stop offset="100%" stopColor="#E8C86A" />
          </linearGradient>

          <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E0B83A" stopOpacity="0.36" />
            <stop offset="12%" stopColor="#C9A227" stopOpacity="0.28" />
            <stop offset="30%" stopColor="#C9A227" stopOpacity="0.14" />
            <stop offset="52%" stopColor="#A67C1A" stopOpacity="0.07" />
            <stop offset="75%" stopColor="#6B5210" stopOpacity="0.025" />
            <stop offset="100%" stopColor="#070c16" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={`${uid}-fill-glow`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E8C86A" stopOpacity="0.18" />
            <stop offset="25%" stopColor="#C9A227" stopOpacity="0.1" />
            <stop offset="60%" stopColor="#E0B83A" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#070c16" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={`${uid}-under`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D4B04A" stopOpacity="0.08" />
            <stop offset="40%" stopColor="#C9A227" stopOpacity="0.035" />
            <stop offset="100%" stopColor="#070c16" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={`${uid}-edge-mask`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0.25" />
            <stop offset="4%" stopColor="white" stopOpacity="1" />
            <stop offset="96%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0.4" />
          </linearGradient>
          <mask id={`${uid}-edge`}>
            <rect
              x="0"
              y="0"
              width={box.w}
              height={box.h}
              fill={`url(#${uid}-edge-mask)`}
            />
          </mask>

          {/* Bloom filters — present but controlled */}
          <filter id={`${uid}-bloom-xl`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="16" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="0 0 0 0 0.79
                      0 0 0 0 0.64
                      0 0 0 0 0.15
                      0 0 0 0.5 0"
            />
          </filter>
          <filter id={`${uid}-bloom-lg`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-bloom-md`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-bloom-sm`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-point`} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid + high-contrast axis labels */}
        {model?.yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              x2={box.w - pad.r}
              y1={t.y}
              y2={t.y}
              stroke="rgba(168,182,202,0.14)"
              strokeDasharray="3 7"
            />
            <text
              x={pad.l - 8}
              y={t.y + 3.5}
              textAnchor="end"
              fill="#C8D4E6"
              fontSize="11"
              fontFamily="JetBrains Mono, ui-monospace, monospace"
              fontWeight={500}
            >
              {Math.abs(t.v) >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v.toFixed(0)}
            </text>
          </g>
        ))}

        {model?.zeroY != null && (
          <line
            x1={pad.l}
            x2={box.w - pad.r}
            y1={model.zeroY}
            y2={model.zeroY}
            stroke="rgba(123,139,163,0.18)"
            strokeWidth={1}
            strokeDasharray="2 6"
          />
        )}

        {model && (
          <g mask={`url(#${uid}-edge)`}>
            {/* Mild area fill + single precise stroke (Phase 1.1) */}
            <path d={model.area} fill={`url(#${uid}-fill)`} opacity={0.4} />
            <path
              d={model.line}
              fill="none"
              stroke={glowCore}
              strokeWidth={1.85}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* End marker */}
            <circle
              cx={model.last.x}
              cy={model.last.y}
              r={3.5}
              fill={glowCore}
              stroke="#070c16"
              strokeWidth={1.25}
            />

            {/* Hover */}
            {hc && hp && (
              <>
                <line
                  x1={hc.x}
                  x2={hc.x}
                  y1={pad.t}
                  y2={pad.t + model.innerH}
                  stroke="rgba(168,182,202,0.45)"
                  strokeDasharray="3 5"
                />
                <circle
                  cx={hc.x}
                  cy={hc.y}
                  r={4.5}
                  fill={palette.profit}
                  stroke="#070c16"
                  strokeWidth={1.5}
                  filter={`url(#${uid}-point)`}
                />
                <circle cx={hc.x} cy={hc.y} r={2} fill="#E8C86A" />
              </>
            )}
          </g>
        )}

        {model?.xLabels.map((l) => (
          <text
            key={l.i}
            x={l.x}
            y={box.h - 10}
            textAnchor="middle"
            fill="#C8D4E6"
            fontSize="11"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight={500}
          >
            {l.text}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hp && hc && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-primary/40 bg-[#070c16]/95 backdrop-blur-xl px-3.5 py-2.5 text-xs shadow-[0_16px_48px_-8px_rgba(0,0,0,0.75),0_0_32px_-4px_rgba(201,162,39,0.45)]"
          style={{
            left: Math.min(clientW - 176, Math.max(8, (hc.x / box.w) * clientW - 72)),
            top: Math.max(8, (hc.y / box.h) * clientH - 80),
          }}
        >
          <div className="font-semibold text-foreground mb-1 tracking-tight">{hp.date}</div>
          <div>
            Cum P/L:{" "}
            <span
              className={
                hp.cumulativePl >= 0
                  ? "text-profit font-semibold"
                  : "text-loss font-semibold"
              }
            >
              {hp.cumulativePl >= 0 ? "+" : ""}
              {fmt(hp.cumulativePl)} NOK
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5">
            Day {hp.pl >= 0 ? "+" : ""}
            {fmt(hp.pl)} · Equity {fmt(hp.equity)} · n={hp.bets}
          </div>
        </div>
      )}

      {/* Live end badge */}
      {model && (
        <div
          className={cn(
            "absolute right-3 top-2 rounded-lg border px-2.5 py-1 text-[11px] font-mono tabular-nums backdrop-blur-md",
            model.positive
              ? "border-primary/45 bg-primary/15 text-primary shadow-[0_0_32px_-4px_rgba(201,162,39,0.7)]"
              : "border-loss/40 bg-loss/15 text-loss shadow-[0_0_28px_-4px_rgba(255,107,122,0.5)]"
          )}
        >
          {model.lastCum >= 0 ? "+" : ""}
          {fmt(model.lastCum)} NOK
        </div>
      )}
    </div>
  );
}
