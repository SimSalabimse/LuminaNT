import { motion } from "framer-motion";
import { FolderOpen, Sparkles, Play, Shield, Crosshair, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri, pickFolder } from "@/lib/tauri";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { Kbd } from "@/components/layout/Kbd";

export function Onboarding() {
  const connectRepo = useDataStore((s) => s.connectRepo);
  const loadDemo = useDataStore((s) => s.loadDemo);
  const loading = useDataStore((s) => s.loading);
  const settings = useAppStore((s) => s.settings);
  const setError = useAppStore((s) => s.setError);

  const openFolder = async () => {
    try {
      if (!isTauri()) {
        setError(
          "Use Demo Mode in browser, or launch with npm run tauri:dev for folder access."
        );
        return;
      }
      const path = await pickFolder();
      if (path) await connectRepo(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const useSaved = async () => {
    if (settings.repoPath && isTauri()) {
      try {
        await connectRepo(settings.repoPath);
      } catch (e) {
        setError(String(e));
      }
    }
  };

  const tryKnownLocal = async () => {
    const guess = "C:\\Users\\Sander\\Documents\\GitHub\\nt-betting-tracker";
    try {
      await connectRepo(guess);
    } catch {
      await openFolder();
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-6 md:p-10 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-teal-500/15 blur-[100px] animate-pulse-glow" />
        <div className="absolute -bottom-28 -right-16 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-violet-500/10 blur-[90px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong rounded-[1.75rem] max-w-xl w-full p-8 md:p-10 relative border-primary/20 shadow-glass-lg"
      >
        <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow ring-1 ring-white/20">
              <Sparkles className="h-7 w-7 text-slate-950" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-card shadow-[0_0_12px_hsl(var(--primary))]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-none">
              Welcome to <span className="text-gradient-brand">LuminaNT</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Premium forensic desk for NT Betting Tracker
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Connect your local{" "}
          <code className="text-primary text-xs font-mono bg-primary/10 px-1.5 py-0.5 rounded-md">
            nt-betting-tracker
          </code>{" "}
          root — the folder with{" "}
          <code className="text-xs font-mono bg-muted px-1 rounded">config.yaml</code> and{" "}
          <code className="text-xs font-mono bg-muted px-1 rounded">data/bets.csv</code>. Live equity,
          forensic charts, Case Files, calibration — engines stay in Python.
        </p>

        <div className="mb-6 rounded-xl border border-white/[0.06] bg-muted/25 px-3.5 py-3 text-[11px] text-muted-foreground flex flex-wrap gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>?</Kbd> shortcuts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>1</Kbd>–<Kbd>0</Kbd> views
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>R</Kbd> refresh
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>/</Kbd> search bets
          </span>
        </div>

        <div className="space-y-2.5">
          <Button
            size="lg"
            className="w-full justify-start h-12 text-[15px]"
            onClick={openFolder}
            disabled={loading}
          >
            <FolderOpen className="h-4 w-4" />
            Select tracker folder
          </Button>

          {settings.repoPath && isTauri() && (
            <Button
              size="lg"
              variant="secondary"
              className="w-full justify-start font-mono text-xs h-11"
              onClick={useSaved}
              disabled={loading}
            >
              <Play className="h-4 w-4" />
              Reopen: {settings.repoPath}
            </Button>
          )}

          {isTauri() && !settings.repoPath && (
            <Button
              size="lg"
              variant="secondary"
              className="w-full justify-start font-mono text-xs h-11"
              disabled={loading}
              onClick={tryKnownLocal}
            >
              <Play className="h-4 w-4" />
              Try local: Documents\GitHub\nt-betting-tracker
            </Button>
          )}

          <Button
            size="lg"
            variant="outline"
            className="w-full justify-start h-11"
            onClick={() => loadDemo()}
            disabled={loading}
          >
            <Sparkles className="h-4 w-4" />
            Load demo data
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-muted-foreground">
          {[
            {
              icon: Shield,
              title: "Code is law",
              body: "Phase, risk, stakes stay in Python engines",
            },
            {
              icon: Crosshair,
              title: "Forensic grain",
              body: "Charts drill to exact bet_ids · Case Files",
            },
            {
              icon: HardDrive,
              title: "Local first",
              body: "Your ledger never leaves the machine",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-white/[0.06] bg-muted/30 p-3.5 hover:border-primary/20 transition-colors"
            >
              <c.icon className="h-4 w-4 text-primary mb-2" />
              <div className="font-semibold text-foreground mb-1">{c.title}</div>
              {c.body}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
