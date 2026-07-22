import type {
  AgentMessage,
  AgentToolCall,
  AiProvider,
  Bet,
  DerivedMetrics,
  EdgeRecord,
  TrackerSnapshot,
} from "@/types";
import { breakdownBy, computeMetrics, filterBets, emptyFilters } from "@/lib/analytics";
import {
  defaultModelForProvider,
  resolveAllowedModel,
} from "@/lib/aiModels";
import { confirmLedgerMutation, isLedgerMutatingNt } from "@/lib/ntSafety";
import { truncate } from "@/lib/utils";

export interface AgentContext {
  bets: Bet[];
  filtered: Bet[];
  snapshot: TrackerSnapshot | null;
  metrics: DerivedMetrics;
  edges: EdgeRecord[];
  provider: AiProvider;
  apiKey: string;
  model: string;
}

const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "get_metrics",
      description: "Get aggregate performance metrics for current (or filtered) bets.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "breakdown",
      description: "Breakdown P/L, win rate, ROI by a dimension.",
      parameters: {
        type: "object",
        properties: {
          by: {
            type: "string",
            enum: ["phase", "sport", "odds_band", "research_grade", "market_type", "result", "source"],
          },
        },
        required: ["by"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_bets",
      description: "Full-text search bets (including notes). Returns top matches.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_status",
      description: "Get bankroll, phase, risk, kill-switch, and status.md summary.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_edges",
      description: "Return recent lessons from edges.jsonl.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "high_odds_review",
      description: "Review settled high-odds bets (odds > 2.5) with P/L and grades.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext
): string {
  const bets = ctx.filtered.length ? ctx.filtered : ctx.bets;

  // Hard guard: no tool may mutate the ledger without going through confirmAgentLedgerMutation.
  // Current tool surface is read-only; reject any accidental run_nt-style names.
  if (
    name === "run_nt" ||
    name === "recommend" ||
    name === "place_ack" ||
    name === "place-ack" ||
    name === "abandon" ||
    name === "settle"
  ) {
    return JSON.stringify({
      error: `Tool "${name}" is not available. Ledger mutations require an explicit Ops desk action with operator confirm.`,
    });
  }

  switch (name) {
    case "get_metrics": {
      const m = computeMetrics(bets, ctx.metrics.baseline);
      return JSON.stringify(m, null, 2);
    }
    case "breakdown": {
      const by = String(args.by || "phase") as keyof Bet;
      const rows = breakdownBy(bets, by).slice(0, 15);
      return JSON.stringify(rows, null, 2);
    }
    case "search_bets": {
      const q = String(args.query || "");
      const limit = Number(args.limit) || 8;
      const found = filterBets(ctx.bets, { ...emptyFilters(), search: q }).slice(0, limit);
      return JSON.stringify(
        found.map((b) => ({
          bet_id: b.bet_id,
          date: b.date,
          match: b.match,
          selection: b.selection,
          odds: b.decimal_odds,
          stake: b.stake_nok,
          result: b.result,
          pl: b.p_l_nok,
          grade: b.research_grade,
          phase: b.phase,
          notes: truncate(b.notes, 280),
        })),
        null,
        2
      );
    }
    case "get_status": {
      return JSON.stringify(
        {
          bankroll: ctx.snapshot?.bankroll ?? {},
          phase: ctx.snapshot?.phase ?? {},
          risk: ctx.snapshot?.risk ?? {},
          status_md: truncate(ctx.snapshot?.status_md || "", 2500),
        },
        null,
        2
      );
    }
    case "get_edges": {
      const limit = Number(args.limit) || 20;
      return JSON.stringify((ctx.edges || []).slice(-limit), null, 2);
    }
    case "high_odds_review": {
      const hi = bets
        .filter((b) => b.decimal_odds > 2.5)
        .map((b) => ({
          date: b.date,
          match: b.match,
          selection: b.selection,
          odds: b.decimal_odds,
          result: b.result,
          pl: b.p_l_nok,
          grade: b.research_grade,
          phase: b.phase,
          notes: truncate(b.notes, 200),
        }));
      return JSON.stringify({ count: hi.length, bets: hi.slice(0, 30) }, null, 2);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

function systemPrompt(ctx: AgentContext): string {
  const m = ctx.metrics;
  const p = ctx.snapshot?.phase;
  const r = ctx.snapshot?.risk;
  return `You are Lumina Agent, an expert assistant for the NT Betting Tracker (Norsk Tipping Oddsen).
You help analyze the ledger, notes, edges, phase/risk rules, and strategy — always respecting "code is law".

Current snapshot:
- Equity ~ ${m.equity.toFixed(2)} NOK (baseline ${m.baseline}, P/L ${m.totalPl.toFixed(2)})
- Settled ${m.settledCount}, Pending ${m.pendingCount}, Win rate ${(m.winRate * 100).toFixed(1)}%, ROI ${(m.roi * 100).toFixed(1)}%
- Phase: ${p?.phase_id ?? "?"} (${p?.label ?? ""}) · can_bet=${r?.can_bet ?? "?"} · stopped=${r?.stopped ?? "?"}
- Daily risk cap: ${r?.daily_risk_cap_nok ?? "?"} · remaining: ${r?.remaining_risk_nok ?? "?"}
- Ledger rows available: ${ctx.bets.length} (filtered view: ${ctx.filtered.length})

Use tools to query data before making claims. Be concise, actionable, and honest about variance.
Never invent bet results. High-odds (>2.5) require grade A evidence in the system rules.`;
}

function endpoint(provider: AiProvider): { url: string; headers: (key: string) => Record<string, string> } {
  if (provider === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: (key) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      }),
    };
  }
  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: (key) => ({
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      }),
    };
  }
  // xAI Grok (default)
  return {
    url: "https://api.x.ai/v1/chat/completions",
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  };
}

function defaultModel(provider: AiProvider): string {
  return defaultModelForProvider(provider);
}

/**
 * Agent tools are read-only (metrics / search / status / edges).
 * If a future tool invokes ledger-mutating `run_nt`, call this before invoke.
 * Returns false when the operator cancels the confirm dialog.
 */
export function confirmAgentLedgerMutation(args: string[]): boolean {
  if (!isLedgerMutatingNt(args)) return true;
  return confirmLedgerMutation(args);
}

export async function runAgentTurn(
  history: AgentMessage[],
  userText: string,
  ctx: AgentContext
): Promise<{ reply: string; toolCalls: AgentToolCall[] }> {
  if (!ctx.apiKey?.trim()) {
    return {
      reply:
        "Add an API key in **Settings** (xAI/Grok, OpenAI, or Anthropic) to enable the agent. " +
        "You can still browse charts and the ledger without AI.",
      toolCalls: [],
    };
  }

  const provider = ctx.provider || "xai";
  // D20: never send free-form / unknown model IDs to the API
  const model = resolveAllowedModel(provider, ctx.model);
  const ep = endpoint(provider);
  const toolCalls: AgentToolCall[] = [];

  // Anthropic has a different schema — keep a simpler non-tool path for it
  if (provider === "anthropic") {
    const content = await callAnthropic(history, userText, ctx, model, ep);
    return { reply: content, toolCalls };
  }

  // OpenAI-compatible (xAI + OpenAI) with tools
  type ChatMsg = {
    role: string;
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
  };

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt(ctx) },
    ...history
      .filter((m) => m.role !== "system")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];

  for (let round = 0; round < 4; round++) {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: ep.headers(ctx.apiKey),
      body: JSON.stringify({
        model,
        messages,
        tools: TOOL_DEFS,
        tool_choice: "auto",
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API error ${res.status}: ${truncate(errText, 400)}`);
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("Empty AI response");

    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        const result = runTool(tc.function.name, args, ctx);
        toolCalls.push({ name: tc.function.name, args, result });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: result,
        });
      }
      continue;
    }

    return {
      reply: msg.content || "(no content)",
      toolCalls,
    };
  }

  return {
    reply: "Stopped after multiple tool rounds. Try a more specific question.",
    toolCalls,
  };
}

async function callAnthropic(
  history: AgentMessage[],
  userText: string,
  ctx: AgentContext,
  model: string,
  ep: { url: string; headers: (key: string) => Record<string, string> }
): Promise<string> {
  // Inject tool-like context eagerly for Anthropic path
  const metrics = JSON.stringify(ctx.metrics, null, 2);
  const status = truncate(ctx.snapshot?.status_md || "", 1800);

  const res = await fetch(ep.url, {
    method: "POST",
    headers: ep.headers(ctx.apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt(ctx) + `\n\nMetrics:\n${metrics}\n\nStatus:\n${status}`,
      messages: [
        ...history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userText },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${truncate(await res.text(), 400)}`);
  }
  const data = await res.json();
  return data.content?.map((c: { text?: string }) => c.text).join("\n") || "(no content)";
}

export const AGENT_SUGGESTIONS = [
  "Summarize current bankroll, phase, and risk status",
  "Which odds bands are winning or losing this era?",
  "Review high-odds bets and evidence quality",
  "Find patterns in recent losses from notes",
  "Performance breakdown by phase and sport",
  "What should I focus on before the next recommend run?",
];
