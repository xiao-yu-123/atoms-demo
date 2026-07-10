"use client";

// ============================================================================
// CodeEditor — Monaco 多文件代码编辑器
// ============================================================================

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  Lock,
  Unlock,
  FileCode,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Monaco 编辑器仅在客户端加载（SSR 禁用）
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      <FileCode className="mr-2 h-4 w-4 animate-pulse" />
      加载编辑器...
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeEditorProps {
  /** 文件映射 */
  files: Record<string, string>;
  /** 初始选中文件 */
  initialFile?: string;
  /** 代码变更回调（编辑模式） */
  onChange?: (path: string, content: string) => void;
  /** 外部类名 */
  className?: string;
}

// ---------------------------------------------------------------------------
// 语言映射
// ---------------------------------------------------------------------------

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
      return "typescriptreact";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascriptreact";
    case "js":
      return "javascript";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
      return "html";
    case "json":
      return "json";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

// ---------------------------------------------------------------------------
// 文件名简写（去掉公共前缀）
// ---------------------------------------------------------------------------

function shortPath(path: string): string {
  return path.replace(/^\//, "");
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function CodeEditor({
  files,
  initialFile,
  onChange,
  className = "",
}: CodeEditorProps) {
  const filePaths = useMemo(() => Object.keys(files).sort(), [files]);
  const [activeFile, setActiveFile] = useState(
    initialFile ?? filePaths[0] ?? "/App.tsx",
  );
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [copied, setCopied] = useState(false);

  // 确保 activeFile 在 files 中
  const currentContent = files[activeFile] ?? "";
  const currentLanguage = getLanguage(activeFile);

  // 切换文件
  const selectFile = useCallback(
    (path: string) => {
      if (files[path] !== undefined) {
        setActiveFile(path);
      }
    },
    [files],
  );

  // 代码变更
  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && onChange) {
        onChange(activeFile, value);
      }
    },
    [activeFile, onChange],
  );

  // 复制当前文件内容
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentContent]);

  return (
    <div className={`flex h-full flex-col bg-zinc-950 ${className}`}>
      {/* 顶部工具栏 — 紧凑 */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/50 px-2.5 py-1">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            代码
          </span>
          <Badge
            variant="outline"
            className="h-5 border-zinc-700 px-1.5 text-[10px] text-zinc-500"
          >
            {filePaths.length} 文件
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* 只读开关 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            onClick={() => setIsReadOnly(!isReadOnly)}
            title={isReadOnly ? "切换为编辑模式" : "切换为只读模式"}
          >
            {isReadOnly ? (
              <>
                <Lock className="h-3 w-3" />
                只读
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3 text-amber-400" />
                编辑
              </>
            )}
          </Button>

          {/* 复制 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title="复制文件内容"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </Button>
        </div>
      </div>

      {/* 文件标签栏 */}
      <div className="flex shrink-0 items-center border-b border-zinc-800/50 bg-zinc-950">
        {/* 桌面端：Tab 标签 */}
        <div className="flex flex-1 items-center overflow-x-auto scrollbar-none">
          {filePaths.slice(0, 12).map((path) => (
            <button
              key={path}
              onClick={() => selectFile(path)}
              className={`group flex shrink-0 items-center gap-1.5 border-r border-zinc-800 px-3 py-1.5 text-xs transition-colors ${
                path === activeFile
                  ? "border-b-2 border-b-emerald-400 bg-zinc-900 text-zinc-200"
                  : "border-b-2 border-b-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
              }`}
            >
              <span className="font-mono text-[11px]">{shortPath(path)}</span>
            </button>
          ))}

          {filePaths.length > 12 && (
            <span className="shrink-0 px-2 text-[11px] text-zinc-600">
              +{filePaths.length - 12}
            </span>
          )}
        </div>

        {/* 移动端/窄屏：Dropdown 文件选择 */}
        <div className="border-l border-zinc-800 px-1 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-zinc-400"
                />
              }
            >
              <span className="max-w-[80px] truncate font-mono text-[11px]">
                {shortPath(activeFile)}
              </span>
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {filePaths.map((path) => (
                <DropdownMenuItem
                  key={path}
                  onClick={() => selectFile(path)}
                  className="gap-2"
                >
                  <span className="font-mono text-xs">{shortPath(path)}</span>
                  {path === activeFile && (
                    <Badge
                      variant="outline"
                      className="ml-auto h-4 border-emerald-500/30 px-1 text-[10px] text-emerald-400"
                    >
                      当前
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Monaco 编辑器 */}
      <div className="flex-1">
        <MonacoEditor
          key={activeFile}
          language={currentLanguage}
          value={currentContent}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            readOnly: isReadOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'Geist Mono', 'Fira Code', 'Cascadia Code', monospace",
            lineNumbers: "on",
            renderWhitespace: "selection",
            tabSize: 2,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            wordWrap: "on",
            lineDecorationsWidth: 8,
          }}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              <FileCode className="mr-2 h-4 w-4 animate-pulse" />
              加载编辑器...
            </div>
          }
        />
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-1">
        <div className="flex items-center gap-3 text-[11px] text-zinc-600">
          <span className="font-mono">{shortPath(activeFile)}</span>
          <span>{currentLanguage}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-600">
          <span>{currentContent.split("\n").length} 行</span>
          {isReadOnly && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-amber-400">
              只读
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
