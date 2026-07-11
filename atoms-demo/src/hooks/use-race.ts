"use client";

// ============================================================================
// useRace — 竞速模式 Hook
// ============================================================================

import { useCallback, useRef } from "react";
import { useRaceStore } from "@/stores/race-store";
import type { RaceModelId } from "@/stores/race-store";
import type { AlexCode } from "@/lib/prompts";

interface RaceSSEEvent {
  type: string;
  model?: string;
  content?: string;
  fullContent?: string;
  elapsedMs?: number;
  totalElapsedMs?: number;
  results?: { model: string; elapsedMs: number; codeLength: number }[];
  message?: string;
}

export function useRace() {
  const store = useRaceStore();
  const abortRef = useRef<AbortController | null>(null);

  const startRace = useCallback(
    async (prompt: string, projectContext?: string) => {
      if (!prompt.trim() || store.isRacing) return;

      store.reset();
      store.setPrompt(prompt);
      store.setIsRacing(true);

      Object.keys(store.models).forEach((m) => {
        store.setModelStreaming(m as RaceModelId, true);
      });

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const response = await fetch("/api/race", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), projectContext }),
          signal: abort.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");

        const decoder = new TextDecoder();
        let buffer = "";

        // 用于追踪每个模型的开始时间
        const modelStartTimes: Partial<Record<RaceModelId, number>> = {};

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
              const event = JSON.parse(jsonStr) as RaceSSEEvent;
              handleEvent(event, modelStartTimes);
            } catch {
              // skip parse errors
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        store.setIsRacing(false);
      }
    },
    [store],
  );

  const handleEvent = useCallback(
    (event: RaceSSEEvent, startTimes: Partial<Record<RaceModelId, number>>) => {
      const model = event.model as RaceModelId | undefined;

      switch (event.type) {
        case "race_start": {
          if (model) {
            store.setModelStreaming(model, true);
            store.setModelContent(model, "");
          }
          break;
        }

        case "race_stream": {
          if (model && event.content) {
            store.appendModelContent(model, event.content);
          }
          break;
        }

        case "race_model_complete": {
          if (model) {
            store.setModelStreaming(model, false);

            // 解析 code
            const code = parseAlexCodeFromContent(
              event.fullContent ?? store.models[model].content,
            );
            store.setModelCode(model, code);

            if (event.elapsedMs) {
              store.setModelElapsed(model, event.elapsedMs);
            }
          }
          break;
        }

        case "race_model_error": {
          if (model) {
            store.setModelStreaming(model, false);
          }
          break;
        }

        case "race_all_complete": {
          store.setIsRacing(false);
          store.setRaceComplete(true);
          break;
        }

        case "race_error": {
          store.setIsRacing(false);
          break;
        }
      }
    },
    [store],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    store.setIsRacing(false);
  }, [store]);

  const vote = useCallback(
    (model: RaceModelId) => {
      store.setPreferredModel(model);
    },
    [store],
  );

  return {
    prompt: store.prompt,
    models: store.models,
    isRacing: store.isRacing,
    raceComplete: store.raceComplete,
    preferredModel: store.preferredModel,
    startRace,
    abort,
    vote,
    reset: store.reset,
  };
}

// ---------------------------------------------------------------------------
// 工具：从 LLM 输出中解析 Alex 代码
// ---------------------------------------------------------------------------

function parseAlexCodeFromContent(content: string): AlexCode | null {
  if (!content) return null;

  try {
    // 去除可能的 markdown 包裹
    let cleaned = content.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) return null;

    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

    const files = parsed.files as Record<string, string> | undefined;
    if (!files || Object.keys(files).length === 0) return null;

    return {
      files,
      entryFile: (parsed.entryFile as string) ?? "/App.tsx",
      dependencies: (parsed.dependencies as Record<string, string>) ?? {},
    };
  } catch {
    return null;
  }
}
