// ============================================================================
// Projects API — CRUD 端点
// /api/projects
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// ---------------------------------------------------------------------------
// GET /api/projects?page=1&limit=12
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("projects")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    page,
    limit,
    total: count ?? 0,
    hasMore: (count ?? 0) > offset + limit,
  });
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { name?: string; description?: string; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      status: body.status ?? "draft",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PUT /api/projects
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { id?: string; name?: string; description?: string; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "缺少项目 ID" }, { status: 400 });
  }

  // 验证所属权
  const { data: existing } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", body.id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "无权修改此项目" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description.trim();
  if (body.status !== undefined) updates.status = body.status;

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// ---------------------------------------------------------------------------
// DELETE /api/projects?id=xxx
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少项目 ID" }, { status: 400 });
  }

  // 验证所属权
  const { data: existing } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "无权删除此项目" }, { status: 403 });
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
