import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, Maximize2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/layout/EmptyState";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  option: EChartsOption;
  className?: string;
  height?: number | string;
  onEvents?: Record<string, (params: unknown) => void>;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  accent?: "teal" | "violet" | "cyan";
}

function isEffectivelyEmpty(option: EChartsOption): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = option as any;
  if (o?.title?.text && /no |empty|yet/i.test(String(o.title.text)) && !o.series) {
    return true;
  }
  const series = o?.series;
  if (!series) return false;
  const arr = Array.isArray(series) ? series : [series];
  if (!arr.length) return true;
  return arr.every((s) => {
    const d = s?.data;
    return !d || (Array.isArray(d) && d.length === 0);
  });
}

const ACCENT_GLOW = {
  teal: "from-primary/30 via-primary/8 to-transparent",
  violet: "from-violet/28 via-violet/8 to-transparent",
  cyan: "from-accent/30 via-accent/8 to-transparent",
};

export function ChartPanel({
  title,
  subtitle,
  option,
  className,
  height = 280,
  onEvents,
  empty,
  emptyTitle = "No data in view",
  emptyDescription = "Adjust filters or settle more bets to populate this chart.",
  actions,
  accent = "teal",
}: ChartPanelProps) {
  const ref = useRef<ReactECharts>(null);
  const [tall, setTall] = useState(false);

  const showEmpty = empty ?? isEffectivelyEmpty(option);
  const h = tall ? (typeof height === "number" ? height + 120 : height) : height;

  const mergedOption = useMemo(() => {
    if (showEmpty) return option;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = {
      animationDuration: 750,
      animationEasing: "cubicOut",
      textStyle: {
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#C8D4E6",
        fontSize: 12,
      },
      ...option,
    };
    if (base.tooltip && typeof base.tooltip === "object") {
      base.tooltip = {
        confine: true,
        extraCssText:
          "backdrop-filter:blur(14px);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.55),0 0 0 1px rgba(201,162,39,0.22);padding:10px 12px;",
        ...base.tooltip,
      };
    }
    return base as EChartsOption;
  }, [option, showEmpty]);

  const exportPng = () => {
    const inst = ref.current?.getEchartsInstance();
    if (!inst) return;
    const url = inst.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#0a101c",
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.png`;
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass rounded-2xl p-4 flex flex-col min-h-0 chart-frame relative overflow-hidden group holo-border card-hover",
        className
      )}
    >
      <div
        className={cn(
          "absolute -top-20 -right-16 h-52 w-52 rounded-full bg-gradient-to-br blur-3xl opacity-60 pointer-events-none transition-opacity duration-500 group-hover:opacity-100",
          ACCENT_GLOW[accent]
        )}
      />
      <div className="absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl opacity-40 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />
      <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />
      <div className="flex items-start justify-between gap-2 mb-3 relative">
        <div className="min-w-0">
          {title ? (
            <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              {title}
            </h3>
          ) : null}
          {subtitle && (
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setTall((v) => !v)}
            title={tall ? "Compact" : "Expand"}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={exportPng}
            title="Export PNG"
            disabled={showEmpty}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {showEmpty ? (
        <div style={{ minHeight: typeof h === "number" ? h : 200 }} className="relative">
          <EmptyState
            compact
            icon={BarChart3}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <ReactECharts
          ref={ref}
          option={mergedOption}
          style={{ height: h, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
          onEvents={onEvents}
        />
      )}
    </motion.div>
  );
}
