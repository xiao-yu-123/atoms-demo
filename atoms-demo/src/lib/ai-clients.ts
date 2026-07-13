/**
 * AI SDK 客户端配置
 *
 * - Claude API Key 通过 MiniMax 代理，baseURL → https://api.minimaxi.com/anthropic
 * - OpenAI API Key 通过阿里百炼平台，baseURL → https://dashscope.aliyuncs.com/compatible-mode/v1
 *
 * ⚠️ 这些客户端仅用于服务端（Server Components / Route Handlers / Server Actions）。
 *    不要在客户端组件中直接使用，避免泄漏 API Key。
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Anthropic (Claude) — MiniMax 代理
// ---------------------------------------------------------------------------

export const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  baseURL:
    process.env.CLAUDE_BASE_URL || "https://api.minimaxi.com/anthropic",
});

// ---------------------------------------------------------------------------
// OpenAI — 阿里百炼 代理
// ---------------------------------------------------------------------------

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL:
    process.env.OPENAI_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

// ---------------------------------------------------------------------------
// 便捷封装
// ---------------------------------------------------------------------------

/** 调用 Claude（MiniMax 代理），返回文本内容 */
export async function chatWithClaude(
  systemPrompt: string,
  userMessage: string,
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const model = options?.model || "MiniMax-M2.7";
  const maxTokens = options?.maxTokens || 4096;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return (textBlock as { text?: string } | undefined)?.text ?? "";
}

/** 调用 OpenAI（百炼代理），返回文本内容 */
export async function chatWithOpenAI(
  systemPrompt: string,
  userMessage: string,
  options?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<string> {
  const model = options?.model || "qwen3.7-max-2026-05-20";
  const maxTokens = options?.maxTokens || 4096;
  const temperature = options?.temperature ?? 0.7;

  const response = await openai.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}
