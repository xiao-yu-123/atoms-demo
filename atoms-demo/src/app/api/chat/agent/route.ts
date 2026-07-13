// ============================================================================
// POST /api/chat/agent — 单 Agent 流式端点
// 每个 Agent 一次 HTTP 请求，SSE 流式返回，适合 Vercel serverless 限制
// ============================================================================

import { NextRequest } from "next/server";
import { streamAgentResponse } from "@/lib/agents";
import { AGENT_META } from "@/lib/prompts";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AgentId } from "@/lib/prompts";
import type { AgentOutput } from "@/types/agent";

export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentRequest {
  agent: string;
  userInput: string;
  context: AgentOutput[];
  projectId?: string;
  conversationId?: string;
}

interface SSEMessage {
  type: "agent_start" | "agent_stream" | "agent_complete" | "error";
  agent?: string;
  content?: string;
  summary?: string;
  fullContent?: string;
  message?: string;
  conversationId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_AGENTS = new Set(["mike", "iris", "emma", "bob", "alex"]);

function sse(msg: SSEMessage): string {
  return `data: ${JSON.stringify(msg)}\n\n`;
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

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return new Response(sse({ type: "error", message: "无效的请求体" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const { agent: agentRaw, userInput, context, projectId, conversationId } = body;

  if (!agentRaw || !VALID_AGENTS.has(agentRaw)) {
    return new Response(sse({ type: "error", message: `无效的 Agent: ${agentRaw}` }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const agent = agentRaw as AgentId;
  const meta = AGENT_META[agent];

  // Supabase
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;
  try {
    supabase = await createSupabaseServerClient();
  } catch { /* 无 Supabase 时继续 */ }

  const { data: { user } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (msg: SSEMessage) => {
        controller.enqueue(encoder.encode(sse(msg)));
      };

      try {
        enqueue({ type: "agent_start", agent });

        let fullContent = "";

        for await (const event of streamAgentResponse(agent, userInput, context ?? [])) {
          if (event.type === "agent_chunk" && event.content) {
            fullContent += event.content;
            enqueue({ type: "agent_stream", agent, content: event.content });
          }
        }

        enqueue({
          type: "agent_complete",
          agent,
          summary: extractSummary(fullContent),
          fullContent,
          conversationId,
        });

        // 保存消息到 Supabase
        if (user && supabase && conversationId) {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "agent",
            agent_name: meta.name,
            content: fullContent,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Agent 调用失败";
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
