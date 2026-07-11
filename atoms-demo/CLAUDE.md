# CLAUDE.md — Atoms-Demo Codebase Guide

## Project Overview

Atoms-Demo is an AI-powered full-stack application prototyping platform. Users describe an app idea, and a pipeline of 5 specialized AI agents (Mike, Iris, Emma, Bob, Alex) collaboratively generate production-ready React + Supabase code with live preview in Sandpack.

- **Stack**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (Base UI)
- **State**: zustand
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: 百炼 (qwen3.7-max) + MiniMax (Claude proxy)
- **Preview**: @codesandbox/sandpack-react + @monaco-editor/react
- **Package manager**: pnpm

## Architecture

```
User Input → rewriteQuery (LLM expands brief)
  → Mike (coordinator, creates plan)
  → Iris (researcher) → Emma (PM) → Bob (architect) → Alex (engineer)
  → SSE stream to frontend
  → Sandpack renders generated React app
  → Supabase persists messages + generated code
```

## Key Files

### Core AI Pipeline
| File | Purpose |
|------|---------|
| `src/lib/prompts.ts` | 5 Agent prompt templates + output schemas |
| `src/lib/agents.ts` | Agent orchestration: `orchestrateAgents()`, `callAgent()`, `streamAgentResponse()` |
| `src/lib/ai-clients.ts` | OpenAI (百炼) + Anthropic (MiniMax) SDK clients, `"server-only"` |

### API Routes
| Route | Purpose |
|-------|---------|
| `src/app/api/chat/route.ts` | Main SSE endpoint: rewrites query → orchestrates agents → saves to Supabase |
| `src/app/api/projects/route.ts` | Project CRUD with RLS auth |
| `src/app/api/race/route.ts` | Race mode: parallel GPT-4o + Claude code generation |

### Frontend Hooks
| Hook | Purpose |
|------|---------|
| `src/hooks/use-chat.ts` | SSE connection, message handling, agent state tracking |
| `src/hooks/use-project.ts` | Project CRUD with Supabase |
| `src/hooks/use-race.ts` | Race mode SSE + vote handling |

### Zustand Stores
| Store | State |
|-------|-------|
| `src/stores/chat-store.ts` | messages, agentStates, agentFullContent, generatedCode, isStreaming |
| `src/stores/race-store.ts` | models (GPT-4o + Claude), content, codes, preferredModel |

### Key Components
| Component | Purpose |
|-----------|---------|
| `src/components/chat/ChatPanel.tsx` | Chat messages list + input (single column) |
| `src/components/chat/AgentFlow.tsx` | Vertical agent pipeline visualization with per-agent scrolling |
| `src/components/preview/SandpackPreview.tsx` | SandpackProvider wrapper with toolbar (refresh, fullscreen, export, new tab) |
| `src/components/preview/CodeEditor.tsx` | Monaco editor with file tabs, dark theme, read-only toggle |
| `src/components/layout/ResizablePanel.tsx` | Three-column draggable split layout |
| `src/components/race/RacePanel.tsx` | Race mode panel with dual preview + voting |

### UI Components
- All shadcn/ui components in `src/components/ui/` use **@base-ui/react** (not Radix)
- Base UI uses `render` prop instead of `asChild`:
  - `Button render={<Link href="/" />} nativeButton={false}` — NOT `Button asChild`
  - `DropdownMenuTrigger render={<Button />}` — NOT `DropdownMenuTrigger asChild`
  - `DropdownMenuItem render={<Link href="/" />}` — NOT `DropdownMenuItem asChild`
- `DropdownMenuLabel` must be wrapped in `DropdownMenuGroup`

## Critical Patterns

### Base UI Migration
This project uses shadcn/ui with **Base UI** primitives. Key differences from Radix:
- No `asChild` — use `render` prop instead
- Button `nativeButton` defaults to `true`; must set `nativeButton={false}` when rendering Link
- MenuGroupLabel must be inside MenuGroup

### SSE Event Protocol (Chat)
```
rewrite_start → rewrite_complete → agent_start → agent_stream* → agent_complete* → orchestration_complete
```

### Alex Output Format
```json
{
  "files": { "/App.tsx": "...", "/store.ts": "...", "/components/Header.tsx": "..." },
  "entryFile": "/App.tsx",
  "dependencies": {},
  "sqlMigration": "CREATE TABLE ...",
  "apiRoutes": { "/api/items/route.ts": "..." }
}
```

### Generated Code Constraints
- Runs in Sandpack (browser bundler) — no Node APIs, no file system
- Tailwind via `https://cdn.tailwindcss.com`
- Icons use emoji (no lucide-react in generated apps)
- No React Router — view switching via `useState`
- Supabase client SDK for real backend (when sqlMigration is executed)

### Scroll Architecture
- Global 5px thin dark scrollbar (globals.css)
- ChatPanel: `ScrollArea flex-1` overall scroll
- AgentFlow: `overflow-y-auto` overall + `max-h-36 overflow-y-auto` per card
- ChatMessage: collapsed `max-h-24`, expanded `max-h-52 overflow-y-auto`
- Sandpack: CSS overrides for zero-padding iframe

### Supabase RLS
All tables have RLS enabled. Policies chain: user → project → conversation → message/code.
- `profiles`: SELECT/UPDATE own, INSERT own
- `projects`: Full CRUD filtered by `user_id = auth.uid()`
- `conversations/messages/generated_code/race_results`: Via project ownership chain
- Auto-trigger: `handle_new_user()` creates profile on signup

## Common Tasks

### Adding a new Agent
1. Add to `AgentId` type in `prompts.ts`
2. Add prompt builder function + entry in `PROMPT_BUILDERS`
3. Add model config in `agents.ts` DEFAULT_MODELS
4. Add color config in `AgentBadge.tsx` AGENT_COLORS
5. Add to pipeline order in `AgentFlow.tsx` PIPELINE_ORDER

### Changing AI Model
Edit `DEFAULT_MODELS` in `src/lib/agents.ts` and `src/app/api/chat/route.ts` (rewriteQuery).

### Adding a shadcn/ui component
```bash
npx shadcn@latest add <component> -y
```
Imports auto-created in `src/components/ui/`. Remember Base UI patterns.

### Database Changes
1. Create new migration in `supabase/migrations/`
2. Execute in Supabase SQL Editor
3. Update types if schema changes

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key
OPENAI_API_KEY                  # 百炼 API key
OPENAI_BASE_URL                 # 百炼 base URL
CLAUDE_API_KEY                  # MiniMax API key
CLAUDE_BASE_URL                 # MiniMax Anthropic-compatible base URL
```

`.env.local` is gitignored. For Vercel, configure in project settings.
