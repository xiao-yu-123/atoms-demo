"use client";

// ============================================================================
// 项目详情页 — ChatPanel + PreviewTabs 整合
// 路由: /project/[id]
// ============================================================================

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Settings2,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentFlow, AgentFlowInline } from "@/components/chat/AgentFlow";
import { PreviewTabs } from "@/components/preview/PreviewTabs";
import { ResizablePanel } from "@/components/layout/ResizablePanel";
import { useChatStore } from "@/stores/chat-store";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Status Badge 映射
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: "草稿",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  },
  building: {
    label: "构建中",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  completed: {
    label: "已完成",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  deployed: {
    label: "已部署",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
};

// ---------------------------------------------------------------------------
// 页面组件
// ---------------------------------------------------------------------------

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zustand — 共享给 PreviewTabs 的只读数据
  const generatedCode = useChatStore((s) => s.generatedCode);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const agentStates = useChatStore((s) => s.agentStates);
  const resetChat = useChatStore((s) => s.reset);

  // 进入项目页时清空上一次的对话残留（防止跨项目污染）
  useEffect(() => {
    resetChat();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // 加载项目数据
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) {
      setError("Supabase 未配置");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error: supabaseError } = await supabase!
        .from("projects")
        .select("id, name, description, status, updated_at")
        .eq("id", projectId)
        .single();

      if (cancelled) return;

      if (supabaseError || !data) {
        setError("项目不存在或无权访问");
        setLoading(false);
        return;
      }

      setProject(data as ProjectData);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <ProjectHeaderSkeleton />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error
  // ------------------------------------------------------------------
  if (error || !project) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div className="flex items-center border-b border-zinc-800 px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <AlertCircle className="h-10 w-10 text-amber-400" />
          <p className="text-sm text-zinc-400">{error ?? "未知错误"}</p>
          <Button variant="outline" size="sm" render={<Link href="/" />} nativeButton={false}>
            回到首页
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 构建 PreviewTabs 所需的 props
  // ------------------------------------------------------------------
  // 合并前端代码 + 后端 SQL + API 路由，全部可查看
  const allFiles = { ...(generatedCode?.files ?? {}) };
  if (generatedCode?.sqlMigration) {
    allFiles["/backend/migration.sql"] = generatedCode.sqlMigration;
  }
  if (generatedCode?.apiRoutes) {
    Object.assign(allFiles, generatedCode.apiRoutes);
  }

  const previewProps = {
    generatedCode: generatedCode?.files ?? null,
    isGenerating: isStreaming,
    dependencies: generatedCode?.dependencies,
    entryFile: generatedCode?.entryFile,
  };

  const codeEditorProps = {
    files: allFiles,
    initialFile: Object.keys(allFiles)[0],
  };

  // 是否有任何已完成的 Agent
  const hasActivity = Object.values(agentStates).some(
    (s) => s === "completed" || s === "running",
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* ================================================================ */}
      {/* 顶部项目信息栏 */}
      {/* ================================================================ */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
          </Button>

          {/* 项目信息 */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-zinc-200">
                {project.name}
              </h1>
              <Badge
                variant="outline"
                className={`h-5 shrink-0 px-1.5 text-[10px] font-medium ${
                  STATUS_CONFIG[project.status]?.className ??
                  STATUS_CONFIG.draft.className
                }`}
              >
                {STATUS_CONFIG[project.status]?.label ?? project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="truncate text-[11px] text-zinc-500">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Agent 状态指示器（紧凑版） */}
          {hasActivity && <AgentFlowInline />}

          {/* 分享 */}
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Share2 className="h-3.5 w-3.5 text-zinc-500" />
          </Button>

          {/* 设置 */}
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings2 className="h-3.5 w-3.5 text-zinc-500" />
          </Button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 主工作区：三栏可拖拽布局 3:3:4 */}
      {/* ================================================================ */}
      <ResizablePanel
        initialRatios={[3, 3, 4]}
        minWidths={[280, 240, 320]}
        className="flex-1"
      >
        {/* 左栏 — ChatPanel */}
        <ChatPanel projectId={projectId} />

        {/* 中栏 — Agent 流水线 + 依赖信息 */}
        <div className="flex flex-col border-x border-zinc-800 bg-zinc-950">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <AgentFlow />

            {/* 依赖信息 */}
            {generatedCode && (
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  依赖
                </span>
                {generatedCode.dependencies &&
                  Object.keys(generatedCode.dependencies).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(generatedCode.dependencies).map(
                        ([name, version]) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] font-mono text-zinc-400"
                          >
                            {name}
                            <span className="text-zinc-600">@{version}</span>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                {(!generatedCode.dependencies ||
                  Object.keys(generatedCode.dependencies).length === 0) && (
                    <p className="text-xs text-zinc-600">无额外依赖</p>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* 右栏 — 预览 + 代码 */}
        {generatedCode || isStreaming ? (
          <PreviewTabs
            preview={previewProps}
            codeEditor={codeEditorProps}
            defaultTab="preview"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-zinc-950 px-8">
            <div className="relative mb-2">
              <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                <Sparkles className="h-7 w-7 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-zinc-200">准备就绪</h3>
            <p className="max-w-xs text-center text-sm text-zinc-500">
              在左侧对话区描述你的想法，AI Agent 团队将为你生成可运行的应用代码。
            </p>
          </div>
        )}
      </ResizablePanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header Loading Skeleton
// ---------------------------------------------------------------------------

function ProjectHeaderSkeleton() {
  return (
    <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
      <Skeleton className="h-8 w-8 rounded-md bg-zinc-800" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-32 rounded bg-zinc-800" />
        <Skeleton className="h-3 w-48 rounded bg-zinc-800" />
      </div>
    </header>
  );
}
