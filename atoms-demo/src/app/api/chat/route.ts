// ============================================================================
// Chat API — SSE 流式对话
// POST /api/chat
// ============================================================================

import { NextRequest } from "next/server";
import { callAgent, streamAgentResponse } from "@/lib/agents";
import { openai } from "@/lib/ai-clients";
import { AGENT_META } from "@/lib/prompts";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AgentId, MikePlan, AlexCode } from "@/lib/prompts";
import type { AgentOutput, ProjectContext } from "@/types/agent";

// ---------------------------------------------------------------------------
// Route Segment Config — Vercel Serverless 超时 & 流式响应
// ---------------------------------------------------------------------------

export const maxDuration = 60; // 秒（Vercel Pro 上限）

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface ChatRequest {
  projectId?: string;
  userInput: string;
  conversationId?: string;
}

interface SSEMessage {
  type:
    | "rewrite_start"
    | "rewrite_complete"
    | "agent_start"
    | "agent_stream"
    | "agent_complete"
    | "orchestration_complete"
    | "error";
  agent?: string;
  content?: string;
  summary?: string;
  fullContent?: string;
  code?: AlexCode;
  message?: string;
  conversationId?: string;
  original?: string;
  rewritten?: string;
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function sse(msg: SSEMessage): string {
  return `data: ${JSON.stringify(msg)}\n\n`;
}

/**
 * 重写用户输入：将模糊需求扩展为清晰的产品 Brief
 */
async function rewriteQuery(rawInput: string): Promise<string> {
  const prompt = `你是一个需求分析专家。用户给了一个简短的产品需求，请将它重写为一份清晰、具体、可执行的产品 Brief。

## 重写规则
1. **明确核心功能**：列出至少 5 个具体功能点，每个一句话
2. **补充隐性需求**：用户没提到但必要的功能（如搜索、筛选、数据持久化、空状态等）
3. **明确不做什么**：界定范围，避免过度设计
4. **用户角色**：谁会使用这个产品？
5. **技术约束**：React 应用，使用 Supabase 作为后端数据库（PostgreSQL + Auth + RLS），支持完整的数据持久化和用户认证

## 输出格式
直接输出重写后的 Brief，用中文，不超过 500 字。不要输出 JSON，不要用 markdown 标题。

## 用户原始需求
"${rawInput}"

## 重写后的产品 Brief：`;

  try {
    const response = await openai.chat.completions.create({
      model: "qwen3.7-max-2026-06-08",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 600,
    });
    return response.choices[0]?.message?.content ?? rawInput;
  } catch {
    return rawInput; // 重写失败时退回原始输入
  }
}

function parseAgentPlan(output: AgentOutput): MikePlan | null {
  const data = output.structuredData;
  if (!data) return null;
  const agents = data.agents as string[] | undefined;
  const steps = data.steps as MikePlan["steps"] | undefined;
  if (!agents || !steps) return null;
  return {
    goal: (data.goal as string) ?? "",
    agents: agents.filter((a): a is AgentId =>
      ["mike", "iris", "emma", "bob", "alex"].includes(a),
    ),
    reasoning: (data.reasoning as string) ?? "",
    steps,
  };
}

function extractSummary(content: string, maxLen = 500): string {
  // 尝试提取 JSON，失败则返回文本前 N 字符
  const firstBrace = content.indexOf("{");
  if (firstBrace === 0 || firstBrace > 0) {
    // JSON 输出 — 取 goal / overview / summary 字段
    try {
      const cleaned = content.slice(firstBrace, content.lastIndexOf("}") + 1);
      const parsed = JSON.parse(cleaned);
      return (
        parsed.summary ??
        parsed.overview ??
        parsed.goal ??
        JSON.stringify(parsed).slice(0, maxLen)
      );
    } catch {
      // fall through
    }
  }
  return content.slice(0, maxLen) + (content.length > maxLen ? "..." : "");
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(sse({ type: "error", message: "无效的请求体" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const { userInput, projectId, conversationId } = body;

  if (!userInput?.trim()) {
    return new Response(sse({ type: "error", message: "userInput 不能为空" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // 验证 Supabase 配置
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null =
    null;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    // Supabase 不可用时继续运行，仅跳过持久化
  }

  // 获取当前用户
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  // 确保 profile 存在
  if (user && supabase) {
    await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" }).select().maybeSingle();
  }

  // 创建/获取 conversation
  let convId = conversationId;

  if (user && supabase && !convId && projectId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({
        project_id: projectId,
        title: userInput.slice(0, 60),
      })
      .select("id")
      .single();
    if (conv) convId = conv.id;
  }

  const projectContext: ProjectContext = {
    projectId,
    userPreferences: { theme: "dark" },
  };

  // SSE ReadableStream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (msg: SSEMessage) => {
        controller.enqueue(encoder.encode(sse(msg)));
      };

      try {
        // ------------------------------------------------------------------
        // Step 0: 重写用户输入 → 清晰的产品 Brief
        // ------------------------------------------------------------------
        enqueue({ type: "rewrite_start" });

        const rewrittenInput = await rewriteQuery(userInput);

        enqueue({
          type: "rewrite_complete",
          original: userInput,
          rewritten: rewrittenInput,
        });

        // 使用重写后的输入进行后续 Agent 流程
        const effectiveInput = rewrittenInput;

        // ------------------------------------------------------------------
        // Step 1: Mike 制定计划（非流式，确保可靠解析计划）
        // ------------------------------------------------------------------
        enqueue({ type: "agent_start", agent: "mike" });

        const mikeResult = await callAgent("mike", effectiveInput, [], projectContext);

        // 流式推送 Mike 的输出（模拟 chunk）
        const mikeChunks = mikeResult.content.match(/.{1,80}/g) ?? [mikeResult.content];
        for (const chunk of mikeChunks) {
          enqueue({ type: "agent_stream", agent: "mike", content: chunk });
        }

        enqueue({
          type: "agent_complete",
          agent: "mike",
          summary: extractSummary(mikeResult.content),
          fullContent: mikeResult.content,
          conversationId: convId ?? undefined,
        });

        const plan = parseAgentPlan(mikeResult);
        if (!plan || plan.agents.length === 0) {
          enqueue({
            type: "error",
            message: "Mike 未能生成有效的执行计划，请尝试更具体地描述需求。",
          });
          controller.close();
          return;
        }

        // 保存 Mike 的消息
        if (user && supabase && convId) {
          await supabase.from("messages").insert({
            conversation_id: convId,
            role: "agent",
            agent_name: "Mike",
            content: mikeResult.content,
            metadata: { plan },
          });
        }

        const allOutputs: AgentOutput[] = [mikeResult];

        // ------------------------------------------------------------------
        // Step 2: 按计划流式执行后续 Agent
        // ------------------------------------------------------------------
        for (const step of plan.steps) {
          const agent = step.agent;
          if (agent === "mike") continue;

          const meta = AGENT_META[agent];
          enqueue({ type: "agent_start", agent });

          // 流式调用
          let fullContent = "";
          for await (const event of streamAgentResponse(
            agent,
            effectiveInput,
            allOutputs,
            projectContext,
          )) {
            if (event.type === "agent_chunk" && event.content) {
              fullContent += event.content;
              enqueue({ type: "agent_stream", agent, content: event.content });
            }
          }

          const agentOutput: AgentOutput = {
            agent,
            content: fullContent,
            structuredData: (() => {
              try {
                const cleaned = fullContent.slice(
                  fullContent.indexOf("{"),
                  fullContent.lastIndexOf("}") + 1,
                );
                return JSON.parse(cleaned);
              } catch {
                return undefined;
              }
            })(),
            model: "streaming",
            timestamp: new Date(),
          };

          allOutputs.push(agentOutput);

          enqueue({
            type: "agent_complete",
            agent,
            summary: extractSummary(fullContent),
            fullContent,
            conversationId: convId ?? undefined,
          });

          // 保存消息
          if (user && supabase && convId) {
            await supabase.from("messages").insert({
              conversation_id: convId,
              role: "agent",
              agent_name: meta.name,
              content: fullContent,
              metadata: agentOutput.structuredData ?? {},
            });
          }
        }

        // ------------------------------------------------------------------
        // Step 3: 提取 Alex 代码 + 最终事件
        // ------------------------------------------------------------------
        const alexOutput = allOutputs.find((o) => o.agent === "alex");
        let finalCode: AlexCode | undefined;

        if (alexOutput?.structuredData) {
          const d = alexOutput.structuredData;
          const files = d.files as Record<string, string> | undefined;
          if (files && Object.keys(files).length > 0) {
            finalCode = {
              files,
              entryFile: (d.entryFile as string) ?? "/App.tsx",
              dependencies: (d.dependencies as Record<string, string>) ?? {},
            };
          }
        }

        // 保存生成代码（版本号自动递增）
        if (user && supabase && projectId && convId && finalCode) {
          // 查询当前最大版本号
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

          // 更新项目状态为 building（如果还是 draft）
          await supabase
            .from("projects")
            .update({ status: "building" })
            .eq("id", projectId)
            .eq("status", "draft");
        }

        enqueue({
          type: "orchestration_complete",
          code: finalCode,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "未知错误";
        enqueue({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
