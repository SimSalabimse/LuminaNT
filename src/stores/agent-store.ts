import { create } from "zustand";
import type { AgentMessage } from "@/types";
import { runAgentTurn, type AgentContext } from "@/lib/agent";
import { uid } from "@/lib/utils";

interface AgentStore {
  messages: AgentMessage[];
  busy: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  clear: () => void;
  send: (text: string, ctx: AgentContext) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — I'm Lumina Agent. I can analyze your ledger, notes, edges, phases, and risk state. Connect a tracker folder (or load demo data), add an API key in Settings, and ask away.",
      ts: Date.now(),
    },
  ],
  busy: false,
  open: false,
  setOpen: (open) => set({ open }),
  clear: () =>
    set({
      messages: [
        {
          id: uid("msg"),
          role: "assistant",
          content: "Chat cleared. What would you like to analyze?",
          ts: Date.now(),
        },
      ],
    }),
  send: async (text, ctx) => {
    const trimmed = text.trim();
    if (!trimmed || get().busy) return;

    const userMsg: AgentMessage = {
      id: uid("msg"),
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], busy: true }));

    try {
      const { reply, toolCalls } = await runAgentTurn(get().messages, trimmed, ctx);
      const assistant: AgentMessage = {
        id: uid("msg"),
        role: "assistant",
        content: reply,
        ts: Date.now(),
        toolCalls,
      };
      set((s) => ({ messages: [...s.messages, assistant], busy: false }));
    } catch (e) {
      const assistant: AgentMessage = {
        id: uid("msg"),
        role: "assistant",
        content: `Error: ${String(e)}`,
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, assistant], busy: false }));
    }
  },
}));
