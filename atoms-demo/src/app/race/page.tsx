"use client";

// ============================================================================
// Race 页面 — AI 模型竞速
// 路由: /race
// ============================================================================

import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RacePanel } from "@/components/race/RacePanel";

export default function RacePage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* 顶部导航 */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/" />}
            nativeButton={false}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="gap-1 text-xs text-zinc-500">
          <Info className="h-3.5 w-3.5" />
          什么是竞速模式？
        </Button>
      </header>

      {/* RacePanel */}
      <div className="flex-1 overflow-hidden">
        <RacePanel />
      </div>
    </div>
  );
}
