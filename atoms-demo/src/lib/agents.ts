// ============================================================================
// Agent 编排核心逻辑
// 文件: src/lib/agents.ts
//
// 核心流程:
//   用户输入 → Mike 制定执行计划 → 依次调用各 Agent（串行）
//   → 前序 Agent 输出作为后续 Agent 上下文 → Alex 最终生成代码
// ============================================================================

import "server-only";

import { openai } from "./ai-clients";
import { buildPrompt, AGENT_META } from "./prompts";
import type {
  AgentId,
  MikePlan,
  AlexCode,
} from "./prompts";
import type {
  AgentOutput,
  OrchestrationResult,
  OrchestrationOptions,
  AgentStreamEvent,
  ProjectContext,
} from "@/types/agent";

// ---------------------------------------------------------------------------
// 模型配置（百炼平台）
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<AgentId, string> = {
  mike: "qwen3.7-max-2026-05-20",
  iris: "qwen3.7-max-2026-05-20",
  emma: "qwen3.7-max-2026-05-20",
  bob: "qwen3.7-max-2026-05-20",
  alex: "qwen3.7-max-2026-05-20",
};

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 核心编排函数：串行调用 Agent 链
 *
 * @example
 * const result = await orchestrateAgents("做一个 todo 应用", {
 *   projectId: "xxx",
 *   onAgentStart: (a) => console.log(`🚀 ${a} 开始工作`),
 *   onAgentOutput: (o) => console.log(`✅ ${o.agent} 完成`),
 * });
 * // result.finalCode.files → 直接传给 Sandpack
 */
export async function orchestrateAgents(
  userInput: string,
  options: {
    projectContext?: ProjectContext;
    onAgentStart?: (agent: AgentId) => void;
    onAgentOutput?: (output: AgentOutput) => void;
    onError?: (agent: AgentId, error: Error) => void;
  } = {},
  orchestratorOptions?: OrchestrationOptions,
): Promise<OrchestrationResult> {
  const startedAt = Date.now();
  const outputs: AgentOutput[] = [];

  // Step 1: Mike 制定计划
  options.onAgentStart?.("mike");

  let mikeResult: AgentOutput;
  try {
    mikeResult = await callAgent("mike", userInput, outputs, options.projectContext, orchestratorOptions);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    options.onError?.("mike", error);
    throw error;
  }
  outputs.push(mikeResult);
  options.onAgentOutput?.(mikeResult);

  // 解析 Mike 的执行计划
  const plan = parseAgentPlan(mikeResult);
  if (!plan || plan.agents.length === 0) {
    throw new Error("Mike 未能生成有效的执行计划");
  }

  // Step 2: 按计划串行执行各 Agent（跳过 Mike，已经执行）
  for (const step of plan.steps) {
    const agent = step.agent;
    if (agent === "mike") continue;

    options.onAgentStart?.(agent);

    try {
      const result = await callAgent(agent, userInput, outputs, options.projectContext, orchestratorOptions);
      outputs.push(result);
      options.onAgentOutput?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options.onError?.(agent, error);
      throw error;
    }
  }

  // Step 3: 提取 Alex 的最终代码
  const alexOutput = outputs.find((o) => o.agent === "alex");
  const finalCode: AlexCode | undefined = alexOutput
    ? parseAlexOutput(alexOutput) ?? undefined
    : undefined;

  return {
    plan,
    outputs,
    finalCode,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * 调用单个 Agent
 */
export async function callAgent(
  agent: AgentId,
  userInput: string,
  previousOutputs: AgentOutput[],
  projectContext?: ProjectContext,
  options?: OrchestrationOptions,
): Promise<AgentOutput> {
  const model = options?.modelOverrides?.[agent] ?? DEFAULT_MODELS[agent];
  const temperature =
    agent === "alex"
      ? (options?.alexTemperature ?? 0.2)
      : (options?.temperature ?? 0.7);

  // 构建上下文：将前序 Agent 输出序列化
  const serializedContext = serializeContext(previousOutputs, projectContext);
  const systemPrompt = buildPrompt(agent, userInput, serializedContext || undefined);

  // max_tokens 按 Agent 分层：Alex 最大，Emma 需要完整 PRD
  const maxTokens = agent === "alex" ? 4096 : agent === "emma" ? 3000 : agent === "mike" ? 800 : 2000;

  const response = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请开始执行${agent === "mike" ? "，制定执行计划" : ""}。` },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const usage = response.usage;

  return {
    agent,
    content,
    structuredData: tryParseJSON(content) ?? undefined,
    model,
    timestamp: new Date(),
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * 流式调用单个 Agent — 返回 AsyncGenerator
 *
 * @example
 * for await (const chunk of streamAgent("alex", userInput, outputs)) {
 *   res.write(`data: ${JSON.stringify(chunk)}\n\n`);
 * }
 */
export async function* streamAgentResponse(
  agent: AgentId,
  userInput: string,
  previousOutputs: AgentOutput[],
  projectContext?: ProjectContext,
  options?: OrchestrationOptions,
): AsyncGenerator<Partial<AgentStreamEvent>> {
  const model = options?.modelOverrides?.[agent] ?? DEFAULT_MODELS[agent];
  const temperature =
    agent === "alex"
      ? (options?.alexTemperature ?? 0.2)
      : (options?.temperature ?? 0.7);

  const serializedContext = serializeContext(previousOutputs, projectContext);
  const systemPrompt = buildPrompt(agent, userInput, serializedContext || undefined);

  // max_tokens 按 Agent 分层
  const maxTokens = agent === "alex" ? 4096 : agent === "emma" ? 3000 : agent === "mike" ? 800 : 2000;

  // 发出 agent_start 事件
  yield { type: "agent_start", agent };

  let fullContent = "";

  const stream = await openai.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请开始执行${agent === "mike" ? "，制定执行计划" : ""}。` },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullContent += delta;
      yield { type: "agent_chunk", agent, content: delta };
    }
  }

  // 尝试解析结构化输出
  const structuredData = tryParseJSON(fullContent) ?? undefined;

  // 发出 agent_done 事件
  yield { type: "agent_done", agent, content: fullContent, structuredData };
}

/**
 * 完整流式编排 — 依次调用所有 Agent，每个 chunk 实时推送
 */
export async function* streamOrchestration(
  userInput: string,
  projectContext?: ProjectContext,
  options?: OrchestrationOptions,
): AsyncGenerator<AgentStreamEvent> {
  const outputs: AgentOutput[] = [];

  // Step 1: Mike
  for await (const event of streamAgentResponse("mike", userInput, outputs, projectContext, options)) {
    yield event as AgentStreamEvent;
  }

  // 从流式输出中提取 Mike 的最终结果，解析执行计划
  const mikeContent = (() => {
    // 需要从外部传入最终 content — 流式场景需要额外处理
    // 这里用非流式 fallback 获取完整内容
    return "";
  })();

  // 因为流式已结束，用 callAgent 获取完整 Mike 输出以解析计划
  const mikeResult = await callAgent("mike", userInput, outputs, projectContext, options);
  outputs.push(mikeResult);
  const plan = parseAgentPlan(mikeResult);

  if (!plan || plan.agents.length === 0) {
    yield { type: "orchestration_complete", error: "Mike 未能生成有效的执行计划" };
    return;
  }
  yield { type: "agent_chunk", agent: "mike", content: "", structuredData: { plan } };

  // Step 2: 按计划流式调用
  for (const step of plan.steps) {
    const agent = step.agent;
    if (agent === "mike") continue;

    let fullContent = "";

    for await (const event of streamAgentResponse(agent, userInput, outputs, projectContext, options)) {
      yield event as AgentStreamEvent;
      if (event.type === "agent_done" && event.content) {
        fullContent = event.content;
      }
    }

    outputs.push({
      agent,
      content: fullContent,
      structuredData: tryParseJSON(fullContent) ?? undefined,
      model: options?.modelOverrides?.[agent] ?? DEFAULT_MODELS[agent],
      timestamp: new Date(),
    });
  }

  // Step 3: 提取 Alex 代码
  const alexOutput = outputs.find((o) => o.agent === "alex");
  const finalCode = alexOutput ? parseAlexOutput(alexOutput) ?? undefined : undefined;

  yield { type: "orchestration_complete", finalCode };
}

// ---------------------------------------------------------------------------
// 内部工具函数
// ---------------------------------------------------------------------------

/**
 * 将前序 Agent 输出序列化为上下文字符串
 */
function serializeContext(
  outputs: AgentOutput[],
  projectContext?: ProjectContext,
): string {
  const parts: string[] = [];

  if (projectContext?.projectName) {
    parts.push(`## 项目信息\n- 项目名: ${projectContext.projectName}`);
  }
  if (projectContext?.userPreferences?.theme) {
    parts.push(`- 主题偏好: ${projectContext.userPreferences.theme}`);
  }

  if (outputs.length > 0) {
    parts.push("\n## 前序 Agent 输出\n");
    for (const output of outputs) {
      const meta = AGENT_META[output.agent];
      parts.push(
        `### ${meta.emoji} ${meta.name} (${output.agent})`,
        `模型: ${output.model}`,
        `输出:\n${output.content}`,
        "---",
      );
    }
  }

  return parts.join("\n");
}

/**
 * 安全解析 JSON
 */
function tryParseJSON(content: string): Record<string, unknown> | null {
  if (!content) return null;

  // 去除可能的 markdown 代码块包裹
  let cleaned = content.trim();

  // 去掉 ```json ... ``` 或 ``` ... ``` 包裹
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // 尝试找到第一个 { 和最后一个 }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 从 Mike 的输出中解析执行计划
 */
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

/**
 * 从 Alex 的输出中提取 Sandpack 代码文件
 */
function parseAlexOutput(output: AgentOutput): AlexCode | null {
  const data = output.structuredData;
  if (!data) return null;

  const files = data.files as Record<string, string> | undefined;
  if (!files || Object.keys(files).length === 0) return null;

  return {
    files,
    entryFile: (data.entryFile as string) ?? "/App.tsx",
    dependencies: (data.dependencies as Record<string, string>) ?? {},
  };
}
