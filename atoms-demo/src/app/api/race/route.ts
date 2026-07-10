// ============================================================================
// Race API — 多模型竞速 SSE 端点
// POST /api/race
// ============================================================================

import { NextRequest } from "next/server";
import { openai, anthropic } from "@/lib/ai-clients";
import { buildAlexPrompt } from "@/lib/prompts";

// ---------------------------------------------------------------------------
// SSE 工具
// ---------------------------------------------------------------------------

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// 构建竞速 Prompt
// ---------------------------------------------------------------------------

function buildRacePrompt(userPrompt: string, projectContext?: string): string {
  const contextBlock = projectContext
    ? `## 项目上下文\n${projectContext}\n`
    : "";
  return `${contextBlock}## 用户需求\n"${userPrompt}"`;
}

// ---------------------------------------------------------------------------
// POST /api/race
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { prompt: string; projectContext?: string };
  try {
    body = (await req.json()) as { prompt: string; projectContext?: string };
  } catch {
    return new Response(
      sse({ type: "race_error", message: "无效的请求体" }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const { prompt, projectContext } = body;
  if (!prompt?.trim()) {
    return new Response(
      sse({ type: "race_error", message: "prompt 不能为空" }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const userMessage = buildRacePrompt(prompt.trim(), projectContext);
  const systemPrompt = buildAlexPrompt(prompt.trim(), projectContext);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: unknown) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      const startedAt = Date.now();

      // 记录每个模型的开始时间
      const modelStartTimes: Record<string, number> = {};

      try {
        // ------------------------------------------------------------------
        // 并行调用两个模型
        // ------------------------------------------------------------------

        // OpenAI (百炼 GPT-4o)
        const openaiTask = (async () => {
          const modelId = "gpt-4o";
          modelStartTimes[modelId] = Date.now();

          enqueue({ type: "race_start", model: modelId });

          let fullContent = "";

          try {
            const response = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
              temperature: 0.2,
              stream: true,
            });

            for await (const chunk of response) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                enqueue({
                  type: "race_stream",
                  model: modelId,
                  content: delta,
                });
              }
            }
          } catch (err) {
            enqueue({
              type: "race_model_error",
              model: modelId,
              message: err instanceof Error ? err.message : "OpenAI 调用失败",
            });
            return { modelId, fullContent };
          }

          const elapsed = Date.now() - modelStartTimes[modelId];

          enqueue({
            type: "race_model_complete",
            model: modelId,
            fullContent,
            elapsedMs: elapsed,
          });

          return { modelId, fullContent, elapsedMs: elapsed };
        })();

        // Claude (MiniMax 代理)
        const claudeTask = (async () => {
          const modelId = "claude-sonnet-4-20250514";
          modelStartTimes[modelId] = Date.now();

          enqueue({ type: "race_start", model: modelId });

          let fullContent = "";

          try {
            const response = anthropic.messages.stream({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
              temperature: 0.2,
            });

            for await (const event of response) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                fullContent += event.delta.text;
                enqueue({
                  type: "race_stream",
                  model: modelId,
                  content: event.delta.text,
                });
              }
            }
          } catch (err) {
            enqueue({
              type: "race_model_error",
              model: modelId,
              message:
                err instanceof Error ? err.message : "Claude 调用失败",
            });
            return { modelId, fullContent };
          }

          const elapsed = Date.now() - modelStartTimes[modelId];

          enqueue({
            type: "race_model_complete",
            model: modelId,
            fullContent,
            elapsedMs: elapsed,
          });

          return { modelId, fullContent, elapsedMs: elapsed };
        })();

        // 并行执行
        const results = await Promise.all([openaiTask, claudeTask]);

        // ------------------------------------------------------------------
        // 全部完成
        // ------------------------------------------------------------------
        enqueue({
          type: "race_all_complete",
          totalElapsedMs: Date.now() - startedAt,
          results: results.map((r) => ({
            model: r.modelId,
            elapsedMs: r.elapsedMs ?? 0,
            codeLength: r.fullContent.length,
          })),
        });
      } catch (err) {
        enqueue({
          type: "race_error",
          message: err instanceof Error ? err.message : "竞速执行失败",
        });
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
