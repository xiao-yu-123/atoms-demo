"use client";

// ============================================================================
// useProject — 项目 CRUD Hook
// ============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "draft" | "building" | "completed" | "deployed";
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: Project["status"];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: Project["status"];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // 获取所有项目
  // ------------------------------------------------------------------
  const getProjects = useCallback(async () => {
    if (!supabase) {
      setError("Supabase 未配置");
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);

    const { data, error: supabaseError } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (supabaseError) {
      setError(supabaseError.message);
      setLoading(false);
      return [];
    }

    const list = (data ?? []) as Project[];
    setProjects(list);
    setLoading(false);
    return list;
  }, []);

  // 首次加载
  useEffect(() => {
    getProjects();
  }, [getProjects]);

  // ------------------------------------------------------------------
  // 获取单个项目
  // ------------------------------------------------------------------
  const getProject = useCallback(async (id: string): Promise<Project | null> => {
    if (!supabase) return null;

    const { data, error: supabaseError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (supabaseError || !data) return null;
    return data as Project;
  }, []);

  // ------------------------------------------------------------------
  // 创建项目
  // ------------------------------------------------------------------
  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      if (!supabase) {
        setError("Supabase 未配置");
        return null;
      }

      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("请先登录");
        return null;
      }

      const { data, error: supabaseError } = await supabase
        .from("projects")
        .insert({
          user_id: userData.user.id,
          name: input.name,
          description: input.description ?? null,
          status: input.status ?? "draft",
        })
        .select("*")
        .single();

      if (supabaseError) {
        setError(supabaseError.message);
        return null;
      }

      const project = data as Project;
      setProjects((prev) => [project, ...prev]);
      return project;
    },
    [],
  );

  // ------------------------------------------------------------------
  // 更新项目
  // ------------------------------------------------------------------
  const updateProject = useCallback(
    async (
      id: string,
      updates: UpdateProjectInput,
    ): Promise<Project | null> => {
      if (!supabase) return null;

      const { data, error: supabaseError } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (supabaseError) {
        setError(supabaseError.message);
        return null;
      }

      const updated = data as Project;
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? updated : p)),
      );
      return updated;
    },
    [],
  );

  // ------------------------------------------------------------------
  // 删除项目
  // ------------------------------------------------------------------
  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    if (!supabase) return false;

    const { error: supabaseError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (supabaseError) {
      setError(supabaseError.message);
      return false;
    }

    setProjects((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, []);

  return {
    projects,
    loading,
    error,
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
  };
}
