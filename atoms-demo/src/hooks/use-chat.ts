"use client";

// ============================================================================
// useChat — 对话交互 Hook
// 管理 SSE 连接、流式消息、Agent 状态跟踪
// ============================================================================

import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { supabase } from "@/lib/supabase";
import type { AgentId } from "@/lib/prompts";
import type { SSEChatEvent } from "./use-chat-types";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseChatOptions {
  projectId: string;
  /** 每次 Agent 完成时的回调 */
  onAgentComplete?: (agent: AgentId, summary: string) => void;
  /** 全部完成的回调 */
  onComplete?: (code: Record<string, string> | undefined) => void;
  /** 错误的回调 */
  onError?: (error: string) => void;
}

export function useChat(options: UseChatOptions) {
  const { projectId, onAgentComplete, onComplete, onError } = options;

  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  // ------------------------------------------------------------------
  // 发送消息
  // ------------------------------------------------------------------

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim()) return;
      if (store.isStreaming) return;

      // 重置状态
      store.reset();
      store.setIsStreaming(true);
      store.setError(null);

      // 添加用户消息
      const userMsg = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: userInput,
        timestamp: new Date(),
      };
      store.addMessage(userMsg);

      // 保存用户消息到 Supabase
      const convId = store.conversationId;
      if (supabase && convId) {
        supabase.from("messages").insert({
          conversation_id: convId,
          role: "user",
          content: userInput,
        }).then(({ error }) => {
          if (error) console.warn("保存用户消息失败:", error.message);
        });
      }

      // 准备 AbortController
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId,
            userInput,
            conversationId: store.conversationId ?? undefined,
          }),
          signal: abort.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 读取 SSE 流
        const reader = response.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // 解析 SSE data 行
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // 保留不完整的行

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as SSEChatEvent;
              handleSSEEvent(event);
            } catch {
              // 跳过解析失败的行
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "请求失败";
        store.setError(message);
        store.setIsStreaming(false);
        onError?.(message);
      }
    },
    [projectId, store, onError],
  );

  // ------------------------------------------------------------------
  // SSE 事件处理
  // ------------------------------------------------------------------

  const handleSSEEvent = useCallback(
    (event: SSEChatEvent) => {
      switch (event.type) {
        case "rewrite_start": {
          // 显示"正在分析需求..."
          store.addMessage({
            id: crypto.randomUUID(),
            role: "agent",
            agentName: "需求分析",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          });
          break;
        }

        case "rewrite_complete": {
          // 用重写后的内容替换占位消息
          store.finishLastAgentMessage();
          const rewritten = event.rewritten ?? "";
          if (rewritten) {
            store.addMessage({
              id: crypto.randomUUID(),
              role: "agent",
              agentName: "需求重写",
              content: `📝 **原始需求**：${event.original ?? ""}\n\n**重写为**：\n${rewritten}`,
              timestamp: new Date(),
              isStreaming: false,
            });
          }
          break;
        }

        case "agent_start": {
          const agent = event.agent as AgentId | undefined;
          if (!agent) return;

          store.setAgentState(agent, "running");

          // 为新 Agent 创建消息占位
          store.addMessage({
            id: crypto.randomUUID(),
            role: "agent",
            agentName: toDisplayName(agent),
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          });
          break;
        }

        case "agent_stream": {
          const content = event.content;
          if (content) {
            store.appendToLastAgentMessage(content);
          }
          break;
        }

        case "agent_complete": {
          const agent = event.agent as AgentId | undefined;
          const summary = event.summary ?? "";
          const fullContent = event.fullContent ?? "";

          if (agent) {
            store.setAgentState(agent, "completed");
            store.setAgentSummary(agent, summary);
            store.setAgentFullContent(agent, fullContent);
            onAgentComplete?.(agent, summary);
          }
          store.finishLastAgentMessage();

          // 保存 conversationId（第一次返回时）
          if (!store.conversationId && event.conversationId) {
            store.setConversationId(event.conversationId);
          }
          break;
        }

        case "orchestration_complete": {
          store.setIsStreaming(false);
          const code = event.code;
          if (code) {
            store.setGeneratedCode(code);
            onComplete?.(code.files);
          } else {
            onComplete?.(undefined);
          }
          break;
        }

        case "error": {
          store.setError(event.message ?? "未知错误");
          store.setIsStreaming(false);
          onError?.(event.message ?? "未知错误");
          break;
        }
      }
    },
    [store, onAgentComplete, onComplete, onError],
  );

  // ------------------------------------------------------------------
  // 中止
  // ------------------------------------------------------------------

  const abort = useCallback(() => {
    abortRef.current?.abort();
    store.setIsStreaming(false);
  }, [store]);

  // ------------------------------------------------------------------
  // 加载历史对话
  // ------------------------------------------------------------------

  const loadConversation = useCallback(
    async (conversationId: string) => {
      if (!supabase) return;

      store.reset();
      store.setConversationId(conversationId);

      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("加载对话失败:", error.message);
        return;
      }

      for (const msg of messages ?? []) {
        store.addMessage({
          id: msg.id,
          role: msg.role,
          agentName: msg.agent_name ?? undefined,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          isStreaming: false,
        });
      }

      // 恢复 Agent 状态为已完成
      const completedAgents = new Set(
        (messages ?? [])
          .filter((m) => m.role === "agent" && m.agent_name)
          .map((m) => m.agent_name!.toLowerCase() as AgentId),
      );
      for (const agent of completedAgents) {
        store.setAgentState(agent, "completed");
      }
    },
    [store],
  );

  return {
    messages: store.messages,
    agentStates: store.agentStates,
    agentSummaries: store.agentSummaries,
    isStreaming: store.isStreaming,
    generatedCode: store.generatedCode,
    error: store.error,
    conversationId: store.conversationId,
    sendMessage,
    abort,
    loadConversation,
  };
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function toDisplayName(agent: AgentId): string {
  const map: Record<AgentId, string> = {
    mike: "Mike",
    iris: "Iris",
    emma: "Emma",
    bob: "Bob",
    alex: "Alex",
  };
  return map[agent] ?? agent;
}
