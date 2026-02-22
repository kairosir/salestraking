import Link from "next/link";
import { redirect } from "next/navigation";
import { DollarSign, KeyRound, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/components/change-password-form";
import { NotificationSettings } from "@/components/notification-settings";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalesForm } from "@/components/sales-form";

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? -1 : 1;
  const abs = Math.abs(safe);
  const base = Math.floor(abs);
  const frac = abs - base;
  const rounded = frac > 0.5 ? base + 1 : base;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sign * rounded) + " ₸";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits;
}

function groupKey(clientName: string, clientPhone: string, id: string) {
  const phone = normalizePhone(clientPhone);
  if (phone) return `p:${phone}`;
  const name = clientName.trim().toLowerCase();
  if (name) return `n:${name}`;
  return `u:${id}`;
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

  const grouped = new Map<string, { title: string; phone: string; sales: typeof mySales }>();
  for (const sale of mySales) {
    const key = groupKey(sale.clientName, sale.clientPhone, sale.id);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        title: sale.clientName || "Без имени",
        phone: sale.clientPhone || "-",
        sales: [sale]
      });
      continue;
    }
    current.sales.push(sale);
  }

  const groupedSales = Array.from(grouped.values()).sort((a, b) => {
    const ta = a.sales[0]?.createdAt?.getTime() || 0;
    const tb = b.sales[0]?.createdAt?.getTime() || 0;
    return tb - ta;
  });

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
            <p className="mb-3 text-sm text-muted">Мои заказы (с группировкой по клиенту)</p>
            <div className="space-y-2">
              {groupedSales.length === 0 && <p className="text-sm text-muted">У вас пока нет добавленных продаж.</p>}
              {groupedSales.map((group) => (
                <details key={`${group.title}-${group.phone}`} className="rounded-xl border border-line bg-card p-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-text">{group.title}</p>
                        <p className="text-xs text-muted">{group.phone}</p>
                      </div>
                      <span className="text-xs text-muted">{group.sales.length} заказ(а)</span>
                    </div>
                  </summary>

                  <div className="mt-3 overflow-x-auto border-t border-line pt-3">
                    <div className="min-w-[520px]">
                      <div className="grid grid-cols-[1.2fr_0.5fr_0.8fr_0.8fr_0.7fr] gap-2 border-b border-line px-2 py-1 text-[11px] uppercase tracking-wide text-muted">
                        <span>Товар</span>
                        <span>Кол-во</span>
                        <span>Маржа</span>
                        <span>Статус</span>
                        <span className="text-right">Действие</span>
                      </div>
                      <div className="divide-y divide-line">
                        {group.sales.map((sale) => (
                          <div key={sale.id} className="grid items-center gap-2 px-2 py-2 text-xs lg:grid-cols-[1.2fr_0.5fr_0.8fr_0.8fr_0.7fr]">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-text">{sale.productName}</p>
                              {sale.productId && <p className="truncate text-[11px] text-muted">Трек: {sale.productId}</p>}
                            </div>
                            <span className="text-text">{sale.quantity}</span>
                            <span className="font-semibold text-success">{money(Number(sale.margin))}</span>
                            <span className="text-muted">{sale.status === "DONE" ? "Выдано" : "Доделать"}</span>
                            <div className="flex justify-end">
                              <SalesForm
                                compact
                                sale={{
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
                                  size: sale.size,
                                  quantity: sale.quantity,
                                  costPriceCny: sale.costPriceCny.toString(),
                                  salePrice: sale.salePrice.toString(),
                                  status: sale.status === "DONE" ? "DONE" : "TODO"
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
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
