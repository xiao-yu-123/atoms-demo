"use client";

// ============================================================================
// useChat — 多请求编排 Hook (v4.0)
// 每个 Agent 一次独立 HTTP 请求，适配 Vercel serverless 10s 限制
// ============================================================================

import { useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { supabase } from "@/lib/supabase";
import type { AgentId, MikePlan, AlexCode } from "@/lib/prompts";
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
        // Step 3: 提取代码（优先 Alex，回退到任意含 files 的输出）
        // ----------------------------------------------------------------
        let finalCode: AlexCode | undefined;

        console.warn("[useChat] Extracting code from", accumulatedOutputs.length, "agent outputs");
        for (const o of accumulatedOutputs) {
          console.warn("[useChat] Agent", o.agent, "content length:", o.content?.length, "has structuredData:", !!o.structuredData);
          if (o.structuredData) {
            console.warn("[useChat] structuredData keys:", Object.keys(o.structuredData));
          }
        }

        // 从后往前遍历 accumulatedOutputs，找第一个包含 files 的输出
        for (let i = accumulatedOutputs.length - 1; i >= 0; i--) {
          const o = accumulatedOutputs[i];
          if (o.structuredData) {
            const d = o.structuredData as Record<string, unknown>;
            const files = d.files as Record<string, string> | undefined;
            if (files && Object.keys(files).length > 0) {
              console.warn("[useChat] Found files in agent", o.agent, "file count:", Object.keys(files).length);
              finalCode = {
                files,
                entryFile: (d.entryFile as string) ?? "/App.tsx",
                dependencies: (d.dependencies as Record<string, string>) ?? {},
              };
              break;
            }
          }
        }

        console.warn("[useChat] finalCode extracted:", !!finalCode, finalCode ? Object.keys(finalCode.files).length : 0, "files");

        // 回退方案：JSON 解析失败时，从原始内容用正则提取文件
        if (!finalCode) {
          for (let i = accumulatedOutputs.length - 1; i >= 0; i--) {
            const raw = accumulatedOutputs[i].content;
            if (!raw || raw.length < 100) continue;
            const recovered = recoverFilesFromJSON(raw);
            if (recovered && Object.keys(recovered).length > 0) {
              console.warn("[useChat] Recovered", Object.keys(recovered).length, "files from raw content");
              finalCode = {
                files: recovered,
                entryFile: recovered["/App.tsx"] ? "/App.tsx" : Object.keys(recovered)[0],
                dependencies: {},
              };
              break;
            }
          }
        }

        // 先更新预览（必须在 DB 保存之前，避免 DB 失败阻断 UI 更新）
        store.setGeneratedCode(finalCode ?? null);
        store.setIsStreaming(false);
        onComplete?.(finalCode?.files);

        // 再异步保存到 Supabase（失败不影响预览）
        if (supabase && projectId && convId && finalCode) {
          try {
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
          } catch {
            // DB 保存失败不影响预览，静默处理
          }
        }
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

  // 1. 尝试提取 markdown 代码块
  const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (match) {
    cleaned = match[1].trim();
  } else if (cleaned.startsWith("```")) {
    // 有开头无结尾：去掉开头的 ```json 行
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").trim();
  }

  // 2. 用括号匹配找第一个完整的 JSON 对象（处理嵌套 { } 在字符串内的情况）
  const balanced = findBalancedJSON(cleaned);
  if (balanced) cleaned = balanced;

  try {
    const result = JSON.parse(cleaned) as Record<string, unknown>;
    return result;
  } catch (e) {
    console.warn("[useChat] JSON parse error:", (e as Error).message);
    console.warn("[useChat] First 300 chars:", cleaned.slice(0, 300));
    console.warn("[useChat] Last 300 chars:", cleaned.slice(-300));
    return null;
  }
}

/** 从截断的 JSON 中尽力恢复文件 */
function recoverFilesFromJSON(raw: string): Record<string, string> | null {
  const files: Record<string, string> = {};
  // 匹配 "/path.tsx": "content" 模式，content 可能包含转义字符
  const re = /"(\/[^"]+\.(?:tsx?|jsx?|css))"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const path = match[1];
    let content = match[2];
    // 反转义 JSON 字符串
    content = content.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
    files[path] = content;
  }
  return Object.keys(files).length > 0 ? files : null;
}

/** 从第一个 { 开始匹配括号，找到平衡的 JSON 对象 */
function findBalancedJSON(str: string): string | null {
  const first = str.indexOf("{");
  if (first === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = first; i < str.length; i++) {
    const ch = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) return str.slice(first, i + 1);
      }
    }
  }
  return null; // 括号不平衡
}
