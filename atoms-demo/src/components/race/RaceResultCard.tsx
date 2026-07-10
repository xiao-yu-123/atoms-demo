"use client";

// ============================================================================
// RaceResultCard — 单个模型的竞速结果卡片
// ============================================================================

import { Loader2, Check, Clock, FileCode, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SandpackPreviewWrapper } from "@/components/preview/SandpackPreview";
import type { RaceModelId, RaceModelState } from "@/stores/race-store";
import { RACE_MODELS } from "@/stores/race-store";

export interface RaceResultCardProps {
  modelId: RaceModelId;
  state: RaceModelState;
  isWinner?: boolean;
  onVote?: (model: RaceModelId) => void;
  className?: string;
}

export function RaceResultCard({
  modelId,
  state,
  isWinner,
  onVote,
  className = "",
}: RaceResultCardProps) {
  const meta = RACE_MODELS.find((m) => m.id === modelId)!;
  const hasCode = state.code !== null;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border transition-all ${
        isWinner
          ? "border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
          : "border-zinc-800 bg-zinc-900/50"
      } ${className}`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.emoji}</span>
          <span className={`text-sm font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          {isWinner && (
            <Badge className="h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-400">
              <Trophy className="h-2.5 w-2.5" />
              最佳
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {state.elapsedMs > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Clock className="h-3 w-3" />
              {(state.elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
          {hasCode && (
            <Badge
              variant="outline"
              className="h-5 border-zinc-700 px-1.5 text-[10px] text-zinc-500"
            >
              <FileCode className="mr-1 h-2.5 w-2.5" />
              {Object.keys(state.code!.files).length} 文件
            </Badge>
          )}
        </div>
      </div>

      {/* 预览区 */}
      <div className="flex-1 min-h-0">
        {state.isStreaming && !hasCode ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
            <Loader2 className={`h-6 w-6 animate-spin ${meta.color}`} />
            <p className="text-xs text-zinc-500">生成中...</p>
            <p className="max-w-[200px] truncate text-xs text-zinc-600 font-mono">
              {state.content.slice(-60)}
            </p>
          </div>
        ) : hasCode ? (
          <SandpackPreviewWrapper
            generatedCode={state.code!.files}
            isGenerating={false}
            dependencies={state.code!.dependencies}
            entryFile={state.code!.entryFile}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-xs text-zinc-600">等待生成...</p>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      {onVote && hasCode && (
        <div className="border-t border-zinc-800 px-3 py-2">
          <Button
            variant={isWinner ? "default" : "outline"}
            size="sm"
            className="w-full gap-1.5"
            onClick={() => onVote(modelId)}
          >
            {isWinner ? (
              <>
                <Check className="h-3.5 w-3.5" />
                已选择
              </>
            ) : (
              <>
                👍 更喜欢这个
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
