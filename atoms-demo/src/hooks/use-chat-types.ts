// ============================================================================
// SSE Chat Event 类型（前后端共享契约）
// ============================================================================

import type { AlexCode } from "@/lib/prompts";

export type SSEChatEventType =
  | "rewrite_start"
  | "rewrite_complete"
  | "agent_start"
  | "agent_stream"
  | "agent_complete"
  | "orchestration_complete"
  | "error";

export interface SSEChatEvent {
  type: SSEChatEventType;
  agent?: string;
  content?: string;
  summary?: string;
  fullContent?: string;
  code?: AlexCode;
  message?: string;
  conversationId?: string;
  original?: string;
  rewritten?: string;
}
