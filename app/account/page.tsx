import Link from "next/link";
import { redirect } from "next/navigation";
import { DollarSign, KeyRound, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/components/change-password-form";
import { NotificationSettings } from "@/components/notification-settings";
import { ThemeToggle } from "@/components/theme-toggle";

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? -1 : 1;
  const abs = Math.abs(safe);
  const base = Math.floor(abs);
  const frac = abs - base;
  const rounded = frac > 0.5 ? base + 1 : base;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sign * rounded) + " ₸";
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const recipientWhere: Array<{ userId: string } | { email: string }> = [{ userId: session.user.id }];
  if (session.user.email) recipientWhere.push({ email: session.user.email });

  const [mySales, allMySalesForRevenue, myAgg] = await Promise.all([
    prisma.sale.findMany({
      where: { createdById: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.sale.findMany({
      where: { createdById: session.user.id },
      select: { salePrice: true, quantity: true }
    }),
    prisma.sale.aggregate({
      where: { createdById: session.user.id },
      _sum: { margin: true },
      _count: { id: true }
    })
  ]);

  let recipients: Array<{
    id: string;
    email: string | null;
    telegramChatId: string | null;
    telegramUsername: string | null;
    emailEnabled: boolean;
    telegramEnabled: boolean;
    isActive: boolean;
  }> = [];
  try {
    recipients = await prisma.notificationRecipient.findMany({
      where: { OR: recipientWhere },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        telegramChatId: true,
        telegramUsername: true,
        emailEnabled: true,
        telegramEnabled: true,
        isActive: true
      }
    });
  } catch (error) {
    console.error("notificationRecipient query failed:", error);
  }

  const totalMargin = Number(myAgg._sum.margin ?? 0);
  const totalRevenue = allMySalesForRevenue.reduce((sum, sale) => sum + Number(sale.salePrice) * sale.quantity, 0);
  const totalSalesCount = myAgg._count.id;

  return (
    <main className="min-h-screen bg-bg bg-mesh">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        <header className="rounded-3xl border border-line bg-card/75 bg-panel p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Личный кабинет</p>
              <h1 className="text-2xl font-semibold">Профиль пользователя</h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="w-full sm:w-auto">
                <ThemeToggle />
              </div>
              <Link href="/" className="inline-flex h-10 w-full items-center justify-center rounded-2xl border border-line bg-card px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-text sm:w-auto">
                К таблице
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card icon={<User size={18} />} label="Пользователь" value={session.user.name || session.user.email || "User"} />
          <Card icon={<DollarSign size={18} />} label="Мой заработок (маржа)" value={money(totalMargin)} accent />
          <Card icon={<DollarSign size={18} />} label="Моя выручка" value={money(totalRevenue)} />
          <Card icon={<DollarSign size={18} />} label="Мои продажи" value={String(totalSalesCount)} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-card/70 bg-panel p-4">
            <p className="mb-3 inline-flex items-center gap-2 text-sm text-muted">
              <KeyRound size={16} />
              Смена пароля
            </p>
            <ChangePasswordForm />
          </div>

          <div className="rounded-3xl border border-line bg-card/70 bg-panel p-4">
            <p className="mb-3 text-sm text-muted">Последние добавленные вами записи</p>
            <div className="space-y-2">
              {mySales.length === 0 && <p className="text-sm text-muted">У вас пока нет добавленных продаж.</p>}
              {mySales.map((sale) => (
                <div key={sale.id} className="rounded-xl border border-line bg-card p-3">
                  <p className="text-sm font-semibold text-text">{sale.clientName}</p>
                  <p className="text-xs text-muted">{sale.productName}</p>
                  <p className="text-xs text-success">Маржа: {money(Number(sale.margin))}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <NotificationSettings recipients={recipients} loginHint={session.user.email || session.user.name || "your-login"} />
      </div>
    </main>
  );
}

function Card({
  icon,
  label,
  value,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card/70 p-4">
      <p className="mb-2 inline-flex items-center gap-2 text-sm text-muted">
        <span>{icon}</span>
        {label}
      </p>
      <p className={`text-xl font-semibold ${accent ? "text-success" : "text-text"}`}>{value}</p>
    </div>
  );
}
