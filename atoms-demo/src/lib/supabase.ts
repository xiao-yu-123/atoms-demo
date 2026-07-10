import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 仅在环境变量有效时才创建客户端
function createSupabaseClient() {
  if (
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    supabaseUrl !== "your_project_url_here"
  ) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  // 返回一个安全的 mock，避免 build 时崩溃
  return null;
}

export const supabase = createSupabaseClient();
