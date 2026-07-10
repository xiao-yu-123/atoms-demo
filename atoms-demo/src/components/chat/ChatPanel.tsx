"use client";

// ============================================================================
// ChatPanel — 对话面板（单列：消息列表 + 输入框）
// ============================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, AlertCircle, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { useChat } from "@/hooks/use-chat";

export interface ChatPanelProps {
  projectId: string;
  conversationId?: string;
  className?: string;
}

export function ChatPanel({
  projectId,
  className = "",
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    abort,
  } = useChat({ projectId });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送
  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  }, [input, isStreaming, sendMessage]);

  // Enter 发送，Shift+Enter 换行
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex h-full flex-col bg-zinc-950 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">对话</span>
          {isStreaming && (
            <Badge variant="outline" className="h-5 border-emerald-500/30 px-2 text-[10px] text-emerald-400">
              <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
              生成中
            </Badge>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                <Sparkles className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200">开始对话</h3>
              <p className="mt-1 text-sm text-zinc-500">
                描述你的想法，AI Agent 团队将为你构建应用
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["做一个待办事项应用", "搭建一个 AI 聊天界面", "创建一个数据仪表盘"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
              <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs text-red-400"
                onClick={() => {
                  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
                  if (lastUserMsg) sendMessage(lastUserMsg.content);
                }}>
                <RotateCcw className="mr-1 h-3 w-3" />重试
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 输入框 */}
      <div className="border-t border-zinc-800 px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想构建的应用..."
            rows={2}
            disabled={isStreaming}
            className="min-h-[44px] resize-none border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/20"
          />
          {isStreaming ? (
            <Button size="icon" variant="destructive" className="h-10 w-10 shrink-0" onClick={abort}>
              <span className="h-3 w-3 rounded-sm bg-current" />
            </Button>
          ) : (
            <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
