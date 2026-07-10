// ============================================================================
// Race Store — 竞速模式状态管理
// ============================================================================

import { create } from "zustand";
import type { AlexCode } from "@/lib/prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RaceModelId = "gpt-4o" | "claude-sonnet-4-20250514";

export const RACE_MODELS: { id: RaceModelId; label: string; emoji: string; color: string }[] = [
  { id: "gpt-4o", label: "GPT-4o", emoji: "🤖", color: "text-emerald-400" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet", emoji: "🧠", color: "text-violet-400" },
];

export interface RaceModelState {
  content: string;
  isStreaming: boolean;
  code: AlexCode | null;
  elapsedMs: number;
}

export interface RaceState {
  prompt: string;
  setPrompt: (p: string) => void;

  models: Record<RaceModelId, RaceModelState>;
  setModelContent: (model: RaceModelId, content: string) => void;
  appendModelContent: (model: RaceModelId, chunk: string) => void;
  setModelStreaming: (model: RaceModelId, v: boolean) => void;
  setModelCode: (model: RaceModelId, code: AlexCode | null) => void;
  setModelElapsed: (model: RaceModelId, ms: number) => void;

  isRacing: boolean;
  setIsRacing: (v: boolean) => void;
  raceComplete: boolean;
  setRaceComplete: (v: boolean) => void;

  // 投票：用户选择的偏好模型
  preferredModel: RaceModelId | null;
  setPreferredModel: (model: RaceModelId | null) => void;

  // 重置
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial model state
// ---------------------------------------------------------------------------

const initialModelState: RaceModelState = {
  content: "",
  isStreaming: false,
  code: null,
  elapsedMs: 0,
};

const initialModels = {
  "gpt-4o": { ...initialModelState },
  "claude-sonnet-4-20250514": { ...initialModelState },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRaceStore = create<RaceState>((set) => ({
  prompt: "",
  setPrompt: (p) => set({ prompt: p }),

  models: initialModels,

  setModelContent: (model, content) =>
    set((s) => ({
      models: { ...s.models, [model]: { ...s.models[model], content } },
    })),

  appendModelContent: (model, chunk) =>
    set((s) => ({
      models: {
        ...s.models,
        [model]: {
          ...s.models[model],
          content: s.models[model].content + chunk,
        },
      },
    })),

  setModelStreaming: (model, v) =>
    set((s) => ({
      models: { ...s.models, [model]: { ...s.models[model], isStreaming: v } },
    })),

  setModelCode: (model, code) =>
    set((s) => ({
      models: { ...s.models, [model]: { ...s.models[model], code } },
    })),

  setModelElapsed: (model, ms) =>
    set((s) => ({
      models: { ...s.models, [model]: { ...s.models[model], elapsedMs: ms } },
    })),

  isRacing: false,
  setIsRacing: (v) => set({ isRacing: v }),

  raceComplete: false,
  setRaceComplete: (v) => set({ raceComplete: v }),

  preferredModel: null,
  setPreferredModel: (model) => set({ preferredModel: model }),

  reset: () =>
    set({
      prompt: "",
      models: { ...initialModels },
      isRacing: false,
      raceComplete: false,
      preferredModel: null,
    }),
}));
