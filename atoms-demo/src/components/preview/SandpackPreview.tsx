"use client";

// ============================================================================
// SandpackPreview — AI 生成代码的实时预览
// ============================================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackLayout,
} from "@codesandbox/sandpack-react";
import {
  RefreshCw,
  Maximize,
  Minimize,
  Code,
  Eye,
  Loader2,
  Sparkles,
  AlertCircle,
  Download,
  ExternalLink,
} from "lucide-react";
import { downloadAsZip } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandpackPreviewProps {
  /** AI 生成的文件映射，null 表示尚未生成 */
  generatedCode: Record<string, string> | null;
  /** 是否正在生成代码 */
  isGenerating: boolean;
  /** 依赖配置（来自 Alex 输出） */
  dependencies?: Record<string, string>;
  /** 入口文件路径 */
  entryFile?: string;
  /** 额外内容高度 */
  className?: string;
}

// ---------------------------------------------------------------------------
// 默认文件模板（空状态 / loading 时使用）
// ---------------------------------------------------------------------------

const DEFAULT_FILES = {
  "/App.tsx": `export default function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-8">
      <div className="text-center">
        <div className="mb-4 text-5xl">✨</div>
        <h1 className="text-xl font-semibold text-zinc-200">
          等待 AI 生成应用
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          在左侧对话区描述你的想法，AI Agent 团队将为你构建应用
        </p>
      </div>
    </div>
  );
}`,
  "/styles.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: "Geist", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}`,
};

// ---------------------------------------------------------------------------
// 合并默认依赖
// ---------------------------------------------------------------------------

const BASE_DEPENDENCIES: Record<string, string> = {
  react: "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "lucide-react": "^0.300.0",
  zustand: "^5.0.0",
  uuid: "^9.0.0",
  "date-fns": "^3.0.0",
  clsx: "^2.0.0",
  "tailwind-merge": "^2.0.0",
  "class-variance-authority": "^0.7.0",
};

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function GeneratingSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-zinc-950">
      {/* 脉冲光环 */}
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      </div>

      <div className="text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          AI 正在构建你的应用...
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          这可能需要 30-60 秒，请耐心等待
        </p>
      </div>

      {/* 骨架线条 */}
      <div className="mt-4 w-64 space-y-2">
        <div className="h-2 animate-pulse rounded bg-zinc-800" />
        <div className="h-2 w-3/4 animate-pulse rounded bg-zinc-800" />
        <div className="h-2 w-1/2 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 错误边界（Sandpack render 错误不会 crash 整个页面）
// ---------------------------------------------------------------------------

function SandpackErrorBoundary({ error }: { error: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-950 p-8">
      <AlertCircle className="h-8 w-8 text-amber-400" />
      <p className="text-sm font-medium text-zinc-300">预览渲染出错</p>
      <pre className="max-h-40 max-w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-500">
        {error}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function SandpackPreviewWrapper({
  generatedCode,
  isGenerating,
  dependencies,
  entryFile,
  className = "",
}: SandpackPreviewProps) {
  const [key, setKey] = useState(0);
  const [viewMode, setViewMode] = useState<"preview" | "code" | "split">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // generatedCode 更新时重建 SandpackProvider
  useEffect(() => {
    if (generatedCode) {
      setKey((prev) => prev + 1);
    }
  }, [generatedCode]);

  // 构建 files
  const files = useMemo(() => {
    if (!generatedCode || Object.keys(generatedCode).length === 0) {
      return DEFAULT_FILES;
    }

    // 确保有入口文件
    const hasEntry = Object.keys(generatedCode).some(
      (p) => p.endsWith("App.tsx") || p.endsWith("App.jsx"),
    );

    if (!hasEntry) {
      return {
        ...DEFAULT_FILES,
        ...generatedCode,
      };
    }

    return generatedCode;
  }, [generatedCode]);

  // 合并依赖
  const mergedDependencies = useMemo(() => {
    if (!dependencies || Object.keys(dependencies).length === 0) {
      return BASE_DEPENDENCIES;
    }
    // 确保基础依赖不被覆盖
    return { ...dependencies, react: BASE_DEPENDENCIES.react, "react-dom": BASE_DEPENDENCIES["react-dom"] };
  }, [dependencies]);

  // 确定入口文件（去掉开头的 /，Sandpack 用相对路径）
  const entry = useMemo(() => {
    const strip = (p: string) => p.replace(/^\//, "");
    if (entryFile) return strip(entryFile);
    const fileNames = Object.keys(files);
    const appTsx = fileNames.find((f) => f.endsWith("App.tsx"));
    if (appTsx) return strip(appTsx);
    const appJsx = fileNames.find((f) => f.endsWith("App.jsx"));
    if (appJsx) return strip(appJsx);
    const appJs = fileNames.find((f) => f.endsWith("App.js"));
    if (appJs) return strip(appJs);
    return "App.tsx";
  }, [files, entryFile]);

  // 标准化文件路径（确保 Sandpack 兼容）
  const normalizedFiles = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [path, content] of Object.entries(files)) {
      // 确保路径以 / 开头
      const key = path.startsWith("/") ? path : `/${path}`;
      result[key] = content;
    }
    return result;
  }, [files]);

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // 监听 Escape 退出全屏
  useEffect(() => {
    const handler = () => setIsFullscreen(false);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // 文件数量
  const fileCount = generatedCode ? Object.keys(generatedCode).length : 0;

  // ------------------------------------------------------------------
  // 状态：Loading
  // ------------------------------------------------------------------
  if (isGenerating) {
    return (
      <div
        className={`flex h-full flex-col border border-zinc-800 bg-zinc-950 ${className}`}
      >
        <GeneratingSkeleton />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 默认 Sandpack 配置
  // ------------------------------------------------------------------
  const sandpackOptions = {
    showNavigator: true,
    showTabs: true,
    showLineNumbers: true,
    showInlineErrors: true,
    wrapContent: true,
    editorHeight: "100%",
    editorWidthPercentage: 60,
    externalResources: ["https://cdn.tailwindcss.com"],
  };

  return (
    <div
      ref={containerRef}
      className={`flex h-full flex-col bg-zinc-950 ${className} ${
        isFullscreen ? "fixed inset-0 z-50 border border-zinc-800" : ""
      }`}
    >
      {/* 工具栏 — 紧凑模式 */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-2.5 py-1">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            预览
          </span>
          {fileCount > 0 && (
            <Badge
              variant="outline"
              className="h-5 border-zinc-700 px-1.5 text-[10px] text-zinc-500"
            >
              {fileCount} 文件
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 视图切换 */}
          <div className="mr-2 flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            <button
              onClick={() => setViewMode("preview")}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                viewMode === "preview"
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Eye className="inline h-3 w-3" /> 预览
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                viewMode === "code"
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Code className="inline h-3 w-3" /> 代码
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                viewMode === "split"
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              分屏
            </button>
          </div>

          {/* 刷新 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setKey((prev) => prev + 1)}
            title="刷新预览"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
          </Button>

          {/* 导出 ZIP */}
          {fileCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                downloadAsZip(
                  generatedCode ?? {},
                  generatedCode
                    ? Object.keys(generatedCode)[0]?.replace(/^\//, "").split("/")[0] ?? "atoms-project"
                    : "atoms-project",
                )
              }
              title="下载 ZIP"
            >
              <Download className="h-3.5 w-3.5 text-zinc-500" />
            </Button>
          )}

          {/* 新标签页打开 */}
          {fileCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                const win = window.open("", "_blank");
                if (win && generatedCode) {
                  const html = buildStandaloneHTML(generatedCode);
                  win.document.write(html);
                  win.document.close();
                }
              }}
              title="在新标签页打开"
            >
              <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
            </Button>
          )}

          {/* 全屏 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleFullscreen}
            title={isFullscreen ? "退出全屏" : "全屏预览"}
          >
            {isFullscreen ? (
              <Minimize className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <Maximize className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </Button>
        </div>
      </div>

      {/* Sandpack */}
      <div className="flex-1 overflow-hidden">
        <SandpackProvider
          key={key}
          template="react"
          files={{
            // 覆盖模板默认入口，使用 .jsx 支持 JSX 语法
            "/index.jsx": `import React from "react";
import { createRoot } from "react-dom/client";
import AppImport from "${entry.startsWith("/") ? entry : `/${entry}`}";
// 兼容 default 和 named 导出
const App = AppImport && (AppImport.default || AppImport.App || AppImport);
const el = document.getElementById("root");
if (!el) throw new Error("root not found");
const root = createRoot(el);
if (typeof App !== "function") throw new Error("App component not found. Please use 'export default function App()' in App file.");
root.render(<React.StrictMode><App /></React.StrictMode>);`,
            ...normalizedFiles,
          }}
          customSetup={{
            entry: "/index.jsx",
            dependencies: mergedDependencies,
          }}
          options={sandpackOptions}
        >
          <SandpackLayout
            style={{ height: "100%", border: "none", borderRadius: 0 }}
          >
            {(viewMode === "preview" || viewMode === "split") && (
              <SandpackPreview
                showNavigator
                showRefreshButton={false}
                style={{ height: "100%" }}
              />
            )}

            {(viewMode === "code" || viewMode === "split") && (
              <SandpackCodeEditor
                showLineNumbers
                showTabs
                style={{ height: "100%" }}
              />
            )}
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 构建独立 HTML 用于新标签页预览
// ---------------------------------------------------------------------------

function buildStandaloneHTML(files: Record<string, string>): string {
  const appTsx = files["/App.tsx"] ?? files["/App.jsx"] ?? "";
  const styles = files["/styles.css"] ?? files["/index.css"] ?? "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atoms Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    ${styles.replace(/<\/?style>/g, "")}
  </style>
</head>
<body class="dark bg-zinc-950 text-zinc-100">
  <div id="root" style="min-height:100vh;display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column;gap:1rem;padding:2rem;text-align:center">
    <p style="font-size:3rem">⚡</p>
    <h2 style="font-size:1.25rem;font-weight:600;color:#e4e4e7">Atoms 预览</h2>
    <p style="color:#71717a;font-size:0.875rem;max-width:24rem">
      包含 React 组件，完整效果请用右侧 Sandpack 预览或导出 ZIP。
    </p>
    <div style="margin-top:1rem;padding:1rem;background:#18181b;border-radius:0.5rem;max-width:100%;overflow:auto">
      <pre style="color:#a1a1aa;font-size:0.75rem;text-align:left;white-space:pre-wrap">${escapeHtml(appTsx.slice(0, 2000))}</pre>
    </div>
    <p style="color:#52525b;font-size:0.75rem">
      ${Object.keys(files).length} 个文件 · ${Object.values(files).reduce((s, c) => s + c.length, 0).toLocaleString()} 字符
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
