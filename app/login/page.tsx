import { redirect } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { auth, authProviderFlags } from "@/lib/auth";
import { loginWithCredentials, loginWithProvider } from "@/app/actions";

const authErrors: Record<string, string> = {
  OAuthAccountNotLinked: "Этот email уже зарегистрирован другим методом входа.",
  AccessDenied: "Доступ запрещен настройками провайдера.",
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
      <div className="mx-auto max-w-md rounded-3xl border border-line bg-[#031021cc] p-6 shadow-2xl backdrop-blur">
        <p className="mb-1 text-sm text-muted">SalesTracker</p>
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
                className="h-11 w-full rounded-xl border border-line bg-[#031325] pl-9 pr-3 text-sm outline-none transition focus:border-accent"
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
                className="h-11 w-full rounded-xl border border-line bg-[#031325] pl-9 pr-3 text-sm outline-none transition focus:border-accent"
              />
            </div>
          </label>

          <button type="submit" className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-[#00131f] transition hover:brightness-110">
            Войти
          </button>
        </form>

        {(authProviderFlags.google || authProviderFlags.apple) && <div className="my-4 h-px bg-line" />}

        <div className="space-y-2">
          {authProviderFlags.google && (
            <form
              action={async () => {
                "use server";
                await loginWithProvider("google", callbackUrl);
              }}
            >
              <button type="submit" className="h-11 w-full rounded-xl border border-line bg-card text-sm transition hover:border-accent">
                Войти через Google
              </button>
            </form>
          )}

          {authProviderFlags.apple && (
            <form
              action={async () => {
                "use server";
                await loginWithProvider("apple", callbackUrl);
              }}
            >
              <button type="submit" className="h-11 w-full rounded-xl border border-line bg-card text-sm transition hover:border-accent">
                Войти через Apple
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-xs text-muted">
          {authProviderFlags.google || authProviderFlags.apple
            ? "После первого входа через OAuth аккаунт создается автоматически."
            : "OAuth пока выключен: добавьте Google/Apple ключи в .env и Vercel Environment Variables."}
        </p>
      </div>
    </main>
  );
}
