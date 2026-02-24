import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/components/change-password-form";
import { MyOrdersPanel } from "@/components/my-orders-panel";
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
      where: { createdById: session.user.id, status: { not: "WAITING" } },
      orderBy: { createdAt: "desc" },
      take: 120
    }),
    prisma.sale.findMany({
      where: { createdById: session.user.id, status: { not: "WAITING" } },
      select: { salePrice: true, quantity: true }
    }),
    prisma.sale.aggregate({
      where: { createdById: session.user.id, status: { not: "WAITING" } },
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
  const accountIdentity = [session.user.email, session.user.name].filter(Boolean).map((value) => String(value).toLowerCase());
  const userMeta = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true, name: true }
  });
  accountIdentity.push(...[userMeta?.username, userMeta?.email, userMeta?.name].filter(Boolean).map((value) => String(value).toLowerCase()));
  const canForceTrackingSync = accountIdentity.some((value) => value === "test" || value.startsWith("test@"));
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
          <Card icon={<TengeIcon />} label="Мой заработок (маржа)" value={money(totalMargin)} accent />
          <Card icon={<TengeIcon />} label="Моя выручка" value={money(totalRevenue)} />
          <Card icon={<TengeIcon />} label="Мои продажи" value={String(totalSalesCount)} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-1">
          <div className="rounded-3xl border border-line bg-card/70 bg-panel p-4">
            <p className="mb-3 inline-flex items-center gap-2 text-sm text-muted">
              <KeyRound size={16} />
              Смена пароля
            </p>
            <ChangePasswordForm />
          </div>
        </section>

        <NotificationSettings
          recipients={recipients}
          loginHint={session.user.email || session.user.name || "your-login"}
          canForceTrackingSync={canForceTrackingSync}
        />

        <MyOrdersPanel
          sales={mySales.map((sale) => ({
            id: sale.id,
            productId: sale.productId,
            clientName: sale.clientName,
            clientPhone: sale.clientPhone,
            productName: sale.productName,
            productLink: sale.productLink,
            paidTo: sale.paidTo,
            orderDate: sale.orderDate ? sale.orderDate.toISOString() : null,
            paymentDate: sale.paymentDate ? sale.paymentDate.toISOString() : null,
            screenshotData: sale.screenshotData,
            receiptData: sale.receiptData,
            size: sale.size,
            quantity: sale.quantity,
            costPriceCny: sale.costPriceCny.toString(),
            salePrice: sale.salePrice.toString(),
            margin: sale.margin.toString(),
            status: sale.status === "DONE" ? "DONE" : "TODO",
            createdAt: sale.createdAt.toISOString()
          }))}
        />
      </div>
    </main>
  );
}

function TengeIcon() {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-line px-1 text-[11px] font-semibold leading-none">
      ₸
    </span>
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
