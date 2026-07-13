// ============================================================================
// Atoms-Demo Agent Prompt 系统 v4.0 — 精简版
// ============================================================================

export type AgentId = "mike" | "iris" | "emma" | "bob" | "alex";

export interface MikePlan { goal: string; agents: AgentId[]; reasoning: string; steps: { order: number; agent: AgentId; task: string; dependsOn: number[] }[]; }
export interface IrisResearch { summary: string; targetUsers: string; recommendations: string[]; }
export interface EmmaPRD { title: string; overview: string; features: { name: string; description: string; priority: "P0"|"P1"|"P2"; acceptanceCriteria: string[] }[]; scope: { inScope: string[]; outOfScope: string[] }; happyPath: string[]; sadPath: string[]; }
export interface BobArchitecture { techStack: { framework: string; language: string; styling: string; stateManagement: string; libraries: string[] }; modules: { name: string; responsibility: string; exports: string[] }[]; dataFlow: string; }
export interface AlexCode { files: Record<string,string>; entryFile: string; dependencies: Record<string,string>; }

const MIKE_SCHEMA = `{"goal":"目标","agents":["iris","emma","bob","alex"],"reasoning":"原因","steps":[{"order":1,"agent":"iris","task":"任务","dependsOn":[]}]}`;
const IRIS_SCHEMA = `{"summary":"需求摘要","targetUsers":"目标用户","recommendations":["建议"]}`;
const EMMA_SCHEMA = `{"title":"PRD标题","overview":"概述","features":[{"name":"功能","description":"描述","priority":"P0|P1|P2","acceptanceCriteria":["条件"]}],"scope":{"inScope":[],"outOfScope":[]},"happyPath":[],"sadPath":[]}`;
const BOB_SCHEMA = `{"techStack":{"framework":"React 18","language":"TypeScript","styling":"Tailwind CSS","stateManagement":"zustand","libraries":[]},"modules":[{"name":"模块","responsibility":"职责","exports":[]}],"dataFlow":"数据流"}`;
const ALEX_SCHEMA = `{"files":{"/App.tsx":"// 根组件","/types.ts":"// 类型","/store.ts":"// zustand store","/components/List.tsx":"// 列表组件","/components/Form.tsx":"// 表单组件","/components/EmptyState.tsx":"// 空状态组件"},"entryFile":"/App.tsx","dependencies":{}}`;

export const AGENT_META: Record<AgentId,{ name:string; emoji:string; color:string; description:string }> = {
  mike:{ name:"Mike", emoji:"🧢", color:"text-amber-400", description:"团队负责人" },
  iris:{ name:"Iris", emoji:"🔍", color:"text-violet-400", description:"研究员" },
  emma:{ name:"Emma", emoji:"📋", color:"text-rose-400", description:"产品经理" },
  bob:{ name:"Bob", emoji:"🏗️", color:"text-cyan-400", description:"架构师" },
  alex:{ name:"Alex", emoji:"⚡", color:"text-emerald-400", description:"前端工程师" },
};

// ============================================================================
// Prompt Builders (精简)
// ============================================================================

export function buildMikePrompt(userInput: string): string {
  return `你是 Mike，AI 团队负责人。分析用户需求并制定执行计划。

## 团队
- Iris (研究员) — 市场分析、用户洞察
- Emma (产品经理) — PRD、功能拆解、边界场景
- Bob (架构师) — 技术方案、模块划分
- Alex (工程师) — 编写可运行的 React 应用代码

用户输入："${userInput}"
输出纯 JSON（不超过 20 行）：${MIKE_SCHEMA}`;
}

export function buildIrisPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文：\n${context}\n` : "";
  return `你是 Iris，AI 研究员。${ctx}
用户需求："${userInput}"
输出纯 JSON：${IRIS_SCHEMA}`;
}

export function buildEmmaPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文：\n${context}\n` : "";
  return `你是 Emma，资深 SaaS 产品经理。
核心原则：有"创建"就要有"删除+编辑+空状态"；有"列表"就要有"搜索+筛选"。
${ctx}
用户需求："${userInput}"
输出纯 JSON：${EMMA_SCHEMA}`;
}

export function buildBobPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文（含 PRD）：\n${context}\n` : "";
  return `你是 Bob，技术架构师。
技术栈：React 18 + TypeScript + Tailwind CSS + zustand + Supabase（PostgreSQL + Auth + RLS）。
组件单一职责，文件 5-10 个，Sandpack 可运行。
${ctx}
用户需求："${userInput}"
输出纯 JSON：${BOB_SCHEMA}`;
}

export function buildAlexPrompt(userInput: string, context?: string): string {
  const ctx = context ? `上下文（PRD + 架构）：\n${context}\n` : "";
  return `你是 Alex，资深全栈工程师。编写功能完整、UI 精美、前后端打通的 React + Supabase 应用代码。

## 技术栈
- 前端：React 18 + TypeScript + Tailwind CSS + zustand
- 后端：Supabase（PostgreSQL + Auth + RLS）
- 数据持久化使用 Supabase 客户端 SDK，不使用 localStorage

## 交付标准
- 4-5 个组件文件（App.tsx + 核心业务组件）
- 完整 CRUD + 搜索筛选，处理 Loading/Empty/Error/Data 状态
- 预置 3-5 条 mock 数据
- 代码精简，避免冗余，确保 JSON 完整闭合
- 图标用 emoji

## 组件导出规范（必须遵守）
- App.tsx 必须用 \`export default function App()\`
- 其他组件全部用命名导出：\`export function Xxx()\`
- 导入命名导出：\`import { Xxx } from "./components/Xxx"\`
- 导入默认导出：\`import App from "./App"\`

## UI 规范
- 页面 bg-zinc-950，卡片 bg-zinc-900 border border-zinc-800 rounded-xl
- 主按钮 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg px-4 py-2 text-sm
- 输入框 bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-sm text-zinc-100
- 操作成功显示 Toast，危险操作弹出确认弹窗
- 禁止白色背景、全宽无居中、console.log、any 类型

## JSON 格式（违反将导致解析失败）
- 直接输出裸 JSON，禁止用 markdown 代码块包裹
- 代码中禁止模板字符串，改用普通字符串拼接
- JSON 内双引号必须转义

${ctx}
用户需求："${userInput}"
输出纯 JSON：${ALEX_SCHEMA}`;
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
