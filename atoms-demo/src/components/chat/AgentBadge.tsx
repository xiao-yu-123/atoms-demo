// ============================================================================
// AgentBadge — Agent 角色标签
// ============================================================================

import type { AgentId } from "@/lib/prompts";

// ---------------------------------------------------------------------------
// Agent 视觉配置（用户指定配色）
// ---------------------------------------------------------------------------

export const AGENT_COLORS: Record<
  AgentId,
  { bg: string; text: string; border: string; dot: string }
> = {
  mike: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
  },
  iris: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
    dot: "bg-purple-400",
  },
  emma: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/30",
    dot: "bg-green-400",
  },
  bob: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/30",
    dot: "bg-orange-400",
  },
  alex: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    dot: "bg-red-400",
  },
};

const AGENT_LABELS: Record<AgentId, { name: string; emoji: string }> = {
  mike: { name: "Mike", emoji: "🧢" },
  iris: { name: "Iris", emoji: "🔍" },
  emma: { name: "Emma", emoji: "📋" },
  bob: { name: "Bob", emoji: "🏗️" },
  alex: { name: "Alex", emoji: "⚡" },
};

export interface AgentBadgeProps {
  agent: AgentId;
  /** 只显示圆点，不显示名称 */
  dotOnly?: boolean;
  /** 无背景色，仅文字 */
  ghost?: boolean;
  className?: string;
}

export function AgentBadge({ agent, dotOnly, ghost, className = "" }: AgentBadgeProps) {
  const colors = AGENT_COLORS[agent];
  const label = AGENT_LABELS[agent];

  if (dotOnly) {
    return (
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${colors.dot} ${className}`}
        title={label.name}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} ${ghost ? "border-transparent bg-transparent" : ""} ${className}`}
    >
      <span className="text-xs leading-none">{label.emoji}</span>
      <span>{label.name}</span>
    </span>
  );
}
