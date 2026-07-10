"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Sparkles,
  Code2,
  MoreHorizontal,
  Clock,
  Play,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/hooks/use-project";
import type { Project } from "@/hooks/use-project";

// ---------------------------------------------------------------------------
// 状态 Badge 配置
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: "草稿",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  },
  building: {
    label: "构建中",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  completed: {
    label: "已完成",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  deployed: {
    label: "已部署",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  },
};

// ---------------------------------------------------------------------------
// 格式化时间
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

// ---------------------------------------------------------------------------
// 空状态
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-32">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
          <Sparkles className="h-8 w-8 text-emerald-400" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
        你想创造什么？
      </h2>
      <p className="mt-2 max-w-sm text-center text-sm text-zinc-500">
        你的第一个 AI 原型从这里开始。不需要任何配置，只需一个想法。
      </p>

      <div className="mt-8 flex gap-3">
        <Button size="lg" onClick={onCreateClick} className="gap-2">
          <Plus className="h-4 w-4" />
          创建第一个项目
        </Button>
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/race" />}
          nativeButton={false}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Race Mode
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ProjectCardSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg bg-zinc-800" />
          <Skeleton className="h-5 w-32 rounded bg-zinc-800" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full rounded bg-zinc-800" />
        <Skeleton className="h-4 w-3/4 rounded bg-zinc-800" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-12 rounded-full bg-zinc-800" />
          <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
        </div>
        <Skeleton className="h-3 w-24 rounded bg-zinc-800" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 项目卡片
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const statusConfig =
    STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="group relative cursor-pointer border-zinc-800 bg-zinc-900/80 transition-all duration-200 hover:scale-[1.02] hover:border-zinc-700 hover:shadow-lg hover:shadow-emerald-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                <Code2 className="h-4 w-4 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-zinc-100">{project.name}</h3>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                }
              >
                <MoreHorizontal className="h-4 w-4 text-zinc-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem className="gap-2">
                  <Play className="h-4 w-4" />
                  打开
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  预览
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-zinc-400 line-clamp-2">
            {project.description ?? "暂无描述"}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`h-5 px-2 text-[11px] font-medium ${statusConfig.className}`}
            >
              {statusConfig.label}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(project.updated_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// 创建项目表单
// ---------------------------------------------------------------------------

function CreateProjectForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setLocalError(null);
    const success = await onCreate(name.trim(), description.trim());
    setCreating(false);
    if (success) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-zinc-300">
            项目名称
          </Label>
          <Input
            id="name"
            placeholder="例如：AI Chatbot"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc" className="text-zinc-300">
            项目描述
          </Label>
          <Input
            id="desc"
            placeholder="一句话描述你的项目..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
      </div>

      {localError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {localError}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" disabled={!name.trim() || creating} className="gap-2">
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {creating ? "创建中..." : "创建项目"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const { projects, loading, error, createProject, deleteProject } = useProject();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = useCallback(async (name: string, description: string): Promise<boolean> => {
    const project = await createProject({ name, description });
    if (project) {
      setDialogOpen(false);
      router.push(`/project/${project.id}`);
      return true;
    }
    return false;
  }, [createProject, router]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个项目吗？所有对话和代码将被永久删除。")) return;
    await deleteProject(id);
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 pt-8 pb-16 sm:px-6">
      {/* 顶部操作栏 */}
      {hasProjects && (
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              我的项目
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {projects.length} 个项目
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  创建项目
                </Button>
              }
            />
            <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">创建新项目</DialogTitle>
                <DialogDescription className="text-zinc-500">
                  从一个想法开始，AI 帮你快速搭建原型。
                </DialogDescription>
              </DialogHeader>
              <CreateProjectForm
                onClose={() => setDialogOpen(false)}
                onCreate={handleCreate}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* 全局错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* 项目列表 / 空状态 */}
      {!loading &&
        (hasProjects ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <>
            <EmptyState onCreateClick={() => setDialogOpen(true)} />
            {/* 空状态创建对话框 */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-zinc-100">创建新项目</DialogTitle>
                  <DialogDescription className="text-zinc-500">
                    从一个想法开始，AI 帮你快速搭建原型。
                  </DialogDescription>
                </DialogHeader>
                <CreateProjectForm
                  onClose={() => setDialogOpen(false)}
                  onCreate={handleCreate}
                />
              </DialogContent>
            </Dialog>
          </>
        ))}
    </div>
  );
}
