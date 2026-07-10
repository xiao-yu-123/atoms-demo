"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  LogOut,
  User,
  ChevronDown,
  Layers,
  Terminal,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// 模拟项目列表（后续替换为真实数据）
// ---------------------------------------------------------------------------
const mockProjects = [
  { id: "1", name: "AI Chatbot", emoji: "🤖" },
  { id: "2", name: "Data Dashboard", emoji: "📊" },
  { id: "3", name: "Landing Page", emoji: "🚀" },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [activeProject, setActiveProject] = useState(mockProjects[0]);

  useEffect(() => {
    if (!supabase) return;

    // 初始获取 session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    // 监听 auth 状态变化（登录/登出）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // 登录/注册页不显示完整 Navbar，仅显示简化版
  const isAuthPage =
    pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register");

  return (
    <nav className="sticky top-0 z-50 h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4">
        {/* 左侧：Logo + 项目切换 */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-zinc-100 transition-colors hover:text-white"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-zinc-950">
              <Layers className="h-4 w-4" />
            </div>
            <span className="hidden text-sm font-bold tracking-tight sm:inline">
              Atoms-Demo
            </span>
          </Link>

          {!isAuthPage && (
            <div className="ml-4 flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-zinc-400 hover:text-zinc-100"
                    />
                  }
                >
                  <span className="text-base">
                    {activeProject.emoji}
                  </span>
                  <span className="max-w-[120px] truncate text-sm">
                    {activeProject.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                      项目列表
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  {mockProjects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setActiveProject(p)}
                      className="gap-2"
                    >
                      <span>{p.emoji}</span>
                      <span>{p.name}</span>
                      {p.id === activeProject.id && (
                        <Badge
                          variant="outline"
                          className="ml-auto h-4 border-emerald-500/30 px-1.5 text-[10px] text-emerald-400"
                        >
                          当前
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 text-zinc-400">
                    <Plus className="h-4 w-4" />
                    <span>新建项目</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="select-none text-xs text-zinc-600">
                <Terminal className="inline h-3 w-3" />
              </span>
            </div>
          )}
        </div>

        {/* 右侧：用户头像 / 登录 */}
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                  />
                }
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-zinc-800 text-xs text-zinc-300">
                    {user.email?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                    {user.email}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/" />}
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  个人主页
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-red-400"
                  onClick={() => { supabase?.auth.signOut().then(() => setUser(null)); }}
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : isAuthPage ? null : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" render={<Link href="/auth/login" />} nativeButton={false}>
                登录
              </Button>
              <Button size="sm" render={<Link href="/auth/register" />} nativeButton={false}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                注册
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
