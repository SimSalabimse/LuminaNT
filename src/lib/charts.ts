import type { EChartsOption } from "echarts";
import type { BreakdownRow, EquityPoint } from "@/types";
import {
  chartColors,
  colorForResult,
  colorForSport,
  palette,
  withAlpha,
} from "@/lib/palette";

export { chartColors, palette } from "@/lib/palette";

/**
 * High-contrast God Desk chart chrome (Electric Gold hero).
 * Prioritize scannable labels/axes over decorative muting.
 */
export const chartText = {
  /** Axis ticks, category labels */
  label: "#C8D4E6",
  /** Strong titles / values */
  strong: "#EEF3FA",
  /** Secondary / legend */
  muted: "#A8B6CA",
  /** Empty states */
  empty: "#8B9BB0",
  /** Grid */
  grid: "rgba(168,182,202,0.16)",
};

const axisLabel = {
  color: chartText.label,
  fontSize: 12,
  fontWeight: 500 as const,
  fontFamily: "Inter, system-ui, sans-serif",
};
const axisLabelMuted = { color: chartText.muted, fontSize: 12 };
const splitLine = {
  lineStyle: { color: chartText.grid, type: "dashed" as const, width: 1 },
};
const tooltipBg = "rgba(8, 14, 26, 0.96)";
const tooltipBase = {
  backgroundColor: tooltipBg,
  borderColor: "rgba(201,162,39,0.28)",
  borderWidth: 1,
  textStyle: {
    color: chartText.strong,
    fontSize: 13,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  extraCssText:
    "backdrop-filter:blur(16px);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 0 1px rgba(201,162,39,0.14);padding:10px 14px;",
  confine: true,
};

/** Always show NOK/P/L with 2 decimals */
export function fmt2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}

function colorForPieSlice(name: string, index: number): string {
  return colorForResult(name, index);
}

/**
 * Cumulative P/L path — institutional line (Phase 1.1).
 * No ghost glow series; controlled stroke; mild fill only.
 * X-axis = match calendar date (see equityCurve note).
 */
export function fluidPlChartOption(points: EquityPoint[]): EChartsOption {
  if (!points.length) {
    return {
      title: {
        text: "No settled P/L yet",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }
  const ys = points.map((p) => +Number(p.cumulativePl).toFixed(2));
  const last = ys[ys.length - 1] ?? 0;
  const lineColor = last >= 0 ? chartColors.profit : chartColors.loss;
  // High-water mark of cumulative P/L
  let hwm = -Infinity;
  const hwmSeries = ys.map((y) => {
    hwm = Math.max(hwm, y);
    return +hwm.toFixed(2);
  });

  return {
    animationDuration: 600,
    animationEasing: "cubicOut",
    backgroundColor: "transparent",
    grid: { left: 52, right: 20, top: 36, bottom: 36, containLabel: false },
    legend: {
      data: ["Cum P/L", "HWM"],
      top: 0,
      right: 8,
      textStyle: { color: chartText.muted, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 2,
    },
    tooltip: {
      trigger: "axis",
      ...tooltipBase,
      axisPointer: {
        type: "cross",
        crossStyle: { color: "rgba(148,163,184,0.4)" },
        lineStyle: { color: "rgba(168,182,202,0.35)", width: 1, type: "dashed" },
      },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = p as any;
        const pt = points[d.dataIndex];
        if (!pt) return "";
        const cum = pt.cumulativePl;
        return `<div style="font-weight:600;margin-bottom:4px">${pt.date}</div>
          <div style="font-size:11px;color:${chartText.muted};margin-bottom:6px">settlement day (Europe/Oslo)</div>
          Cum P/L: <b style="color:${cum >= 0 ? chartColors.profit : chartColors.loss}">${cum >= 0 ? "+" : ""}${fmt2(cum)} NOK</b><br/>
          Day P/L: <b style="color:${pt.pl >= 0 ? chartColors.profit : chartColors.loss}">${pt.pl >= 0 ? "+" : ""}${fmt2(pt.pl)}</b><br/>
          Equity: ${fmt2(pt.equity)} · Bets: ${pt.bets}`;
      },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.date),
      boundaryGap: false,
      axisLabel: { ...axisLabel, hideOverlap: true, color: chartText.label },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitNumber: 5,
      axisLabel: {
        ...axisLabel,
        color: chartText.label,
        formatter: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : fmt2(v)),
      },
      splitLine: {
        lineStyle: { color: "rgba(148,163,184,0.12)", type: "dashed", width: 1 },
      },
      axisLine: { show: false },
    },
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
    series: [
      {
        name: "HWM",
        type: "line",
        data: hwmSeries,
        showSymbol: false,
        smooth: false,
        lineStyle: {
          width: 1,
          type: "dashed",
          color: "rgba(168,182,202,0.55)",
        },
        z: 1,
      },
      {
        name: "Cum P/L",
        type: "line",
        smooth: 0.08,
        showSymbol: points.length < 36,
        symbolSize: 3.5,
        data: ys,
        lineStyle: {
          width: 1.75,
          color: lineColor,
        },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(lineColor, 0.08) },
              { offset: 1, color: "rgba(6,10,18,0)" },
            ],
          },
        },
        emphasis: {
          lineStyle: { width: 2 },
        },
        z: 2,
      },
    ],
  };
}

/** Horizontal stacked-style open risk by sport (single series bar for density). */
/**
 * Open-risk by sport — horizontal bars.
 * Tuned for sparse desks (1–3 sports): readable labels, NOK units, room for
 * value labels, no full-bleed single-cell stretch in wide/fullscreen layouts.
 */
export function openRiskBySportOption(
  rows: { sport: string; stake: number; n: number }[]
): EChartsOption {
  if (!rows.length) {
    return {
      title: {
        text: "No open risk",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }
  // Largest stake on top for scan order
  const data = [...rows].sort((a, b) => a.stake - b.stake);
  const maxStake = Math.max(...data.map((r) => r.stake), 1);
  // Headroom so right-side labels never clip (especially fullscreen wide panes)
  const xMax = maxStake * 1.28;

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    grid: {
      left: 8,
      right: 12,
      top: 8,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      ...tooltipBase,
      axisPointer: { type: "shadow" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const i = p?.dataIndex ?? 0;
        const r = data[i];
        if (!r) return "";
        return `<b>${r.sport}</b><br/>Open stake: <b>${fmt2(r.stake)} NOK</b><br/>${r.n} ticket(s)`;
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: xMax,
      axisLabel: {
        ...axisLabel,
        fontSize: 11,
        formatter: (v: number) => `${fmt2(v)}`,
      },
      splitLine,
      name: "NOK",
      nameTextStyle: { color: chartText.muted, fontSize: 11, padding: [0, 0, 0, 4] },
      nameLocation: "end",
    },
    yAxis: {
      type: "category",
      data: data.map((r) => r.sport),
      axisLabel: {
        ...axisLabel,
        fontSize: 13,
        fontWeight: 600,
        color: chartText.strong,
        // Full sport name — wider than old 80px truncate
        width: 120,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: data.map((r) => ({
          value: +r.stake.toFixed(2),
          itemStyle: {
            color: colorForSport(r.sport),
            borderRadius: [0, 6, 6, 0],
          },
        })),
        // Cap bar thickness so 1 sport never becomes a fullscreen slab
        barMaxWidth: 32,
        barMinHeight: 4,
        label: {
          show: true,
          position: "right" as const,
          color: chartText.strong,
          fontSize: 12,
          fontWeight: 600,
          formatter: (p: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const v = Number((p as any)?.value ?? 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const i = Number((p as any)?.dataIndex ?? 0);
            const n = data[i]?.n ?? 0;
            return `${fmt2(v)} NOK · ${n}t`;
          },
        },
      },
    ],
  };
}

/** Short status labels for heatmap axis (ConfirmedPlaced → Confirmed). */
function shortOpenStatus(status: string): string {
  const r = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (r === "confirmedplaced") return "Confirmed";
  if (r === "pending") return "Pending";
  return status || "—";
}

/**
 * Sport × status open-risk heatmap.
 * Sparse matrices (1 sport × 1 status) used to fill the whole pane as one
 * unreadable gold slab — cell labels now use high-contrast type, status axis
 * uses short names, and visualMap sits right (not under the chart).
 */
export function riskHeatmapOption(
  matrix: {
    sports: string[];
    statuses: string[];
    cells: Array<{ sport: string; status: string; stake: number; n: number }>;
  }
): EChartsOption {
  if (!matrix.cells.length) {
    return {
      title: {
        text: "No open risk",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }
  const statusLabels = matrix.statuses.map(shortOpenStatus);
  const data = matrix.cells.map((c) => [
    matrix.statuses.indexOf(c.status),
    matrix.sports.indexOf(c.sport),
    +c.stake.toFixed(2),
    c.n,
  ]);
  const maxS = Math.max(...matrix.cells.map((c) => c.stake), 1);
  const sparse = matrix.sports.length <= 2 && matrix.statuses.length <= 2;

  return {
    backgroundColor: "transparent",
    animationDuration: 280,
    tooltip: {
      ...tooltipBase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => {
        const d = p?.data as number[] | undefined;
        if (!d) return "";
        const status = shortOpenStatus(matrix.statuses[d[0]] || "");
        const sport = matrix.sports[d[1]] || "";
        const n = d[3];
        const nPart =
          typeof n === "number" && Number.isFinite(n)
            ? ` · ${n} ticket(s)`
            : "";
        return `<b>${sport}</b> · ${status}<br/><b>${fmt2(d[2])} NOK</b>${nPart}`;
      },
    },
    // Right-side intensity scale frees bottom axis labels; containLabel keeps
    // sport names fully visible on wide/fullscreen panes.
    grid: {
      left: 8,
      right: sparse ? 72 : 88,
      top: 12,
      bottom: 8,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: statusLabels,
      axisLabel: {
        ...axisLabel,
        fontSize: 12,
        fontWeight: 600,
        color: chartText.strong,
        interval: 0,
        hideOverlap: false,
      },
      axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: matrix.sports,
      axisLabel: {
        ...axisLabel,
        fontSize: 13,
        fontWeight: 600,
        color: chartText.strong,
        width: 110,
        overflow: "truncate",
      },
      axisTick: { show: false },
      splitArea: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxS,
      calculable: false,
      orient: "vertical",
      right: 4,
      top: "middle",
      itemWidth: 10,
      itemHeight: sparse ? 64 : 96,
      text: ["High", "Low"],
      textGap: 6,
      inRange: {
        // Darker floor so empty-ish cells stay readable; gold peak for max stake
        color: ["#243044", "#6B5A1E", "#C9A227", "#F0D060"],
      },
      textStyle: { color: chartText.strong, fontSize: 11, fontWeight: 500 },
    },
    series: [
      {
        type: "heatmap",
        data,
        // Keep cells from looking like one giant fill when only 1×1
        itemStyle: {
          borderColor: "rgba(8,14,26,0.85)",
          borderWidth: 2,
          borderRadius: 4,
        },
        label: {
          show: true,
          fontSize: sparse ? 13 : 11,
          fontWeight: 700,
          // Dark on gold peak; light on dark floor — pick mid via formatter style
          color: "#0B1220",
          formatter: (p: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = (p as any)?.data as number[] | undefined;
            const v = d?.[2];
            if (v == null || !Number(v)) return "";
            const n = d?.[3];
            const stake = fmt2(Number(v));
            return n != null ? `${stake}\nNOK` : `${stake} NOK`;
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.45)",
            borderColor: "#F0D060",
            borderWidth: 2,
          },
        },
      },
    ],
  };
}

/** P2: edge decay ROI by age bucket */
export function edgeDecayOption(
  rows: Array<{ bucket: string; n: number; roi: number; pl: number }>
): EChartsOption {
  if (!rows.length) {
    return {
      title: {
        text: "No settled sample for edge decay",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 12 },
      },
    };
  }
  return {
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    tooltip: {
      trigger: "axis",
      ...tooltipBase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const i = p?.dataIndex ?? 0;
        const r = rows[i];
        if (!r) return "";
        return `<b>${r.bucket}</b><br/>ROI ${(r.roi * 100).toFixed(1)}% · n=${r.n} · P/L ${fmt2(r.pl)}`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((r) => r.bucket),
      axisLabel,
    },
    yAxis: {
      type: "value",
      axisLabel: {
        ...axisLabel,
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
      splitLine,
    },
    series: [
      {
        type: "line",
        data: rows.map((r) => r.roi),
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 2, color: "#C9A227" },
        itemStyle: { color: "#C9A227" },
        areaStyle: { color: "rgba(201,162,39,0.12)" },
      },
    ],
  };
}

/** Colorful horizontal sport P/L bars for dashboard right rail */
export function sportBreakdownOption(
  rows: BreakdownRow[],
  metric: "pl" | "count" = "pl"
): EChartsOption {
  const top = rows
    .filter((r) => r.key && r.key !== "(empty)")
    .slice(0, 8)
    .slice()
    .reverse();
  if (!top.length) {
    return {
      title: {
        text: "No sport breakdown",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 12 },
      },
    };
  }
  const values = top.map((r) =>
    metric === "pl" ? +r.pl.toFixed(2) : r.count
  );
  return {
    animationDuration: 700,
    backgroundColor: "transparent",
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const i = params?.[0]?.dataIndex;
        const r = top[i];
        if (!r) return "";
        return `<b>${r.key}</b><br/>n=${r.count} · P/L ${r.pl >= 0 ? "+" : ""}${fmt2(r.pl)} · ROI ${(r.roi * 100).toFixed(1)}%`;
      },
    },
    xAxis: {
      type: "value",
      axisLabel: { show: false },
      splitLine: { show: false },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: top.map((r) => r.key),
      axisLabel: {
        color: chartText.label,
        fontSize: 12,
        fontWeight: 600,
        width: 80,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: values.map((v, i) => {
          const sport = top[i]?.key ?? "";
          const sportHex = colorForSport(sport, i);
          const positive = v >= 0;
          // Ice Desk: cool sport tint for positive, coral for negative
          const endColor =
            metric === "count"
              ? sportHex
              : positive
                ? sportHex
                : chartColors.loss;
          const startColor = withAlpha(
            metric === "count"
              ? sportHex
              : positive
                ? chartColors.profit
                : chartColors.loss,
            0.22
          );
          return {
            value: v,
            itemStyle: {
              borderRadius: [0, 8, 8, 0],
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: startColor },
                  { offset: 1, color: endColor },
                ],
              },
              shadowBlur: 14,
              shadowColor: positive
                ? "rgba(201,162,39,0.35)"
                : "rgba(255,107,122,0.28)",
            },
          };
        }),
        barMaxWidth: 15,
        label: {
          show: true,
          position: "right",
          color: chartText.label,
          fontSize: 12,
          fontWeight: 600,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (p: any) =>
            metric === "count"
              ? String(p?.value ?? "")
              : fmt2(Number(p?.value ?? 0)),
        },
      },
    ],
  };
}

/** Compact daily P/L spark bars for heatmap-style strip */
export function heatmapSparkOption(
  cells: { date: string; pl: number; count: number }[]
): EChartsOption {
  const last = cells.slice(-28);
  if (!last.length) {
    return {
      title: {
        text: "No heatmap data",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 12 },
      },
    };
  }
  return {
    animationDuration: 600,
    backgroundColor: "transparent",
    grid: { left: 4, right: 4, top: 12, bottom: 20 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const i = p?.dataIndex ?? 0;
        const c = last[i];
        if (!c) return "";
        return `<b>${c.date}</b><br/>P/L ${c.pl >= 0 ? "+" : ""}${fmt2(c.pl)} · n=${c.count}`;
      },
    },
    xAxis: {
      type: "category",
      data: last.map((c) => c.date.slice(5)),
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      show: false,
      splitLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: last.map((c) => ({
          value: +c.pl.toFixed(2),
          itemStyle: {
            borderRadius: [3, 3, 0, 0],
            color: c.pl >= 0 ? chartColors.profit : chartColors.loss,
            opacity: 0.9,
            shadowBlur: c.pl !== 0 ? 8 : 0,
            shadowColor:
              c.pl >= 0 ? "rgba(201,162,39,0.4)" : "rgba(255,107,122,0.35)",
          },
        })),
        barMaxWidth: 11,
      },
    ],
  };
}

export function equityChartOption(
  points: EquityPoint[],
  opts?: { baseline?: number; dateModeLabel?: string; showDdBand?: boolean }
): EChartsOption {
  if (!points.length) {
    return {
      title: {
        text: "No equity points yet",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }
  const baseline = opts?.baseline;
  const dayLabel = opts?.dateModeLabel || "settlement day (Europe/Oslo)";
  const showDd = opts?.showDdBand !== false;
  const equityYs = points.map((p) => +p.equity.toFixed(2));
  const hwmYs = points.map((p, i) => {
    if (p.hwm != null) return +p.hwm.toFixed(2);
    let h = -Infinity;
    for (let j = 0; j <= i; j++) h = Math.max(h, equityYs[j]);
    return +h.toFixed(2);
  });
  const ddPctSeries = points.map((p, i) => {
    if (p.drawdownPct != null) return +(p.drawdownPct * 100).toFixed(2);
    const h = hwmYs[i];
    const eq = equityYs[i];
    return h > 0 ? +(((h - eq) / h) * 100).toFixed(2) : 0;
  });

  return {
    animationDuration: 600,
    animationEasing: "cubicOut",
    backgroundColor: "transparent",
    grid: { left: 56, right: showDd ? 44 : 20, top: 32, bottom: 48 },
    tooltip: {
      trigger: "axis",
      ...tooltipBase,
      axisPointer: {
        type: "cross",
        crossStyle: { color: "rgba(148,163,184,0.45)" },
        lineStyle: { color: "rgba(148,163,184,0.35)", type: "dashed" },
      },
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = arr[0] as any;
        const pt = points[d?.dataIndex];
        if (!pt) return "";
        const ddPct = ddPctSeries[d?.dataIndex] ?? 0;
        return `<div style="font-weight:600;margin-bottom:4px">${pt.date}</div>
          <div style="font-size:11px;color:${chartText.muted};margin-bottom:6px">${dayLabel}</div>
          Equity: <b style="color:${chartColors.profit}">${fmt2(pt.equity)} NOK</b><br/>
          Day P/L: <b style="color:${pt.pl >= 0 ? chartColors.profit : chartColors.loss}">${pt.pl >= 0 ? "+" : ""}${fmt2(pt.pl)}</b><br/>
          Cum P/L: ${pt.cumulativePl >= 0 ? "+" : ""}${fmt2(pt.cumulativePl)} · Bets: ${pt.bets}<br/>
          DD from peak: <b style="color:${ddPct > 5 ? chartColors.loss : chartText.muted}">${ddPct.toFixed(1)}%</b>`;
      },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.date),
      boundaryGap: false,
      axisLabel: { ...axisLabel, hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.22)" } },
    },
    yAxis: [
      {
        type: "value",
        name: "NOK",
        nameTextStyle: { color: chartText.muted, fontSize: 10 },
        scale: true,
        axisLabel: { ...axisLabel, formatter: (v: number) => fmt2(v) },
        splitLine,
      },
      ...(showDd
        ? [
            {
              type: "value" as const,
              name: "DD%",
              nameTextStyle: { color: chartText.muted, fontSize: 10 },
              min: 0,
              max: (v: { max: number }) => Math.max(12, Math.ceil(v.max + 2)),
              axisLabel: {
                ...axisLabel,
                formatter: (x: number) => `${x}%`,
              },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    legend: {
      data: showDd ? ["Equity", "HWM", "DD %"] : ["Equity", "HWM"],
      top: 0,
      right: 8,
      textStyle: { color: chartText.muted, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 2,
    },
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      {
        type: "slider",
        height: 14,
        bottom: 6,
        borderColor: "transparent",
        fillerColor: "rgba(148,163,184,0.12)",
        handleStyle: { color: chartText.muted },
        textStyle: { color: chartText.muted, fontSize: 11 },
      },
    ],
    series: [
      {
        name: "HWM",
        type: "line" as const,
        yAxisIndex: 0,
        data: hwmYs,
        showSymbol: false,
        smooth: false,
        lineStyle: {
          width: 1,
          type: "dashed" as const,
          color: "rgba(168,182,202,0.55)",
        },
        z: 1,
      },
      ...(showDd
        ? [
            {
              name: "DD %",
              type: "line" as const,
              yAxisIndex: 1,
              data: ddPctSeries,
              showSymbol: false,
              smooth: 0.1,
              lineStyle: {
                width: 1.25,
                color: chartColors.loss,
                opacity: 0.85,
              },
              areaStyle: {
                color: "rgba(255,107,122,0.10)",
              },
              z: 1,
            },
          ]
        : []),
      {
        name: "Equity",
        type: "line" as const,
        yAxisIndex: 0,
        smooth: 0.08,
        showSymbol: points.length < 28,
        symbolSize: 3.5,
        data: equityYs,
        lineStyle: {
          width: 1.75,
          color: chartColors.profit,
        },
        itemStyle: {
          color: chartColors.profit,
          borderColor: palette.void,
          borderWidth: 1,
        },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(201,162,39,0.07)" },
              { offset: 1, color: "rgba(7,12,22,0)" },
            ],
          },
        },
        markLine:
          baseline != null
            ? {
                silent: true,
                symbol: "none" as const,
                label: {
                  formatter: "Baseline",
                  color: chartText.label,
                  fontSize: 11,
                  fontWeight: 600 as const,
                  position: "insideEndTop" as const,
                },
                lineStyle: {
                  color: "rgba(168,182,202,0.45)",
                  type: "dashed" as const,
                  width: 1,
                },
                data: [{ yAxis: baseline }],
              }
            : undefined,
        z: 2,
      },
    ],
  };
}

export function dailyPlChartOption(
  rows: { date: string; pl: number }[]
): EChartsOption {
  if (!rows.length) {
    return {
      title: {
        text: "No daily P/L yet",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }
  return {
    animationDuration: 700,
    backgroundColor: "transparent",
    grid: { left: 52, right: 16, top: 24, bottom: 44 },
    tooltip: {
      trigger: "axis",
      ...tooltipBase,
      axisPointer: { type: "shadow" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const v = Number(p?.value ?? 0);
        const name = p?.name ?? "";
        return `<div style="font-weight:600;margin-bottom:4px">${name}</div>
          P/L: <b style="color:${v >= 0 ? chartColors.profit : chartColors.loss}">${v >= 0 ? "+" : ""}${fmt2(v)} NOK</b>
          <div style="font-size:11px;color:${chartText.muted};margin-top:4px">Click bar → tickets</div>`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((r) => r.date),
      axisLabel: { ...axisLabel, hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.22)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { ...axisLabel, formatter: (v: number) => fmt2(v) },
      splitLine,
    },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 6 }],
    series: [
      {
        type: "bar",
        data: rows.map((r) => ({
          value: +Number(r.pl).toFixed(2),
          itemStyle: {
            color:
              r.pl >= 0
                ? {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: chartColors.profit },
                      { offset: 1, color: withAlpha(chartColors.profit, 0.35) },
                    ],
                  }
                : {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: withAlpha(chartColors.loss, 0.45) },
                      { offset: 1, color: chartColors.loss },
                    ],
                  },
            borderRadius: [5, 5, 0, 0],
            shadowBlur: 10,
            shadowColor:
              r.pl >= 0
                ? "rgba(201,162,39,0.35)"
                : "rgba(255,107,122,0.32)",
          },
        })),
        barMaxWidth: 18,
      },
    ],
  };
}

export function breakdownBarOption(
  rows: BreakdownRow[],
  metric: "pl" | "count" | "roi" | "winRate" = "pl",
  title = ""
): EChartsOption {
  // Keep caller order; reverse so first row renders at the top of horizontal bars
  const top = rows.slice(0, 14).slice().reverse();
  const values = top.map((r) => {
    if (metric === "pl") return +r.pl.toFixed(2);
    if (metric === "count") return r.count;
    if (metric === "roi") return +((r.roi * 100).toFixed(1));
    return +((r.winRate * 100).toFixed(1));
  });

  // Adaptive left margin so long market names stay readable
  const maxLabelLen = Math.max(8, ...top.map((r) => r.key.length));
  const labelWidth = Math.min(200, Math.max(100, maxLabelLen * 7));
  const leftGrid = labelWidth + 16;

  return {
    animationDuration: 600,
    backgroundColor: "transparent",
    title: title
      ? { text: title, left: 0, top: 0, textStyle: { color: chartText.muted, fontSize: 12, fontWeight: 500 } }
      : undefined,
    grid: { left: leftGrid, right: 28, top: title ? 32 : 16, bottom: 28 },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderColor: "rgba(148,163,184,0.2)",
      textStyle: { color: chartText.strong },
      axisPointer: { type: "shadow" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const i = params[0]?.dataIndex;
        const r = top[i];
        if (!r) return "";
        return `<b>${r.key}</b><br/>
          n=${r.count} · W/L ${r.wins}/${r.losses}<br/>
          P/L ${r.pl >= 0 ? "+" : ""}${fmt2(r.pl)} · ROI ${(r.roi * 100).toFixed(1)}% · WR ${(r.winRate * 100).toFixed(1)}%`;
      },
    },
    xAxis: {
      type: "value",
      axisLabel: {
        ...axisLabel,
        formatter: (v: number) =>
          metric === "count" ? String(Math.round(v)) : fmt2(v),
      },
      splitLine,
    },
    yAxis: {
      type: "category",
      data: top.map((r) => r.key),
      axisLabel: {
        ...axisLabel,
        width: labelWidth,
        overflow: "truncate",
        interval: 0,
        color: chartText.strong,
        fontSize: 11,
      },
      axisTick: { show: false },
      triggerEvent: true,
    },
    series: [
      {
        type: "bar",
        data: values.map((v) => ({
          value: v,
          itemStyle: {
            color:
              metric === "count"
                ? {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 1,
                    y2: 0,
                    colorStops: [
                      { offset: 0, color: "rgba(224,184,58,0.35)" },
                      { offset: 1, color: chartColors.cyan },
                    ],
                  }
                : v >= 0
                  ? {
                      type: "linear",
                      x: 0,
                      y: 0,
                      x2: 1,
                      y2: 0,
                      colorStops: [
                        { offset: 0, color: "rgba(201,162,39,0.35)" },
                        { offset: 1, color: chartColors.profit },
                      ],
                    }
                  : {
                      type: "linear",
                      x: 0,
                      y: 0,
                      x2: 1,
                      y2: 0,
                      colorStops: [
                        { offset: 0, color: "rgba(251,113,133,0.35)" },
                        { offset: 1, color: chartColors.loss },
                      ],
                    },
            borderRadius: [0, 5, 5, 0],
            shadowBlur: 8,
            shadowColor:
              metric === "count"
                ? "rgba(224,184,58,0.25)"
                : v >= 0
                  ? "rgba(201,162,39,0.25)"
                  : "rgba(251,113,133,0.25)",
          },
        })),
        barMaxWidth: 16,
        label: {
          show: true,
          position: "right",
          color: chartText.muted,
          fontSize: 11,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (p: any) =>
            metric === "count"
              ? String(p?.value ?? "")
              : fmt2(Number(p?.value ?? 0)),
        },
      },
    ],
  };
}

export function pieOption(
  rows: BreakdownRow[],
  title = "",
  /** When true (default), hide on-slice labels for many buckets — use legend only */
  legendOnlyLabels = true
): EChartsOption {
  // Cap slices; fold residual into "Other (n…)" for readability
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const maxSlices = 8;
  let dataRows = sorted.slice(0, maxSlices);
  if (sorted.length > maxSlices) {
    const rest = sorted.slice(maxSlices);
    const restCount = rest.reduce((s, r) => s + r.count, 0);
    dataRows = [
      ...dataRows,
      {
        key: `Rest (+${rest.length} groups)`,
        count: restCount,
        wins: 0,
        losses: 0,
        pl: rest.reduce((s, r) => s + r.pl, 0),
        staked: 0,
        roi: 0,
        winRate: 0,
      },
    ];
  }
  const total = dataRows.reduce((s, r) => s + r.count, 0) || 1;
  const many = dataRows.length > 5 || legendOnlyLabels;
  const data = dataRows.map((r, i) => ({
    name: r.key.length > 28 ? `${r.key.slice(0, 26)}…` : r.key,
    value: r.count,
    itemStyle: {
      color: colorForPieSlice(r.key, i),
      borderColor: palette.void,
      borderWidth: 2,
    },
  }));
  return {
    animationDuration: 700,
    backgroundColor: "transparent",
    title: title
      ? { text: title, left: "center", top: 0, textStyle: { color: chartText.strong, fontSize: 12, fontWeight: 600 } }
      : undefined,
    tooltip: {
      trigger: "item",
      backgroundColor: tooltipBg,
      borderColor: "rgba(148,163,184,0.35)",
      textStyle: { color: chartText.strong, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => {
        const name = p?.name ?? "";
        const val = Number(p?.value ?? 0);
        const pct = total ? ((val / total) * 100).toFixed(1) : "0";
        return `<b>${name}</b><br/>n=<b>${val}</b> (${pct}%)`;
      },
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 4,
      top: "middle",
      textStyle: { color: chartText.strong, fontSize: 12 },
      pageTextStyle: { color: chartText.strong },
      itemWidth: 12,
      itemHeight: 12,
      formatter: (name: string) => {
        const row = data.find((d) => d.name === name);
        if (!row) return name;
        const pct = ((row.value / total) * 100).toFixed(0);
        return `${name}  ${pct}%`;
      },
    },
    series: [
      {
        type: "pie",
        radius: many ? ["42%", "70%"] : ["38%", "66%"],
        center: many ? ["36%", "52%"] : ["50%", "52%"],
        data,
        label: many
          ? { show: false }
          : {
              color: chartText.strong,
              fontSize: 11,
              formatter: "{d}%",
            },
        labelLine: many
          ? { show: false }
          : {
              lineStyle: { color: "rgba(226,232,240,0.55)" },
            },
        emphasis: {
          itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,0,0,0.45)" },
          scale: true,
          scaleSize: 6,
          label: {
            show: true,
            color: chartText.strong,
            fontSize: 12,
            fontWeight: 600,
            formatter: "{b}\n{d}%",
          },
        },
      },
    ],
  };
}

export function histogramOption(
  bins: { bin: string; count: number }[],
  color: string = chartColors.violet
): EChartsOption {
  return {
    animationDuration: 600,
    backgroundColor: "transparent",
    grid: { left: 44, right: 12, top: 20, bottom: 48 },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      textStyle: { color: chartText.strong },
    },
    xAxis: {
      type: "category",
      data: bins.map((b) => b.bin),
      axisLabel: { ...axisLabel, rotate: 35, fontSize: 12 },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
    },
    yAxis: { type: "value", axisLabel, splitLine },
    series: [
      {
        type: "bar",
        data: bins.map((b) => b.count),
        itemStyle: { color, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

export function trendLineOption(
  points: { date: string; value: number }[],
  name: string,
  asPct = false
): EChartsOption {
  return {
    animationDuration: 700,
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      textStyle: { color: chartText.strong },
      valueFormatter: (v) =>
        asPct ? `${(Number(v) * 100).toFixed(1)}%` : fmt2(Number(v)),
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.date),
      axisLabel,
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        ...axisLabel,
        formatter: asPct
          ? (v: number) => `${(v * 100).toFixed(0)}%`
          : (v: number) => fmt2(v),
      },
      splitLine,
    },
    series: [
      {
        name,
        type: "line",
        smooth: true,
        showSymbol: false,
        data: points.map((p) =>
          asPct ? +p.value.toFixed(4) : +Number(p.value).toFixed(2)
        ),
        lineStyle: { width: 2, color: chartColors.cyan },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(224,184,58,0.25)" },
              { offset: 1, color: "rgba(224,184,58,0.01)" },
            ],
          },
        },
      },
    ],
  };
}

export function calendarHeatOption(
  cells: { date: string; pl: number; count: number }[]
): EChartsOption {
  if (!cells.length) {
    return {
      title: {
        text: "No settled bets",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }
  const years = Array.from(new Set(cells.map((c) => c.date.slice(0, 4)))).sort();
  const year = years[years.length - 1];
  const data = cells
    .filter((c) => c.date.startsWith(year))
    .map((c) => [c.date, +Number(c.pl).toFixed(2)]);

  const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(c.pl)));

  return {
    animationDuration: 800,
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: tooltipBg,
      textStyle: { color: chartText.strong },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => {
        const d = p?.data;
        if (!d) return "";
        const cell = cells.find((c) => c.date === d[0]);
        return `<b>${d[0]}</b><br/>P/L: ${fmt2(Number(d[1]))} NOK<br/>Bets: ${cell?.count ?? "—"}`;
      },
    },
    visualMap: {
      min: -maxAbs,
      max: maxAbs,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 2,
      itemWidth: 14,
      itemHeight: 120,
      // Explicit ends so -50 / 0 / +50 stay readable on dark glass
      // High-contrast ends (readable on dark glass)
      text: [`+${Math.round(maxAbs)}`, `−${Math.round(maxAbs)}`],
      textGap: 10,
      inRange: {
        color: ["#fb7185", "#1e293b", "#2dd4bf"],
      },
      textStyle: {
        color: chartText.strong,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
      },
    },
    calendar: {
      top: 36,
      left: 48,
      right: 20,
      bottom: 56,
      cellSize: ["auto", 15],
      range: year,
      itemStyle: { borderWidth: 2.5, borderColor: "#060a12", borderRadius: 3 },
      yearLabel: { show: false },
      dayLabel: { color: chartText.muted, fontSize: 11, fontWeight: 500 },
      monthLabel: { color: chartText.strong, fontSize: 12, fontWeight: 600 },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data,
      },
    ],
  };
}

/**
 * Reliability diagram: mean predicted p vs empirical win rate per bin.
 * Perfect calibration = diagonal y=x.
 */
export function reliabilityChartOption(
  bins: {
    bin: string;
    n: number;
    mean_p: number | null;
    emp_rate: number | null;
  }[]
): EChartsOption {
  const pts = bins
    .filter((b) => b.n > 0 && b.mean_p != null && b.emp_rate != null)
    .map((b) => ({
      name: b.bin,
      n: b.n,
      x: b.mean_p as number,
      y: b.emp_rate as number,
    }));

  if (!pts.length) {
    return {
      title: {
        text: "No reliability bins yet",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }

  return {
    animationDuration: 700,
    backgroundColor: "transparent",
    grid: { left: 52, right: 24, top: 28, bottom: 44 },
    tooltip: {
      ...tooltipBase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => {
        const d = p?.data;
        if (!d) return "";
        const val = Array.isArray(d.value) ? d.value : Array.isArray(d) ? d : null;
        if (!val || val.length < 2) return "";
        const meanP = Number(val[0]);
        const emp = Number(val[1]);
        const n = Number(val[2] ?? d.n ?? 0);
        const gap = meanP - emp;
        return `<b>Bin ${d.name || ""}</b><br/>
          Mean p: <b>${(meanP * 100).toFixed(1)}%</b><br/>
          Empirical: <b>${(emp * 100).toFixed(1)}%</b><br/>
          Gap: <b style="color:${Math.abs(gap) > 0.1 ? chartColors.loss : chartColors.profit}">${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(1)}pp</b><br/>
          n=${n}<br/>
          <span style="font-size:11px;color:${chartText.muted}">Click → tickets in bin</span>`;
      },
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 1,
      name: "Mean p_model",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: chartText.muted, fontSize: 12 },
      axisLabel: {
        ...axisLabel,
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
      splitLine,
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      name: "Empirical WR",
      nameLocation: "middle",
      nameGap: 36,
      nameTextStyle: { color: chartText.muted, fontSize: 12 },
      axisLabel: {
        ...axisLabel,
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
      splitLine,
    },
    series: [
      {
        name: "Perfect",
        type: "line",
        data: [
          [0, 0],
          [1, 1],
        ],
        symbol: "none",
        lineStyle: {
          color: "rgba(192,132,252,0.45)",
          type: "dashed",
          width: 1.75,
        },
        silent: true,
        z: 1,
      },
      {
        name: "Observed",
        type: "scatter",
        // value: [mean_p, emp_rate, n]
        symbolSize: (val: number[]) => {
          const n = Array.isArray(val) ? Number(val[2] || 4) : 4;
          return Math.max(14, Math.min(34, 10 + Math.sqrt(n) * 3.4));
        },
        data: pts.map((p) => {
          const gap = Math.abs(p.x - p.y);
          const hot = gap > 0.12;
          return {
            value: [p.x, p.y, p.n],
            name: p.name,
            n: p.n,
            itemStyle: {
              color: hot ? chartColors.loss : chartColors.accent,
              borderColor: "#060a12",
              borderWidth: 1.5,
              shadowBlur: 14,
              shadowColor: hot
                ? "rgba(251,113,133,0.45)"
                : "rgba(201,162,39,0.5)",
            },
          };
        }),
        z: 2,
      },
    ],
  };
}

/** Multi-series line for stake multipliers over learning history */
/** Compact axis label: "07-15 14:29" from ISO timestamps */
function shortHistoryLabel(ts: string): string {
  const t = (ts || "").trim();
  // 2026-07-15T14:29:00Z → 07-15 14:29
  const m = t.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  if (t.length >= 16) return t.slice(5, 16).replace("T", " ");
  return t;
}

export function multiplierTimelineOption(
  history: { ts: string; values: Record<string, number> }[],
  keys: string[],
  title = "Stake multipliers over time"
): EChartsOption {
  if (!history.length || !keys.length) {
    return {
      title: {
        text: "No learning history yet",
        left: "center",
        top: "middle",
        textStyle: { color: chartText.empty, fontSize: 13 },
      },
    };
  }

  const labels = history.map((h) => shortHistoryLabel(h.ts || ""));
  // Hide some ticks when dense so rotated labels don't stack on each other
  const labelInterval =
    history.length <= 6 ? 0 : history.length <= 12 ? 1 : Math.ceil(history.length / 8) - 1;

  return {
    animationDuration: 700,
    backgroundColor: "transparent",
    title: {
      text: title,
      left: 0,
      top: 0,
      textStyle: { color: chartText.muted, fontSize: 12, fontWeight: 500 },
    },
    // Legend above the plot so it never collides with x-axis dates
    grid: { left: 52, right: 20, top: 70, bottom: 58, containLabel: false },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderColor: "rgba(201,162,39,0.3)",
      textStyle: { color: chartText.strong },
      // Full ISO in tooltip; axis stays compact
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const first = arr[0] as any;
        const idx = first?.dataIndex ?? 0;
        const fullTs = history[idx]?.ts || first?.axisValue || "";
        const lines = arr
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => {
            const v = p?.value;
            if (v == null || Number.isNaN(Number(v))) return null;
            return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}: <b>×${fmt2(Number(v))}</b>`;
          })
          .filter(Boolean);
        return `<div style="font-weight:600;margin-bottom:6px">${fullTs}</div>${lines.join("<br/>")}`;
      },
    },
    legend: {
      type: "scroll",
      top: 22,
      left: 0,
      right: 8,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: chartText.label, fontSize: 12 },
      pageTextStyle: { color: chartText.muted },
      pageIconColor: chartText.muted,
      pageIconInactiveColor: "#475569",
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: {
        ...axisLabel,
        rotate: 35,
        fontSize: 11,
        hideOverlap: true,
        interval: labelInterval,
        margin: 10,
        color: chartText.label,
      },
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
    },
    yAxis: {
      type: "value",
      scale: true,
      min: (v: { min: number }) => Math.min(0.7, v.min - 0.02),
      max: (v: { max: number }) => Math.max(1.2, v.max + 0.02),
      axisLabel: { ...axisLabel, formatter: (n: number) => fmt2(n) },
      splitLine,
    },
    dataZoom: [{ type: "inside", xAxisIndex: 0 }],
    series: keys.map((key, i) => ({
      name: key,
      type: "line" as const,
      smooth: true,
      showSymbol: history.length < 20,
      symbolSize: 6,
      data: history.map((h) =>
        h.values[key] != null && !Number.isNaN(Number(h.values[key]))
          ? +Number(h.values[key]).toFixed(3)
          : null
      ),
      lineStyle: {
        width: 2,
        color: chartColors.series[i % chartColors.series.length],
      },
      itemStyle: { color: chartColors.series[i % chartColors.series.length] },
      // Learning history snapshots only include active buckets — forward-fill in
      // buildMultHistory; still connect across any residual gaps.
      connectNulls: true,
    })),
  };
}
