import { useState } from "react";
import { FolderOpen, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/stores/app-store";
import { useDataStore } from "@/stores/data-store";
import { isTauri, pickFolder, setPythonCmd } from "@/lib/tauri";
import type { AiProvider } from "@/types";

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const setToast = useAppStore((s) => s.setToast);
  const setError = useAppStore((s) => s.setError);
  const connectRepo = useDataStore((s) => s.connectRepo);
  const loadDemo = useDataStore((s) => s.loadDemo);
  const snapshot = useDataStore((s) => s.snapshot);

  const [local, setLocal] = useState(settings);

  const save = async () => {
    patchSettings(local);
    if (isTauri() && local.pythonCmd) {
      try {
        await setPythonCmd(local.pythonCmd);
      } catch {
        /* ignore */
      }
    }
    if (local.repoPath && isTauri() && local.repoPath !== settings.repoPath) {
      try {
        await connectRepo(local.repoPath);
      } catch (e) {
        setError(String(e));
        return;
      }
    }
    setToast("Settings saved");
  };

  const browse = async () => {
    if (!isTauri()) {
      setError("Folder picker requires the desktop app.");
      return;
    }
    const path = await pickFolder();
    if (path) setLocal((s) => ({ ...s, repoPath: path, demoMode: false }));
  };

  return (
    <div className="space-y-6 p-1 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Tracker path, Python CLI, file watching, and AI provider
        </p>
      </div>

      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          Tracker repository
        </h2>
        <div className="space-y-2">
          <Label>Root folder path</Label>
          <div className="flex gap-2">
            <Input
              className="font-mono text-xs"
              value={local.repoPath}
              onChange={(e) =>
                setLocal((s) => ({ ...s, repoPath: e.target.value, demoMode: false }))
              }
              placeholder="C:\Users\...\nt-betting-tracker"
            />
            <Button variant="outline" onClick={browse}>
              Browse
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Must contain <code>config.yaml</code> and <code>data/bets.csv</code> (or{" "}
            <code>nt/</code>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={async () => {
              if (!local.repoPath) return;
              patchSettings({ ...local, demoMode: false });
              try {
                await connectRepo(local.repoPath);
                setToast("Connected");
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Connect now
          </Button>
          <Button size="sm" variant="outline" onClick={() => loadDemo()}>
            Load demo data
          </Button>
        </div>
        {snapshot && (
          <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs font-mono space-y-1">
            <div>valid: {String(snapshot.meta.valid)}</div>
            <div>bets mtime: {snapshot.meta.bets_mtime || "—"}</div>
            <div>git: {snapshot.git.summary}</div>
            {snapshot.meta.reasons?.map((r, i) => (
              <div key={i} className="text-pending">
                {r}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Python CLI</h2>
        <div className="space-y-2">
          <Label>Python executable</Label>
          <Input
            className="font-mono text-xs"
            value={local.pythonCmd}
            onChange={(e) => setLocal((s) => ({ ...s, pythonCmd: e.target.value }))}
            placeholder="python or py or full path"
          />
          <p className="text-xs text-muted-foreground flex gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            On Windows, commands run as{" "}
            <code>{local.pythonCmd || "python"} run_nt.py …</code> (not{" "}
            <code>-m nt</code> — that hits the builtin Windows <code>nt</code> module). Install
            tracker deps with <code>pip install -r requirements.txt</code>.
          </p>
        </div>
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">Auto refresh</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Watch data files</Label>
            <p className="text-xs text-muted-foreground">
              Poll fingerprint of bets.csv / state and reload when changed
            </p>
          </div>
          <Switch
            checked={local.autoWatch}
            onCheckedChange={(autoWatch) => setLocal((s) => ({ ...s, autoWatch }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Interval (ms)</Label>
          <Input
            type="number"
            min={2000}
            step={500}
            value={local.watchIntervalMs}
            onChange={(e) =>
              setLocal((s) => ({
                ...s,
                watchIntervalMs: Math.max(2000, Number(e.target.value) || 4000),
              }))
            }
          />
        </div>
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold">AI Agent</h2>
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select
            value={local.aiProvider}
            onValueChange={(v) =>
              setLocal((s) => ({ ...s, aiProvider: v as AiProvider }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xai">xAI / Grok</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>API key</Label>
          <Input
            type="password"
            value={local.aiApiKey}
            onChange={(e) => setLocal((s) => ({ ...s, aiApiKey: e.target.value }))}
            placeholder="Stored locally in browser/app storage"
          />
        </div>
        <div className="space-y-2">
          <Label>Model override (optional)</Label>
          <Input
            className="font-mono text-xs"
            value={local.aiModel}
            onChange={(e) => setLocal((s) => ({ ...s, aiModel: e.target.value }))}
            placeholder="grok-2-latest / gpt-4o-mini / …"
          />
        </div>
      </section>

      <section className="glass rounded-xl p-5 space-y-2 text-sm text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">About phases & risk</h2>
        <p>
          <strong className="text-foreground">Equity</strong> = baseline + sum(settled P/L in{" "}
          <code>data/bets.csv</code>).
        </p>
        <p>
          <strong className="text-foreground">Daily risk cap</strong> = clamp(equity × phase.daily_risk_pct,
          floor, ceil) — recomputed by the Python engine.
        </p>
        <p>
          <strong className="text-foreground">Risk gate</strong> (Can bet) blocks new risk when daily/weekly
          hard stops fire, freeze is active, or remaining room is below the stake floor. Size mode
          (NORMAL / REDUCED / FROZEN) is separate sizing policy from drawdown. LuminaNT displays engine
          state; it does not override rules.
        </p>
        <p>
          High odds (&gt; 2.5) require grade <strong className="text-foreground">A</strong> evidence and
          elevated EV — see tracker README.
        </p>
      </section>

      <Button onClick={save} className="gap-2">
        <Save className="h-4 w-4" />
        Save settings
      </Button>
    </div>
  );
}
