import { useRef, useEffect, useState } from "react";
import { Bot, Send, Trash2, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAgentStore } from "@/stores/agent-store";
import { useDataStore } from "@/stores/data-store";
import { useAppStore } from "@/stores/app-store";
import { useFilteredBets, useMetrics } from "@/hooks/use-tracker-data";
import { AGENT_SUGGESTIONS } from "@/lib/agent";
import { resolveAllowedModel } from "@/lib/aiModels";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export function Agent({ embedded = false }: { embedded?: boolean }) {
  const messages = useAgentStore((s) => s.messages);
  const busy = useAgentStore((s) => s.busy);
  const send = useAgentStore((s) => s.send);
  const clear = useAgentStore((s) => s.clear);
  const bets = useDataStore((s) => s.bets);
  const filtered = useFilteredBets();
  const snapshot = useDataStore((s) => s.snapshot);
  const metrics = useMetrics();
  const settings = useAppStore((s) => s.settings);
  const setView = useAppStore((s) => s.setView);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const allowedModel = resolveAllowedModel(
    settings.aiProvider,
    settings.aiModel
  );

  const ctx = {
    bets,
    filtered,
    snapshot,
    metrics,
    edges: snapshot?.edges || [],
    provider: settings.aiProvider,
    apiKey: settings.aiApiKey || import.meta.env.VITE_XAI_API_KEY || "",
    model: allowedModel,
  };

  const onSend = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput("");
    await send(t, ctx);
  };

  return (
    <div className={cn("flex flex-col min-h-0 gap-3", embedded ? "min-h-[60vh]" : "h-full p-1")}>
      <div className="flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div>
          {!embedded && (
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Lumina Agent
            </h1>
          )}
          <p className="text-sm text-muted-foreground">
            Tool-calling analysis over ledger, notes, edges &amp; risk state
            {filtered.length !== bets.length && (
              <span className="text-primary">
                {" "}
                · {filtered.length} filtered bets in context
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">
            {settings.aiProvider}
            {allowedModel ? ` · ${allowedModel}` : ""}
          </Badge>
          {!settings.aiApiKey && !import.meta.env.VITE_XAI_API_KEY && (
            <Button size="sm" variant="outline" onClick={() => setView("settings")}>
              Add API key
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {AGENT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy || !snapshot}
            onClick={() => onSend(s)}
            className="text-[11px] rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40"
          >
            <Sparkles className="inline h-3 w-3 mr-1" />
            {s}
          </button>
        ))}
      </div>

      <div className="glass rounded-xl flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {m.role !== "user" && (
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted/50 border border-border/60 rounded-bl-md"
              )}
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <div className="prose-invert-soft">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                  {m.toolCalls.map((tc, i) => (
                    <details key={i} className="text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {tc.name}
                      </summary>
                      <pre className="mt-1 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto opacity-80">
                        {tc.result?.slice(0, 1200)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="rounded-2xl bg-muted/50 border border-border/60 px-4 py-3 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="glass rounded-xl p-3 flex gap-2 shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            snapshot
              ? "Ask about phases, high-odds bets, notes patterns…"
              : "Load a tracker folder first"
          }
          className="min-h-[52px] max-h-32 resize-none"
          disabled={!snapshot || busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          className="self-end"
          disabled={!snapshot || busy || !input.trim()}
          onClick={() => onSend()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
