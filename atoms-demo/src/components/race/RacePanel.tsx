"use client";

// ============================================================================
// RacePanel — 竞速主面板
// ============================================================================

import { useState, useCallback } from "react";
import {
  Zap,
  Send,
  RotateCcw,
  Loader2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RaceResultCard } from "./RaceResultCard";
import { RaceCompare } from "./RaceCompare";
import { useRace } from "@/hooks/use-race";
import type { RaceModelId } from "@/stores/race-store";
import { RACE_MODELS } from "@/stores/race-store";

export interface RacePanelProps {
  projectId?: string;
  className?: string;
}

export function RacePanel({ projectId, className = "" }: RacePanelProps) {
  const [input, setInput] = useState("");

  const {
    models,
    isRacing,
    raceComplete,
    preferredModel,
    startRace,
    abort,
    vote,
    reset,
  } = useRace();

  const handleStart = useCallback(() => {
    if (!input.trim() || isRacing) return;
    startRace(input.trim(), projectId ? `projectId: ${projectId}` : undefined);
  }, [input, isRacing, startRace, projectId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleDeploy = useCallback(
    (model: RaceModelId) => {
      // TODO: 将选择的结果保存为项目正式版本
      const code = models[model].code;
      if (code && projectId) {
        // 存入 Supabase generated_code 表
        console.log("Deploy", model, code);
      }
    },
    [models, projectId],
  );

  const hasResults = raceComplete || Object.values(models).some((m) => m.content.length > 0);

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-zinc-200">
            Race Mode
          </span>
          <Badge
            variant="outline"
            className="h-5 border-amber-500/30 px-1.5 text-[10px] text-amber-400"
          >
            BETA
          </Badge>
          {isRacing && (
            <Badge className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              竞速中
            </Badge>
          )}
        </div>

        {hasResults && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新竞速
          </Button>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {!hasResults ? (
          /* ============================================================ */
          /* 输入界面 */
          /* ============================================================ */
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-pulse rounded-full bg-amber-500/20 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-zinc-900">
                <Trophy className="h-7 w-7 text-amber-400" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-zinc-200">
              AI 模型竞速
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              两个模型同时生成，你来选择更好的结果
            </p>

            <div className="mt-6 flex items-center gap-3">
              {RACE_MODELS.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1"
                >
                  <span>{m.emoji}</span>
                  <span className={`text-xs font-medium ${m.color}`}>
                    {m.label}
                  </span>
                  <span className="text-[10px] text-zinc-600">VS</span>
                </div>
              ))}
            </div>

            <div className="mt-8 w-full max-w-lg">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述你想构建的应用..."
                  rows={3}
                  disabled={isRacing}
                  className="min-h-[60px] resize-none border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
                {isRacing ? (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-10 w-10 shrink-0"
                    onClick={abort}
                  >
                    <span className="h-3 w-3 rounded-sm bg-current" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-10 w-10 shrink-0 bg-amber-500 hover:bg-amber-600"
                    onClick={handleStart}
                    disabled={!input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* 结果对比 */
          /* ============================================================ */
          <div className="p-4 space-y-4">
            {/* 两列结果卡片 */}
            <div className="grid grid-cols-2 gap-4" style={{ height: "calc(100vh - 300px)", minHeight: "400px" }}>
              {RACE_MODELS.map(({ id }) => (
                <RaceResultCard
                  key={id}
                  modelId={id}
                  state={models[id]}
                  isWinner={preferredModel === id}
                  onVote={raceComplete ? vote : undefined}
                />
              ))}
            </div>

            {/* 对比与部署 */}
            {raceComplete && (
              <RaceCompare
                models={models}
                preferredModel={preferredModel}
                onVote={vote}
                onDeploy={handleDeploy}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
