# 🚀 Atoms-Demo

> 一个类 Atoms 的 AI 多智能体驱动应用生成 Demo —— 通过对话描述想法，AI Agent 协作拆解需求并生成可运行的全栈应用代码，实时预览并一键部署。

## 🎯 项目背景

本项目为「大模型全栈开发岗位」笔试作品，旨在 6-8 小时内完成一个具备 Atoms 核心能力的可运行原型。

### 本 Demo 的核心体验

本 Demo 复刻了 Atoms 的核心交互流程：

1. **对话驱动**：用户描述想法 → AI Agent 协作拆解
2. **多 Agent 流程可视化**：实时展示 Iris→Emma→Bob→Alex 协作链路
3. **代码实时预览**：Sandpack 浏览器沙箱即时渲染生成的应用
4. **竞速模式**（⭐亮点）：同一提示词双模型并行生成，对比选择最优方案
5. **数据持久化**：项目、对话、代码版本全部存储

## 🏗️ 技术架构

前端：Next.js 14 (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui
预览：Sandpack (@codesandbox/sandpack-react) - 浏览器沙箱运行React代码
编辑：Monaco Editor - VSCode级代码编辑体验
状态：Zustand - 轻量状态管理
数据库：Supabase (PostgreSQL + Auth + RLS)
AI Agent：OpenAI gpt-4o + Anthropic Claude (竞速模式)
通信：Server-Sent Events (SSE) - Agent流式输出
部署：Vercel - Next.js官方平台，零配置部署

## 📁 项目结构

atoms-demo/
├── src/app/              # Next.js App Router 页面和API
│   ├── api/              # 后端API Routes
│   │   ├── chat/         # Agent对话编排 (SSE)
│   │   ├── race/         # 竞速模式 (双模型并行)
│   │   └── projects/     # 项目 CRUD
│   ├── auth/             # 认证页面
│   ├── project/[id]/     # 项目详情页
│   └── race/             # 竞速模式页面
├── src/components/       # UI组件
│   ├── chat/             # 对话 + Agent流程可视化
│   ├── preview/          # Sandpack预览 + Monaco编辑器
│   ├── race/             # 竞速模式组件
│   ├── project/          # 项目管理组件
│   └── ui/               # shadcn/ui基础组件
├── src/lib/              # 核心逻辑
│   ├── agents.ts         # ⭐ 多Agent编排引擎
│   ├── prompts.ts        # 5个Agent的Prompt模板
│   ├── supabase.ts       # 数据库客户端
│   ├── llm.ts            # LLM调用封装
│   └── templates.ts      # Sandpack代码模板
├── src/stores/           # Zustand状态管理
├── src/hooks/            # React Hooks (SSE交互等)
├── src/types/            # TypeScript类型定义
└── supabase/migrations/  # 数据库迁移SQL

## 🤖 Agent 编排流程

用户输入 → Mike(协调器) → 分析需求,制定执行计划
  ├── Iris(研究员) → 市场洞察、需求分析
  ├── Emma(产品经理) → PRD拆解、功能定义
  ├── Bob(架构师) → 技术方案、模块划分
  └── Alex(工程师) → 生成可运行React代码

每个 Agent 通过结构化 Prompt + 前序输出上下文进行串行调用，
最终由 Alex 输出可直接在 Sandpack 中运行的代码文件集。



## ⚡ 竞速模式（Race Mode）

这是本 Demo 的亮点延展能力：

- 同一提示词同时发给不同模型
- 两列并排实时预览两个模型生成的应用
- 用户可对比后选择最优版本部署
- 对应 Atoms 官方的 "竞速模式" 核心卖点

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+

### 安装

```bash
git clone https://github.com/你的用户名/atoms-demo.git
cd atoms-demo
pnpm install
配置环境变量
cp .env.example .env.local
填写以下变量：
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-key
CLAUDE_API_KEY=sk-ant-your-key
```

### 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/migrations/001_init.sql`

### 启动开发

```bash
pnpm dev
```

## 🌐 在线访问

- **Demo链接**：**https://atoms-demo-lj6l-phi.vercel.app**
- **GitHub**：https://github.com/xiao-yu-123/atoms-demo/tree/master/atoms-demo

## ✅ 完成程度

| 功能                  | 状态   | 说明                         |
| --------------------- | ------ | ---------------------------- |
| 用户认证（注册/登录） | ✅ 完成 | Supabase Auth                |
| 项目 Dashboard        | ✅ 完成 | 项目列表、创建、删除         |
| 对话界面              | ✅ 完成 | 流式对话 + Agent角色标签     |
| 多Agent编排           | ✅ 完成 | Mike→Iris→Emma→Bob→Alex 串行 |
| Agent流程可视化       | ✅ 完成 | 流水线动画展示               |
| 代码实时预览          | ✅ 完成 | Sandpack浏览器沙箱           |
| Monaco代码编辑器      | ✅ 完成 | 文件切换 + 只读/编辑模式     |
| 数据持久化            | ✅ 完成 | Supabase PostgreSQL + RLS    |
| 竞速模式 ⭐            | ✅ 完成 | 双模型并行 + 对比选择        |
| 版本管理              | ⚠️ 基础 | 仅保存版本号，未做回滚UI     |
| 可视化编辑器          | ❌ 未做 | 时间不足，降优先级           |
| 代码导出GitHub        | ❌ 未做 | 时间不足，降优先级           |

## 🔮 如果继续投入时间

| 优先级 | 扩展方向         | 说明                                      |
| ------ | ---------------- | ----------------------------------------- |
| P1     | 版本管理与回滚   | 完整版本对比UI，支持回退任意版本          |
| P2     | 可视化微调编辑器 | 拖拽调整组件布局（类Atoms的可视化编辑器） |
| P3     | 代码导出GitHub   | OAuth授权，自动Push到用户仓库             |
| P4     | 更多Agent角色    | 加入 Sarah(SEO) + David(数据分析)         |
| P5     | 更多竞速模型     | 加入 Gemini、Mistral 等模型对比           |
| P6     | 多语言支持       | i18n，中英文切换                          |
| P7     | 移动端适配       | 响应式布局优化                            |

## 🛠️ 关键取舍

1. **Sandpack vs WebContainers**：选择 Sandpack 因为更轻量、CDN加载、无需服务端；代价是无法运行 Node.js 后端代码
2. **串行Agent vs 并行Agent**：Agent链串行（前序输出是后续输入前提）；Mike可动态跳过非必要Agent
3. **Prompt角色扮演 vs 真实Agent框架**：用精心设计的Prompt模拟多Agent，而非搭建复杂Agent框架；降低工程复杂度，6-8h可完成
4. **SSE vs WebSocket**：选择SSE因为Next.js原生支持、实现更简单、单向推送足够