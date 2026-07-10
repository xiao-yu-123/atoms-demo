"use client";

// ============================================================================
// ChatMessage — 单条对话消息
// ============================================================================

import { useState } from "react";
import { User, ChevronDown, ChevronUp, Bot, Loader2 } from "lucide-react";
import { AgentBadge } from "./AgentBadge";
import type { AgentId } from "@/lib/prompts";
import type { ChatMessage as ChatMessageType } from "@/stores/chat-store";

export interface ChatMessageProps {
  message: ChatMessageType;
}

/** 从 agentName 映射到 AgentId，用于 Badge 配色 */
function toAgentId(name?: string): AgentId | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (["mike", "iris", "emma", "bob", "alex"].includes(lower)) {
    return lower as AgentId;
  }
  return null;
}

/** Agent 消息（左对齐） */
function AgentMessage({
  message,
}: {
  message: ChatMessageType & { role: "agent" };
}) {
  const [expanded, setExpanded] = useState(false);
  const agentId = toAgentId(message.agentName);
  const isLong = message.content.length > 300;

  return (
    <div className="flex gap-3">
      {/* 头像区 */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-zinc-700">
          {message.isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          ) : (
            <Bot className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="min-w-0 flex-1">
        {/* Agent 标签行 */}
        <div className="mb-1.5 flex items-center gap-2">
          {agentId ? (
            <AgentBadge agent={agentId} />
          ) : (
            <span className="text-xs font-medium text-zinc-500">
              {message.agentName ?? "Agent"}
            </span>
          )}
          <span className="text-[11px] text-zinc-600">
            {message.isStreaming ? "正在输出..." : ""}
          </span>
        </div>

        {/* 消息正文 — 折叠/展开 + 独立滚动 */}
        <div
          className={`relative rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 ${
            isLong && !expanded ? "max-h-24 overflow-hidden" : isLong ? "max-h-52 overflow-y-auto" : ""
          }`}
        >
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
            {message.content || (message.isStreaming ? "" : "（无内容）")}
          </pre>

          {/* 流式光标 */}
          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-400 align-text-bottom" />
          )}

          {/* 展开/收起按钮 */}
          {isLong && !message.isStreaming && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> 收起
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> 展开完整输出
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 用户消息（右对齐） */
function UserMessage({
  message,
}: {
  message: ChatMessageType & { role: "user" };
}) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-[80%]">
        <div className="mb-1.5 text-right">
          <span className="text-xs font-medium text-zinc-500">你</span>
        </div>
        <div className="rounded-lg bg-zinc-800 px-3.5 py-2.5">
          <p className="text-sm leading-relaxed text-zinc-200">
            {message.content}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-start">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 ring-1 ring-zinc-600">
          <User className="h-4 w-4 text-zinc-300" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return <UserMessage message={message as ChatMessageType & { role: "user" }} />;
  }
  return <AgentMessage message={message as ChatMessageType & { role: "agent" }} />;
}
