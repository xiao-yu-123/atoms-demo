// ============================================================================
// Chat Zustand Store
// ============================================================================

import { create } from "zustand";
import type { AgentId } from "@/lib/prompts";
import type { AlexCode } from "@/lib/prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentName?: string;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export type AgentState = "idle" | "running" | "completed" | "error";

export interface ChatState {
  // 消息列表
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  appendToLastAgentMessage: (chunk: string) => void;
  finishLastAgentMessage: () => void;

  // Agent 状态跟踪
  agentStates: Record<AgentId, AgentState>;
  agentSummaries: Partial<Record<AgentId, string>>;
  agentFullContent: Partial<Record<AgentId, string>>;
  setAgentState: (agent: AgentId, state: AgentState) => void;
  setAgentSummary: (agent: AgentId, summary: string) => void;
  setAgentFullContent: (agent: AgentId, content: string) => void;

  // 流式状态
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;

  // 最终代码
  generatedCode: AlexCode | null;
  setGeneratedCode: (code: AlexCode | null) => void;

  // 当前对话
  conversationId: string | null;
  setConversationId: (id: string | null) => void;

  // 错误
  error: string | null;
  setError: (err: string | null) => void;

  // 重置
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial states
// ---------------------------------------------------------------------------

const initialAgentStates: Record<AgentId, AgentState> = {
  mike: "idle",
  iris: "idle",
  emma: "idle",
  bob: "idle",
  alex: "idle",
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  agentStates: { ...initialAgentStates },
  agentSummaries: {},
  agentFullContent: {},
  isStreaming: false,
  generatedCode: null,
  conversationId: null,
  error: null,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToLastAgentMessage: (chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "agent" && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      }
      return { messages: msgs };
    }),

  finishLastAgentMessage: () =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "agent" && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, isStreaming: false };
      }
      return { messages: msgs };
    }),

  setAgentState: (agent, state) =>
    set((s) => ({
      agentStates: { ...s.agentStates, [agent]: state },
    })),

  setAgentSummary: (agent, summary) =>
    set((s) => ({
      agentSummaries: { ...s.agentSummaries, [agent]: summary },
    })),

  setAgentFullContent: (agent, content) =>
    set((s) => ({
      agentFullContent: { ...s.agentFullContent, [agent]: content },
    })),

  setIsStreaming: (v) => set({ isStreaming: v }),
  setGeneratedCode: (code) => set({ generatedCode: code }),
  setConversationId: (id) => set({ conversationId: id }),
  setError: (err) => set({ error: err }),

  reset: () =>
    set({
      messages: [],
      agentStates: { ...initialAgentStates },
      agentSummaries: {},
      agentFullContent: {},
      isStreaming: false,
      generatedCode: null,
      error: null,
    }),
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectMessages = (s: ChatState) => s.messages;
export const selectAgentStates = (s: ChatState) => s.agentStates;
export const selectIsStreaming = (s: ChatState) => s.isStreaming;
export const selectGeneratedCode = (s: ChatState) => s.generatedCode;
