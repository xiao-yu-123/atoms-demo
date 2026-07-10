// ============================================================================
// Agent 编排类型定义
// ============================================================================

import type {
  AgentId,
  MikePlan,
  IrisResearch,
  EmmaPRD,
  BobArchitecture,
  AlexCode,
} from "@/lib/prompts";

/** Agent 标识（与 prompts.ts 对齐） */
export type { AgentId };

/** 单个 Agent 的输出 */
export interface AgentOutput {
  agent: AgentId;
  /** 原始文本输出 */
  content: string;
  /** 结构化数据（如果成功解析 JSON） */
  structuredData?: Record<string, unknown>;
  /** 模型名 */
  model: string;
  /** 完成时间 */
  timestamp: Date;
  /** token 用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** 编排结果 */
export interface OrchestrationResult {
  /** Mike 制定的执行计划 */
  plan: MikePlan;
  /** 按执行顺序排列的所有 Agent 输出 */
  outputs: AgentOutput[];
  /** Alex 的最终代码输出 */
  finalCode?: AlexCode;
  /** 总耗时（ms） */
  durationMs: number;
}

/** 流式输出事件 */
export interface AgentStreamEvent {
  type: "agent_start" | "agent_chunk" | "agent_done" | "orchestration_complete";
  agent?: AgentId;
  content?: string;
  structuredData?: Record<string, unknown>;
  plan?: MikePlan;
  finalCode?: AlexCode;
  error?: string;
}

/** 项目上下文（传给 Agent 的附加信息） */
export interface ProjectContext {
  projectId?: string;
  projectName?: string;
  existingFiles?: Record<string, string>;
  previousConversations?: string;
  userPreferences?: {
    theme?: "dark" | "light";
    stack?: string[];
  };
}

/** Agent 模型配置 */
export type AgentModelConfig = Partial<Record<AgentId, string>>;

/** 编排选项 */
export interface OrchestrationOptions {
  /** 覆盖默认模型 */
  modelOverrides?: AgentModelConfig;
  /** 是否启用流式输出 */
  stream?: boolean;
  /** 最大并发 Agent 数（当前仅串行，保留扩展点） */
  maxConcurrency?: number;
  /** 温度覆盖 */
  temperature?: number;
  /** Alex 的专门温度覆盖 */
  alexTemperature?: number;
}
