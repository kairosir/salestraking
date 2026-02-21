import Link from "next/link";
import { redirect } from "next/navigation";
import { DollarSign, KeyRound, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/components/change-password-form";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const mySales = await prisma.sale.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  const totalMargin = mySales.reduce((sum, sale) => sum + Number(sale.margin), 0);
  const totalRevenue = mySales.reduce((sum, sale) => sum + Number(sale.salePrice) * sale.quantity, 0);

  return (
    <main className="min-h-screen bg-bg bg-mesh">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        <header className="rounded-3xl border border-line bg-[#031021cc] p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Личный кабинет</p>
              <h1 className="text-2xl font-semibold">Профиль пользователя</h1>
            </div>
            <Link href="/" className="rounded-2xl border border-line bg-card px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-text">
              К таблице
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card icon={<User size={18} />} label="Пользователь" value={session.user.name || session.user.email || "User"} />
          <Card icon={<DollarSign size={18} />} label="Мой заработок (маржа)" value={money(totalMargin)} accent />
          <Card icon={<DollarSign size={18} />} label="Моя выручка" value={money(totalRevenue)} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-card/70 p-4">
            <p className="mb-3 inline-flex items-center gap-2 text-sm text-muted">
              <KeyRound size={16} />
              Смена пароля
            </p>
            <ChangePasswordForm />
          </div>

          <div className="rounded-3xl border border-line bg-card/70 p-4">
            <p className="mb-3 text-sm text-muted">Последние добавленные вами записи</p>
            <div className="space-y-2">
              {mySales.length === 0 && <p className="text-sm text-muted">У вас пока нет добавленных продаж.</p>}
              {mySales.map((sale) => (
                <div key={sale.id} className="rounded-xl border border-line bg-[#031325] p-3">
                  <p className="text-sm font-semibold text-text">{sale.clientName}</p>
                  <p className="text-xs text-muted">{sale.productName}</p>
                  <p className="text-xs text-success">Маржа: {money(Number(sale.margin))}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
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
