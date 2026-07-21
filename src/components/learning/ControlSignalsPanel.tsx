/**
 * Live ControlSignals table — TTL, revoke, human emit.
 */
import { useMemo, useState } from "react";
import { ShieldAlert, Plus, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { isTauri } from "@/lib/tauri";
import { activeControlSignals, ttlLabel } from "@/lib/phaseRadar";
import { cn } from "@/lib/utils";

export function ControlSignalsPanel() {
  const snapshot = useDataStore((s) => s.snapshot);
  const runNt = useDataStore((s) => s.runNt);
  const refresh = useDataStore((s) => s.refresh);
  const demo = useAppStore((s) => s.settings.demoMode);
  const setToast = useAppStore((s) => s.setToast);
  const setError = useAppStore((s) => s.setError);

  const [busy, setBusy] = useState(false);
  const [showEmit, setShowEmit] = useState(false);
  const [sport, setSport] = useState("football");
  const [market, setMarket] = useState("");
  const [reason, setReason] = useState("manual override");

  const phase = snapshot?.phase || {};
  const active = useMemo(
    () => activeControlSignals(snapshot?.control_signals || []),
    [snapshot?.control_signals]
  );

  const live = isTauri() && !demo;

  const onRevoke = async (sp: string, mk?: string | null) => {
    if (!live) {
      setToast("Revoke requires desktop + live tracker");
      return;
    }
    if (!window.confirm(`Expire temp_gate_raise for ${sp}${mk ? ` / ${mk}` : ""}?`))
      return;
    setBusy(true);
    try {
      const args = ["control-signals", "revoke", "--sport", sp, "--actor", "lumina"];
      if (mk) args.push("--market", mk);
      const res = await runNt(args);
      if (res.exit_code !== 0 && res.ok === false) {
        setError(res.stderr || "Revoke failed");
      } else {
        setToast(`Revoked signals for ${sp}`);
        await refresh({ runNtRefresh: true });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onEmit = async () => {
    if (!live) {
      setToast("Emit requires desktop + live tracker");
      return;
    }
    if (!sport.trim()) {
      setError("Sport required");
      return;
    }
    setBusy(true);
    try {
      const args = [
        "control-signals",
        "emit",
        "--sport",
        sport.trim(),
        "--source",
        "manual",
        "--reason",
        reason || "manual",
      ];
      if (market.trim()) args.push("--market", market.trim());
      const res = await runNt(args);
      if (res.exit_code !== 0 && res.ok === false) {
        setError(res.stderr || "Emit failed");
      } else {
        setToast(`Emitted temp_gate_raise for ${sport}`);
        setShowEmit(false);
        await refresh({ runNtRefresh: true });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-xl holo-border overflow-hidden space-y-0">
      <div className="px-4 py-3 border-b border-border/60 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-pending" />
            ControlSignals
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Primary closed loop · temp_gate_raise (min EV + force confirmed) · TTL 7–14d
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {active.length} active
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy || !live}
            onClick={() => setShowEmit((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Override emit
          </Button>
        </div>
      </div>

      {(phase.research_only || phase.process_health_until) && (
        <div className="px-4 py-2 bg-pending/10 border-b border-pending/25 text-[11px] text-pending">
          Phase health
          {phase.research_only ? " · RESEARCH_ONLY" : ""}
          {phase.size_mode_floor ? ` · floor ${String(phase.size_mode_floor)}` : ""}
          {phase.process_health_until
            ? ` · hold until ${String(phase.process_health_until)}`
            : ""}
          {phase.process_health_reason
            ? ` · ${String(phase.process_health_reason)}`
            : ""}
        </div>
      )}

      {showEmit && (
        <div className="px-4 py-3 border-b border-border/50 grid sm:grid-cols-4 gap-2 bg-muted/20">
          <div>
            <Label className="text-[10px]">Sport</Label>
            <Input
              className="h-8 text-xs font-mono"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px]">Market (optional)</Label>
            <Input
              className="h-8 text-xs"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px]">Reason</Label>
            <Input
              className="h-8 text-xs"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              className="h-8 w-full"
              disabled={busy}
              onClick={() => void onEmit()}
            >
              Emit temp_gate
            </Button>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <div className="px-4 py-8 text-sm text-muted-foreground text-center">
          No active temp_gate_raise — process clean or not yet triggered
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <th className="text-left px-3 py-2">Sport</th>
                <th className="text-left px-2 py-2">Market</th>
                <th className="text-right px-2 py-2">min_ev+</th>
                <th className="text-left px-2 py-2">Confirmed</th>
                <th className="text-left px-2 py-2">Source</th>
                <th className="text-left px-2 py-2">TTL</th>
                <th className="text-left px-2 py-2">Root</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s, i) => (
                <tr
                  key={`${s.sport}-${s.ts}-${i}`}
                  className="border-b border-border/30 hover:bg-primary/5"
                >
                  <td className="px-3 py-2 font-medium font-mono">{s.sport}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {s.market || "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {s.min_ev_raise ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    {s.force_confirmed_lineup ? (
                      <Badge variant="secondary" className="text-[10px]">
                        forced
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">{s.source}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1 text-pending">
                      <Timer className="h-3 w-3" />
                      {ttlLabel(s.expires_at)}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 max-w-[100px] truncate",
                      "text-muted-foreground"
                    )}
                    title={String(s.process_root_cause || "")}
                  >
                    {s.process_root_cause || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={busy || !live}
                      onClick={() => void onRevoke(String(s.sport || ""), s.market)}
                    >
                      Expire
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
