"use client";

// ============================================================================
// PreviewTabs — 预览 / 代码 双视图切换
// ============================================================================

import { useState } from "react";
import { Eye, Code, PanelLeft, PanelRight } from "lucide-react";
import { SandpackPreviewWrapper } from "./SandpackPreview";
import { CodeEditor } from "./CodeEditor";
import type { SandpackPreviewProps } from "./SandpackPreview";
import type { CodeEditorProps } from "./CodeEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewTabsProps {
  /** Sandpack 预览的 props */
  preview: SandpackPreviewProps;
  /** CodeEditor 的 props */
  codeEditor: CodeEditorProps;
  /** 默认 Tab */
  defaultTab?: "preview" | "code";
  /** 外部类名 */
  className?: string;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function PreviewTabs({
  preview,
  codeEditor,
  defaultTab = "preview",
  className = "",
}: PreviewTabsProps) {
  const [tab, setTab] = useState<"preview" | "code">(defaultTab);
  const [isVertical, setIsVertical] = useState(false);

  return (
    <div className={`flex h-full flex-col bg-zinc-950 ${className}`}>
      {/* Tab 切换栏 — 紧凑 */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/50 bg-zinc-950 px-2">
        <div className="flex items-center">
          <button
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "preview"
                ? "border-b-2 border-emerald-400 text-zinc-200"
                : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            预览
          </button>
          <button
            onClick={() => setTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "code"
                ? "border-b-2 border-emerald-400 text-zinc-200"
                : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            代码
          </button>
        </div>
      </div>

      {/* 内容区：零边距填满 */}
      <div className="flex-1 min-h-0">
        {tab === "preview" && <SandpackPreviewWrapper {...preview} />}
        {tab === "code" && <CodeEditor {...codeEditor} />}
      </div>
    </div>
  );
}
