"use client";

// ============================================================================
// useChat — 多请求编排 Hook (v4.0)
// 每个 Agent 一次独立 HTTP 请求，适配 Vercel serverless 10s 限制
// ============================================================================

import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { supabase } from "@/lib/supabase";
import type { AgentId, MikePlan } from "@/lib/prompts";
import type { AgentOutput } from "@/types/agent";
import type { SSEChatEvent } from "./use-chat-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanResponse {
  plan: MikePlan | null;
  mikeContent: string;
  mikeSummary: string;
  conversationId: string | null;
  error?: string;
}

export interface UseChatOptions {
  projectId: string;
  onAgentComplete?: (agent: AgentId, summary: string) => void;
  onComplete?: (code: Record<string, string> | undefined) => void;
  onError?: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(options: UseChatOptions) {
  const { projectId, onAgentComplete, onComplete, onError } = options;

  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  // ------------------------------------------------------------------
  // 发送消息 — 编排多请求流程
  // ------------------------------------------------------------------

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim()) return;
      if (store.isStreaming) return;

      // 重置
      store.reset();
      store.setIsStreaming(true);
      store.setError(null);

      // 添加用户消息
      store.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: userInput,
        timestamp: new Date(),
      });

      const abort = new AbortController();
      abortRef.current = abort;

      // 使用本地变量跟踪 conversationId，避免 zustand 快照读取旧值
      let convId = store.conversationId;

      try {
        // ----------------------------------------------------------------
        // Step 1: POST /api/chat/plan → Mike 制定计划
        // ----------------------------------------------------------------
        const planRes = await fetch("/api/chat/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            userInput,
            conversationId: convId ?? undefined,
          }),
          signal: abort.signal,
        });

        if (!planRes.ok) {
          throw new Error(`Plan API 返回 ${planRes.status}`);
        }

        const planData = (await planRes.json()) as PlanResponse;

        if (planData.error && !planData.plan) {
          throw new Error(planData.error);
        }

        // 保存 conversationId（同时更新本地变量 + store）
        if (planData.conversationId) {
          convId = planData.conversationId;
          store.setConversationId(planData.conversationId);
        }

        // 显示 Mike 的输出
        store.setAgentState("mike", "completed");
        store.setAgentSummary("mike", planData.mikeSummary);
        store.setAgentFullContent("mike", planData.mikeContent);
        onAgentComplete?.("mike", planData.mikeSummary);

        store.addMessage({
          id: crypto.randomUUID(),
          role: "agent",
          agentName: "Mike",
          content: planData.mikeSummary || planData.mikeContent.slice(0, 300),
          timestamp: new Date(),
        });

        if (!planData.plan || planData.plan.steps.length === 0) {
          throw new Error("Mike 未能生成有效的执行计划");
        }

        // 构建 Mike 的 AgentOutput 作为后续 Agent 的上下文
        const accumulatedOutputs: AgentOutput[] = [
          {
            agent: "mike",
            content: planData.mikeContent,
            structuredData: planData.plan as unknown as Record<string, unknown>,
            model: "qwen",
            timestamp: new Date(),
          },
        ];

        // ----------------------------------------------------------------
        // Step 2: 按计划依次调用各 Agent（独立 HTTP 请求）
        // ----------------------------------------------------------------
        const plan = planData.plan;

        for (const step of plan.steps) {
          if (abort.signal.aborted) break;

          const agent = step.agent;
          if (agent === "mike") continue;

          store.setAgentState(agent, "running");

          // 为当前 Agent 创建消息占位
          store.addMessage({
            id: crypto.randomUUID(),
            role: "agent",
            agentName: toDisplayName(agent),
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          });

          // 调用 Agent SSE 端点
          let fullContent = "";
          try {
            const agentRes = await fetch("/api/chat/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agent,
                userInput,
                context: accumulatedOutputs.map((o) => ({
                  agent: o.agent,
                  content: o.content,
                  structuredData: o.structuredData,
                  model: o.model,
                  timestamp: o.timestamp,
                })),
                projectId,
                conversationId: convId ?? undefined,
              }),
              signal: abort.signal,
            });

            if (!agentRes.ok) {
              throw new Error(`Agent ${agent} API 返回 ${agentRes.status}`);
            }

            // 读取 SSE 流
            const reader = agentRes.body?.getReader();
            if (!reader) throw new Error("无法读取响应流");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                  const event = JSON.parse(jsonStr) as SSEChatEvent;
                  handleAgentSSEEvent(event, agent, fullContent);
                  if (event.type === "agent_stream" && event.content) {
                    fullContent += event.content;
                  }
                } catch {
                  // 跳过解析失败的行
                }
              }
            }
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            throw err;
          }

          // Agent 完成
          store.finishLastAgentMessage();
          store.setAgentState(agent, "completed");

          const summary = extractSummary(fullContent);
          store.setAgentSummary(agent, summary);
          store.setAgentFullContent(agent, fullContent);
          onAgentComplete?.(agent, summary);

          // 加入上下文供后续 Agent 使用
          accumulatedOutputs.push({
            agent,
            content: fullContent,
            structuredData: tryParseJSON(fullContent) ?? undefined,
            model: "qwen",
            timestamp: new Date(),
          });
        }

        // ----------------------------------------------------------------
        // Step 3: 提取 Alex 代码 + 保存
        // ----------------------------------------------------------------
        const alexOutput = accumulatedOutputs.find((o) => o.agent === "alex");
        let finalCode = undefined;

        if (alexOutput?.structuredData) {
          const d = alexOutput.structuredData as Record<string, unknown>;
          const files = d.files as Record<string, string> | undefined;
          if (files && Object.keys(files).length > 0) {
            finalCode = {
              files,
              entryFile: (d.entryFile as string) ?? "/App.tsx",
              dependencies: (d.dependencies as Record<string, string>) ?? {},
            };
          }
        }

        // 保存代码到 Supabase（使用本地 convId，避免 zustand 快照旧值）
        if (supabase && projectId && convId && finalCode) {
          const { data: latestCode } = await supabase
            .from("generated_code")
            .select("version")
            .eq("project_id", projectId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextVersion = (latestCode?.version ?? 0) + 1;

          await supabase.from("generated_code").insert({
            project_id: projectId,
            conversation_id: convId,
            code_type: "full_app",
            files: finalCode.files,
            version: nextVersion,
          });

          await supabase
            .from("projects")
            .update({ status: "building" })
            .eq("id", projectId)
            .eq("status", "draft");
        }

        // 完成
        store.setGeneratedCode(finalCode ?? null);
        store.setIsStreaming(false);
        onComplete?.(finalCode?.files);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "请求失败";
        store.setError(message);
        store.setIsStreaming(false);
        onError?.(message);
      }
    },
    [projectId, store, onAgentComplete, onComplete, onError],
  );

  // ------------------------------------------------------------------
  // 处理单 Agent 的 SSE 事件
  // ------------------------------------------------------------------

  const handleAgentSSEEvent = useCallback(
    (event: SSEChatEvent, agent: AgentId, _accumulatedContent: string) => {
      switch (event.type) {
        case "agent_stream": {
          if (event.content) {
            store.appendToLastAgentMessage(event.content);
          }
          break;
        }

        case "agent_complete": {
          // handled by caller
          break;
        }

        case "error": {
          store.setError(event.message ?? "Agent 错误");
          break;
        }
      }
    },
    [store],
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

      // 恢复 Agent 状态
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

function extractSummary(content: string, maxLen = 300): string {
  try {
    const cleaned = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(cleaned);
    return parsed.summary ?? parsed.goal ?? parsed.overview ?? content.slice(0, maxLen);
  } catch {
    return content.slice(0, maxLen);
  }
}

function tryParseJSON(content: string): Record<string, unknown> | null {
  if (!content) return null;
  let cleaned = content.trim();
  const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (match) cleaned = match[1].trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}
