"use client";

// ============================================================================
// AgentFlow — Agent 执行流水线可视化 ⭐
// ============================================================================

import { Check, Loader2, Dot } from "lucide-react";
import { AgentBadge, AGENT_COLORS } from "./AgentBadge";
import { useChatStore } from "@/stores/chat-store";
import type { AgentId } from "@/lib/prompts";
import type { AgentState } from "@/stores/chat-store";

const PIPELINE_ORDER: AgentId[] = ["mike", "iris", "emma", "bob", "alex"];

const STATE_ICONS: Record<AgentState, React.ReactNode> = {
  idle: <Dot className="h-4 w-4 text-zinc-600" />,
  running: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <Check className="h-4 w-4 text-emerald-400" />,
  error: <Dot className="h-4 w-4 text-red-400" />,
};

export function AgentFlow() {
  const agentStates = useChatStore((s) => s.agentStates);
  const agentFullContent = useChatStore((s) => s.agentFullContent);
  const isStreaming = useChatStore((s) => s.isStreaming);

  return (
    <div className="flex flex-col gap-0">
      {/* 标题 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Agent 流水线
        </span>
        {isStreaming && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            运行中
          </span>
        )}
      </div>

      {/* 流水线节点 */}
      <div className="relative flex flex-col gap-0">
        {PIPELINE_ORDER.map((agent, index) => {
          const state = agentStates[agent] ?? "idle";
          const content = agentFullContent[agent];
          const colors = AGENT_COLORS[agent];
          const isLast = index === PIPELINE_ORDER.length - 1;

          return (
            <div key={agent} className="relative flex gap-3">
              {/* 竖线连接线 */}
              {!isLast && (
                <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-zinc-800">
                  {/* 进度填充（当前激活的线变亮） */}
                  {state === "completed" && (
                    <div className="h-full w-full bg-zinc-600" />
                  )}
                  {state === "running" && (
                    <div className="h-full w-full animate-pulse bg-zinc-500" />
                  )}
                </div>
              )}

              {/* 节点圆点 */}
              <div
                className={`relative z-10 mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  state === "running"
                    ? `${colors.border} ${colors.bg} shadow-[0_0_8px_var(--tw-ring-color)] ring-2 ${colors.border.replace("border", "ring")}/50`
                    : state === "completed"
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-zinc-700 bg-zinc-900"
                }`}
              >
                {STATE_ICONS[state]}
              </div>

              {/* 节点内容 — 独立滚动 */}
              <div
                className={`flex-1 min-w-0 rounded-lg border transition-all duration-300 ${
                  state === "running"
                    ? `${colors.border} ${colors.bg} border-opacity-50`
                    : state === "completed"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-zinc-800/50 bg-transparent"
                }`}
              >
                {/* 头部：Agent 名称 */}
                <div className="flex items-center justify-between px-3 py-1.5">
                  <AgentBadge agent={agent} ghost={state === "idle"} />
                </div>

                {/* 正文 — 独立可滚动 */}
                {content && state === "completed" && (
                  <div className="max-h-36 overflow-y-auto border-t border-emerald-500/10 px-3 py-2">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-400">
                      {content}
                    </pre>
                  </div>
                )}

                {/* 运行中提示 */}
                {state === "running" && (
                  <div className="border-t border-zinc-800/50 px-3 py-2">
                    <p className="flex items-center gap-1 text-xs text-zinc-500">
                      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current" />
                      正在执行...
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** AgentFlow 的紧凑版（横向列表，用于小空间） */
export function AgentFlowInline() {
  const agentStates = useChatStore((s) => s.agentStates);

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_ORDER.map((agent, i) => {
        const state = agentStates[agent] ?? "idle";
        const colors = AGENT_COLORS[agent];
        const isActive = state === "running";
        const isDone = state === "completed";

        return (
          <div key={agent} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[10px] text-zinc-700">
                {isDone ? "→" : "·"}
              </span>
            )}
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs transition-all ${
                isActive
                  ? `${colors.bg} ring-1 ${colors.border}`
                  : isDone
                    ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "bg-zinc-800 text-zinc-600"
              }`}
              title={agent}
            >
              {isDone ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : isActive ? (
                <Loader2
                  className={`h-3 w-3 animate-spin ${colors.text}`}
                />
              ) : (
                <Dot className="h-3 w-3" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
