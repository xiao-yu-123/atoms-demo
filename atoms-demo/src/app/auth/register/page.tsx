"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (password.length < 6) {
      setError("密码长度至少 6 位");
      return;
    }

    setLoading(true);

    if (!supabase) {
      setError("Supabase 未配置，请检查环境变量");
      setLoading(false);
      return;
    }

    const { error: authError, data } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // 关闭邮箱确认后 signUp 自动创建 session，强制刷新确保 cookie 生效
    if (data.session) {
      window.location.href = "/";
      return;
    }

    // 如果仍需确认（session 为 null），显示提示
    setRegistered(true);
  };

  // 注册成功提示
  if (registered) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900/80 text-center">
          <CardHeader className="space-y-1">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400">
              <CheckCircle2 className="h-5 w-5 text-zinc-950" />
            </div>
            <CardTitle className="text-xl text-zinc-100">注册成功！</CardTitle>
            <CardDescription className="text-zinc-500">
              我们已向 <span className="font-medium text-zinc-300">{email}</span> 发送了一封确认邮件。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-400">
            <p>请点击邮件中的链接激活账号，然后即可登录。</p>
            <p className="text-xs text-zinc-600">
              没收到邮件？检查垃圾箱，或在 Supabase Dashboard 中关闭邮箱确认。
            </p>
          </CardContent>
          <CardFooter className="justify-center pb-6">
            <Button variant="outline" nativeButton={false} render={<Link href="/auth/login" />}>
              <ArrowRight className="mr-2 h-4 w-4" />
              前往登录
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900/80">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-pink-400">
            <Sparkles className="h-5 w-5 text-zinc-950" />
          </div>
          <CardTitle className="text-xl text-zinc-100">创建账号</CardTitle>
          <CardDescription className="text-zinc-500">
            开始你的 AI 原型之旅
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-300">邮箱</Label>
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
              <Label htmlFor="password" className="text-zinc-300">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="至少 6 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-zinc-800 bg-zinc-950 pl-10 text-zinc-100 placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-zinc-300">确认密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  id="confirm"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? "注册中..." : "创建账号"}
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-2">
            <Separator className="flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-600">或者</span>
            <Separator className="flex-1 bg-zinc-800" />
          </div>

          <Button variant="outline" className="mt-4 w-full gap-2" disabled>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google 注册
          </Button>
        </CardContent>

        <CardFooter className="justify-center pb-6">
          <p className="text-sm text-zinc-500">
            已有账号？{" "}
            <Link href="/auth/login" className="font-medium text-emerald-400 transition-colors hover:text-emerald-300">
              去登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
