// ============================================================================
// POST /api/chat/plan — Mike 计划端点
// 创建 conversation → 保存用户消息 → 调用 Mike → 返回 plan
// ============================================================================

import { NextRequest } from "next/server";
import { callAgent } from "@/lib/agents";
import { AGENT_META } from "@/lib/prompts";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { MikePlan } from "@/lib/prompts";

export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanRequest {
  projectId?: string;
  userInput: string;
  conversationId?: string;
}

interface PlanResponse {
  plan: MikePlan | null;
  mikeContent: string;
  mikeSummary: string;
  conversationId: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: PlanResponse, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function parseAgentPlan(content: string): MikePlan | null {
  try {
    const cleaned = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const data = JSON.parse(cleaned);
    const agents = data.agents as string[] | undefined;
    const steps = data.steps as MikePlan["steps"] | undefined;
    if (!agents || !steps) return null;
    return {
      goal: (data.goal as string) ?? "",
      agents: agents.filter((a): a is "mike" | "iris" | "emma" | "bob" | "alex" =>
        ["mike", "iris", "emma", "bob", "alex"].includes(a),
      ),
      reasoning: (data.reasoning as string) ?? "",
      steps,
    };
  } catch {
    return null;
  }
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
  let body: PlanRequest;
  try {
    body = (await req.json()) as PlanRequest;
  } catch {
    return jsonResponse({ plan: null, mikeContent: "", mikeSummary: "", conversationId: null, error: "无效的请求体" }, { status: 400 });
  }

  const { userInput, projectId, conversationId } = body;
  if (!userInput?.trim()) {
    return jsonResponse({ plan: null, mikeContent: "", mikeSummary: "", conversationId: null, error: "userInput 不能为空" }, { status: 400 });
  }

  // Supabase
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;
  try {
    supabase = await createSupabaseServerClient();
  } catch { /* 无 Supabase 时继续 */ }

  const { data: { user } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  // Profile
  if (user && supabase) {
    await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" }).select().maybeSingle();
  }

  // Conversation
  let convId = conversationId ?? null;
  if (user && supabase && !convId && projectId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ project_id: projectId, title: userInput.slice(0, 60) })
      .select("id")
      .single();
    if (conv) convId = conv.id;
  }

  // 保存用户消息
  if (user && supabase && convId) {
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: userInput,
    });
  }

  // 调用 Mike
  let mikeContent = "";
  let plan: MikePlan | null = null;

  try {
    const mikeResult = await callAgent("mike", userInput, [], { projectId });
    mikeContent = mikeResult.content;
    plan = parseAgentPlan(mikeContent);

    // 保存 Mike 消息
    if (user && supabase && convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "agent",
        agent_name: AGENT_META.mike.name,
        content: mikeContent,
        metadata: plan ? { plan } : {},
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mike 调用失败";
    return jsonResponse({ plan: null, mikeContent: "", mikeSummary: "", conversationId: null, error: message }, { status: 500 });
  }

  if (!plan || plan.agents.length === 0) {
    return jsonResponse({
      plan: null,
      mikeContent,
      mikeSummary: extractSummary(mikeContent),
      conversationId: convId,
      error: "Mike 未能生成有效的执行计划，请尝试更具体地描述需求。",
    });
  }

  return jsonResponse({
    plan,
    mikeContent,
    mikeSummary: extractSummary(mikeContent),
    conversationId: convId,
  });
}
