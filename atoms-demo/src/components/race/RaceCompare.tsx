"use client";

// ============================================================================
// RaceCompare — 竞速对比评分区
// ============================================================================

import { Trophy, Zap, FileCode, Clock, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RaceModelId, RaceModelState } from "@/stores/race-store";
import { RACE_MODELS } from "@/stores/race-store";

export interface RaceCompareProps {
  models: Record<RaceModelId, RaceModelState>;
  preferredModel: RaceModelId | null;
  onVote: (model: RaceModelId) => void;
  onDeploy: (model: RaceModelId) => void;
  className?: string;
}

export function RaceCompare({
  models,
  preferredModel,
  onVote,
  onDeploy,
  className = "",
}: RaceCompareProps) {
  const entries = RACE_MODELS.map((meta) => ({
    ...meta,
    state: models[meta.id],
  }));

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        <Trophy className="h-3.5 w-3.5" />
        对比结果
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {entries.map(({ id, label, emoji, color, state }) => {
          const code = state.code;
          const fileCount = code ? Object.keys(code.files).length : 0;
          const codeLength = state.content.length;

          return (
            <Card
              key={id}
              className={`border-zinc-800 bg-zinc-900/50 p-3 ${
                preferredModel === id
                  ? "ring-1 ring-emerald-500/40"
                  : ""
              }`}
            >
              {/* 模型名 */}
              <div className="flex items-center gap-2 mb-2">
                <span>{emoji}</span>
                <span className={`text-sm font-semibold ${color}`}>
                  {label}
                </span>
              </div>

              {/* 统计 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-zinc-800/50 px-2 py-1.5 text-center">
                  <p className="text-lg font-mono font-semibold text-zinc-200">
                    {fileCount}
                  </p>
                  <p className="text-[10px] text-zinc-500">生成文件</p>
                </div>
                <div className="rounded-md bg-zinc-800/50 px-2 py-1.5 text-center">
                  <p className="text-lg font-mono font-semibold text-zinc-200">
                    {(state.elapsedMs / 1000).toFixed(1)}s
                  </p>
                  <p className="text-[10px] text-zinc-500">耗时</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {codeLength.toLocaleString()} 字符
                </span>
                {state.elapsedMs > 0 && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    ~{codeLength > 0 && state.elapsedMs > 0
                      ? Math.round(codeLength / (state.elapsedMs / 1000))
                      : 0} c/s
                  </span>
                )}
              </div>

              {/* 投票/部署 */}
              <div className="mt-3 flex gap-1.5">
                <Button
                  variant={preferredModel === id ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => onVote(id)}
                >
                  {preferredModel === id ? "✓ 已选" : "👍 更喜欢"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => onDeploy(id)}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
