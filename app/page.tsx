import Link from "next/link";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined, DollarSign, TrendingUp, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesForm } from "@/components/sales-form";
import { SalesTable } from "@/components/sales-table";
import { logoutAction } from "@/app/actions";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true, username: true } },
      updatedBy: { select: { name: true, email: true, username: true } }
    }
  });

  const totals = sales.reduce(
    (acc, sale) => {
      acc.revenue += Number(sale.salePrice) * sale.quantity;
      acc.margin += Number(sale.margin);
      return acc;
    },
    { revenue: 0, margin: 0 }
  );

  const uiSales = sales.map((s) => ({
    id: s.id,
    clientName: s.clientName,
    clientPhone: s.clientPhone,
    productName: s.productName,
    productLink: s.productLink,
    size: s.size,
    quantity: s.quantity,
    costPrice: s.costPrice.toString(),
    salePrice: s.salePrice.toString(),
    margin: s.margin.toString(),
    createdAt: s.createdAt.toISOString(),
    createdByName: s.createdBy.name || s.createdBy.username || s.createdBy.email || "Unknown",
    updatedByName: s.updatedBy.name || s.updatedBy.username || s.updatedBy.email || "Unknown"
  }));

  return (
    <main className="min-h-screen bg-bg bg-mesh">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="rounded-3xl border border-line bg-[#031021cc] p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted">SalesTracker</p>
              <h1 className="text-2xl font-semibold">Отслеживание продаж</h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-sm sm:flex">
                <User size={15} className="text-muted" />
                <span>{session.user.name || session.user.email}</span>
              </div>
              <Link href="/account" className="rounded-2xl border border-line bg-card px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-text">
                Кабинет
              </Link>
              <form action={logoutAction}>
                <button className="rounded-2xl border border-line bg-card px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-text">
                  Выйти
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard icon={<ChartNoAxesCombined size={18} />} label="Продажи" value={String(sales.length)} />
            <StatCard icon={<DollarSign size={18} />} label="Выручка" value={money(totals.revenue)} />
            <StatCard icon={<TrendingUp size={18} />} label="Маржа" value={money(totals.margin)} accent />
          </div>
        </header>

        <SalesTable sales={uiSales} />

        <div className="fixed bottom-5 right-5 z-40">
          <SalesForm />
        </div>
      </div>
    </main>
  );
}

function StatCard({
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
      <p className={`text-2xl font-semibold ${accent ? "text-success" : "text-text"}`}>{value}</p>
    </div>
  );
}
