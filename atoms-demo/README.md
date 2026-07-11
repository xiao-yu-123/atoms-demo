# Atoms-Demo

> AI 驱动的全栈应用原型平台 — 描述想法，5 个 AI Agent 协作生成可运行的应用。

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2-3ecf8e)](https://supabase.com/)

## 概述

Atoms-Demo 是一个 AI 原型平台。用户输入想法，5 个专业 AI Agent（Mike/Iris/Emma/Bob/Alex）协作完成从需求分析到全栈代码生成的全过程。生成的应用可在 Sandpack 中实时预览，支持导出 ZIP 或部署到 Vercel。

### Agent 流水线

```
用户输入
  → 🧢 Mike  协调器：制定执行计划
  → 🔍 Iris  研究员：市场分析
  → 📋 Emma  产品经理：PRD + 边界场景
  → 🏗 Bob   架构师：全栈技术方案
  → ⚡ Alex  工程师：React + Supabase + API 代码
  → Sandpack 实时预览
```

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript (strict) |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 状态 | zustand |
| 后端 | Supabase (PostgreSQL + Auth + RLS) |
| AI | 百炼 qwen3.7-max + MiniMax Claude 代理 |
| 预览 | Sandpack + Monaco Editor |
| 包管理 | pnpm |

## 快速开始

### 前置条件

- Node.js 20+
- pnpm
- Supabase 项目
- 百炼 API Key / MiniMax API Key

### 安装

```bash
git clone https://github.com/xiao-yu-123/atoms-demo.git
cd atoms-demo
pnpm install
```

### 环境变量

复制 `.env.local` 并填入真实值：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx

# AI (百炼平台)
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# AI (MiniMax Claude 代理)
CLAUDE_API_KEY=sk-xxx
CLAUDE_BASE_URL=https://api.minimaxi.com/anthropic
```

### 数据库

在 Supabase SQL Editor 中执行迁移文件：

1. `supabase/migrations/001_init.sql` — 核心表 + RLS + 触发器
2. `supabase/migrations/002_fix_profiles.sql` — Profile 触发器修复

### 启动

```bash
pnpm dev
```

打开 http://localhost:3000

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 全局 Layout
│   ├── page.tsx                # Dashboard
│   ├── project/[id]/page.tsx   # 项目工作区 (三栏布局)
│   ├── auth/login/page.tsx     # 登录
│   ├── auth/register/page.tsx  # 注册
│   ├── race/page.tsx           # Race Mode
│   └── api/
│       ├── chat/route.ts       # Chat SSE API
│       ├── projects/route.ts   # Projects CRUD API
│       └── race/route.ts       # Race SSE API
├── components/
│   ├── chat/                   # ChatPanel, ChatMessage, AgentFlow, AgentBadge
│   ├── layout/                 # Navbar, AppShell, ResizablePanel
│   ├── preview/                # SandpackPreview, CodeEditor, PreviewTabs
│   └── race/                   # RacePanel, RaceResultCard, RaceCompare
├── hooks/
│   ├── use-chat.ts             # 对话交互 Hook
│   ├── use-project.ts          # 项目 CRUD Hook
│   └── use-race.ts             # 竞速 Hook
├── stores/
│   ├── chat-store.ts           # Zustand Chat Store
│   └── race-store.ts           # Zustand Race Store
├── lib/
│   ├── agents.ts               # Agent 编排核心
│   ├── prompts.ts              # 5 个 Agent Prompt 模板
│   ├── ai-clients.ts           # AI SDK 客户端 (百炼 + MiniMax)
│   ├── supabase.ts             # Supabase 浏览器客户端
│   └── supabase-server.ts      # Supabase 服务端客户端
├── types/
│   └── agent.ts                # Agent 类型定义
└── supabase/migrations/        # 数据库迁移文件
```

## 核心功能

### 对话式 AI 开发
- 输入产品需求 → 5 个 Agent 串行协作 → 生成完整前后端代码
- 流式 SSE 推送，实时展示每个 Agent 的输出
- 需求自动重写：简短输入 → 详细产品 Brief

### 沙盒预览
- Sandpack 实时渲染生成的 React 应用
- Monaco Editor 查看源码
- 导出 ZIP 下载 / 新标签页打开

### Race Mode
- GPT-4o vs Claude Sonnet 同时生成代码
- 双列并排预览，投票选择更优版本
- 统计对比（文件数、耗时、代码量）

### 三栏可拖拽布局
- 对话区 | Agent 流水线 | 预览区
- 分割线拖拽调整列宽，最小宽度保护

### Supabase 全栈后端
- RLS 行级安全，用户数据完全隔离
- 注册/登录、项目 CRUD、对话历史持久化
- 生成代码版本管理（自动递增）

## 部署

### Vercel

```bash
vercel --prod
```

环境变量在 Vercel Dashboard → Settings → Environment Variables 中配置（与 `.env.local` 一致）。

### Supabase

迁移文件在 `supabase/migrations/`，在 Supabase SQL Editor 中执行。

## License

MIT
