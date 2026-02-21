import { redirect } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { auth } from "@/lib/auth";
import { loginWithCredentials } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

const authErrors: Record<string, string> = {
  Configuration: "Ошибка конфигурации входа. Проверьте переменные окружения.",
  CredentialsSignin: "Неверный логин или пароль."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const errorMessage = params.error ? authErrors[params.error] ?? "Ошибка входа. Попробуйте еще раз." : null;
  const callbackUrl = params.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/";

  return (
    <main className="min-h-screen bg-mesh px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-card/80 bg-panel p-6 shadow-2xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Aimuselim Online Store</p>
          <ThemeToggle />
        </div>
        <h1 className="mb-4 text-2xl font-semibold">Вход в личный кабинет</h1>

        {errorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{errorMessage}</div>}

        <form action={loginWithCredentials} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <label className="block space-y-1">
            <span className="text-xs text-muted">Логин или email</span>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                name="login"
                required
                className="h-11 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm outline-none transition focus:border-accent"
              />
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">Пароль</span>
            <div className="relative">
              <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                name="password"
                required
                className="h-11 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm outline-none transition focus:border-accent"
              />
            </div>
          </label>

          <button type="submit" className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-[#00131f] transition hover:brightness-110">
            Войти в таблицу
          </button>
        </form>
      </div>
    </main>
  );
}
