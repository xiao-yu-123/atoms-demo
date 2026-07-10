"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError("Supabase 未配置，请检查环境变量");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // 更友好的错误提示
      if (authError.message.includes("Email not confirmed")) {
        setError("邮箱尚未确认，请检查收件箱中的确认邮件（含垃圾箱），或前往 Supabase 关闭邮箱确认。");
      } else if (authError.message.includes("Invalid login credentials")) {
        setError("邮箱或密码错误，请重试。");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    window.location.href = "/";
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900/80">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400">
            <Sparkles className="h-5 w-5 text-zinc-950" />
          </div>
          <CardTitle className="text-xl text-zinc-100">欢迎回来</CardTitle>
          <CardDescription className="text-zinc-500">
            登录你的 Atoms 账号继续创作
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-300">
                邮箱
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-zinc-800 bg-zinc-950 pl-10 text-zinc-100 placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">
                  密码
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  忘记密码？
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-zinc-800 bg-zinc-950 pl-10 text-zinc-100 placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-2">
            <Separator className="flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-600">或者</span>
            <Separator className="flex-1 bg-zinc-800" />
          </div>

          <Button variant="outline" className="mt-4 w-full gap-2" disabled>
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google 登录
          </Button>
        </CardContent>

        <CardFooter className="justify-center pb-6">
          <p className="text-sm text-zinc-500">
            还没有账号？{" "}
            <Link
              href="/auth/register"
              className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              立即注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
