// ============================================================================
// Atoms-Demo Agent Prompt 系统 v3 — 全栈前后端协同
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentId = "mike" | "iris" | "emma" | "bob" | "alex";

export interface MikePlan { goal: string; agents: AgentId[]; reasoning: string; steps: { order: number; agent: AgentId; task: string; dependsOn: number[] }[]; }
export interface IrisResearch { summary: string; marketOpportunity: string; targetUsers: string; competitors: { name: string; strength: string; weakness: string }[]; recommendations: string[]; }
export interface EmmaPRD { title: string; overview: string; features: { name: string; description: string; priority: "P0"|"P1"|"P2"; acceptanceCriteria: string[] }[]; scope: { inScope: string[]; outOfScope: string[] }; successMetrics: string[]; edgeCases: string[]; happyPath: string[]; sadPath: string[]; dataLifecycle: { create: object; read: object; update: object; delete: object }; }
export interface BobArchitecture { techStack: { framework: string; language: string; styling: string; stateManagement: string; libraries: string[] }; modules: { name: string; responsibility: string; exports: string[] }[]; dataFlow: string; constraints: string[]; perfStrategy: string; backendDesign: string; }
export interface AlexCode { files: Record<string,string>; entryFile: string; setupInstructions: string; dependencies: Record<string,string>; sqlMigration?: string; apiRoutes?: Record<string,string>; }

export const AGENT_OUTPUT_SCHEMAS = {
  mike: JSON.stringify({ goal:"string", agents:["mike","iris","emma","bob","alex"], reasoning:"string", steps:[{ order:1, agent:"iris", task:"...", dependsOn:[] }] }),
  iris: JSON.stringify({ summary:"string", marketOpportunity:"string", targetUsers:"string", competitors:[{ name:"...", strength:"...", weakness:"..." }], recommendations:["..."] }),
  emma: JSON.stringify({ title:"PRD标题", overview:"概述", features:[{ name:"功能", description:"描述", priority:"P0|P1|P2", acceptanceCriteria:["条件"] }], scope:{ inScope:[], outOfScope:[] }, successMetrics:[], edgeCases:[], happyPath:[], sadPath:[], dataLifecycle:{ create:{}, read:{}, update:{}, delete:{} } }),
  bob: JSON.stringify({ techStack:{ framework:"React 18", language:"TypeScript", styling:"Tailwind CSS", stateManagement:"zustand", libraries:[] }, modules:[{ name:"模块", responsibility:"职责", exports:[] }], dataFlow:"描述", constraints:[], perfStrategy:"描述", backendDesign:"Supabase 后端设计" }),
  alex: JSON.stringify({ files:{ "/App.tsx":"...", "/types.ts":"...", "/store.ts":"..." }, entryFile:"/App.tsx", dependencies:{}, sqlMigration:"CREATE TABLE ...", apiRoutes:{ "/api/items/route.ts":"..." } }),
} as const;

export const AGENT_META: Record<AgentId,{ name:string; emoji:string; color:string; description:string }> = {
  mike:{ name:"Mike", emoji:"🧢", color:"text-amber-400", description:"团队负责人" },
  iris:{ name:"Iris", emoji:"🔍", color:"text-violet-400", description:"深度研究员" },
  emma:{ name:"Emma", emoji:"📋", color:"text-rose-400", description:"产品经理" },
  bob:{ name:"Bob", emoji:"🏗️", color:"text-cyan-400", description:"全栈架构师" },
  alex:{ name:"Alex", emoji:"⚡", color:"text-emerald-400", description:"全栈工程师 — 前后端协同" },
};

// ============================================================================
// Prompt Builders
// ============================================================================

export function buildMikePrompt(userInput: string): string {
  return `你是 Mike，AI 团队负责人。分析用户需求，制定执行计划。

## 团队
- Iris：市场分析、竞品调研
- Emma：PRD、功能拆解、边界场景
- Bob：全栈架构设计（前端 + 后端 + 数据库）
- Alex：前后端代码生成（React + Supabase + API Routes）

## 规则
- 新项目：Iris -> Emma -> Bob -> Alex
- 简单改 UI：只需 Alex
- 每个步骤说明前置依赖

用户输入："${userInput}"
输出纯 JSON：${AGENT_OUTPUT_SCHEMAS.mike}`;
}

export function buildIrisPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文：\n${context}\n` : "";
  return `你是 Iris，AI 深度研究员。${ctx}
用户需求："${userInput}"
输出纯 JSON：${AGENT_OUTPUT_SCHEMAS.iris}`;
}

// ---------------------------------------------------------------------------
// EMMA — PM
// ---------------------------------------------------------------------------

export function buildEmmaPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文：\n${context}\n` : "";
  return `你是 Emma，资深 SaaS 产品经理。

## 核心原则
- 有"创建"就要有"删除+编辑+空状态"
- 有"列表"就要有"搜索+筛选+排序"
- 有"提交"就要有"loading+成功反馈+失败重试"
- dataLifecycle 的 create/read/update/delete 四项必须全部非空

${ctx}
用户需求："${userInput}"
输出纯 JSON：${AGENT_OUTPUT_SCHEMAS.emma}`;
}

// ---------------------------------------------------------------------------
// BOB — 全栈架构师
// ---------------------------------------------------------------------------

export function buildBobPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文（含 PRD）：\n${context}\n` : "";
  return `你是 Bob，全栈架构师。设计完整的前后端技术方案。

## 技术栈
- 前端：React 18 + TypeScript + Tailwind CSS + zustand
- 后端：Supabase（PostgreSQL + RLS + Auth）
- API：Next.js Route Handlers（/api/*）
- 存储：Supabase Storage（文件上传如图片/PDF）

## 架构设计要求
1. **数据库设计**：列出核心表结构、字段、关系
2. **RLS 策略**：每张表的 SELECT/INSERT/UPDATE/DELETE 规则
3. **API 设计**：列出需要的 Route Handler 及其职责
4. **前后端数据流**：用户操作 -> API -> Supabase -> 返回 -> UI 更新
5. **性能策略**：useMemo/debounce/分页/索引

${ctx}
用户需求："${userInput}"
输出纯 JSON：${AGENT_OUTPUT_SCHEMAS.bob}`;
}

// ---------------------------------------------------------------------------
// ALEX — 全栈工程师（前后端协同）
// ---------------------------------------------------------------------------

export function buildAlexPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文（PRD + 架构方案）：\n${context}\n` : "";
  return `你是 Alex，资深全栈工程师。你不仅写前端，还负责后端和数据库，交付真正能落地的应用。

## 你的交付物

### 1. 前端代码（files 字段，在 Sandpack 中预览）
- React 18 + TypeScript + Tailwind CSS + zustand
- 使用 @supabase/supabase-js 调用真实 Supabase 后端
- 完整 CRUD + 搜索筛选 + 四种状态覆盖
- 深色主题，响应式 375px-1280px

### 2. 后端数据库（sqlMigration 字段）
- CREATE TABLE 语句（含索引）
- ALTER TABLE ENABLE ROW LEVEL SECURITY
- CREATE POLICY（严格校验 auth.uid()）
- 触发器（updated_at 自动更新）

### 3. API 路由（apiRoutes 字段）
- Next.js Route Handler（/api/todos/route.ts 等）
- 使用 createSupabaseServerClient 鉴权
- 标准的 GET/POST/PUT/DELETE
- 请求校验 + 错误处理

## 前端 UI 规范
- 背景 bg-zinc-950，卡片 bg-zinc-900 border-zinc-800
- 主按钮 bg-emerald-500 hover:bg-emerald-600
- 文字 text-zinc-100/400/500
- 输入框 bg-zinc-900 border-zinc-800 rounded-lg
- 必须包含：Header（统计）、List（搜索+筛选）、Form（创建/编辑）、EmptyState、ConfirmDialog、ErrorBoundary、Toast

## 后端规范
- 所有表启用 RLS
- 所有查询只取需要的字段（不用 SELECT *）
- API 返回统一的 { data, error } 格式
- 敏感操作记录 created_at/updated_at

## 代码质量
- 无 any、无 console.log、无 @ts-ignore
- 数组操作前检查：(items ?? []).filter(...)
- zustand store 初始值必须安全（items: [] 不是 items: null）
- 提交按钮点击后 disabled + loading 状态
- 每个组件 Props 有 interface 定义月

${ctx}
用户需求："${userInput}"

输出纯 JSON：${AGENT_OUTPUT_SCHEMAS.alex}`;
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

export const PROMPT_BUILDERS: Record<AgentId,(userInput:string,context?:string)=>string> = {
  mike:buildMikePrompt, iris:buildIrisPrompt, emma:buildEmmaPrompt, bob:buildBobPrompt, alex:buildAlexPrompt,
};

export function buildPrompt(agent:AgentId, userInput:string, context?:string): string {
  return PROMPT_BUILDERS[agent](userInput, context);
}
