import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined, DollarSign, TrendingUp, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesForm } from "@/components/sales-form";
import { SalesTable } from "@/components/sales-table";
import { CalculationCard } from "@/components/calculation-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions";

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? -1 : 1;
  const abs = Math.abs(safe);
  const base = Math.floor(abs);
  const frac = abs - base;
  const rounded = frac > 0.5 ? base + 1 : base;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sign * rounded) + " ₸";
}

function decimalText(value: unknown) {
  if (value == null) return "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return "0";
}

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const fetchSales = () =>
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true, username: true } },
        updatedBy: { select: { name: true, email: true, username: true } }
      }
    });

  let sales: Awaited<ReturnType<typeof fetchSales>> = [];
  try {
    sales = await fetchSales();
  } catch (error) {
    console.error("Failed to load sales:", error);
  }

  const totals = sales.reduce(
    (acc, sale) => {
      acc.revenue += Number(sale.salePrice) * sale.quantity;
      acc.margin += Number(sale.margin);
      return acc;
    },
    { revenue: 0, margin: 0 }
  );
  const totalNetMargin = totals.margin;

  const uiSales = sales.map((s) => ({
    id: s.id,
    productId: s.productId,
    clientName: s.clientName,
    clientPhone: s.clientPhone,
    productName: s.productName,
    productLink: s.productLink,
    paidTo: s.paidTo,
    orderDate: s.orderDate ? s.orderDate.toISOString() : null,
    paymentDate: s.paymentDate ? s.paymentDate.toISOString() : null,
    screenshotData: null,
    hasScreenshot: Boolean(s.screenshotData),
    size: s.size,
    quantity: s.quantity,
    costPriceCny: decimalText(s.costPriceCny),
    costPrice: decimalText(s.costPrice),
    salePrice: decimalText(s.salePrice),
    margin: decimalText(s.margin),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    createdByName: s.createdBy?.name || s.createdBy?.username || s.createdBy?.email || "Unknown",
    updatedByName: s.updatedBy?.name || s.updatedBy?.username || s.updatedBy?.email || "Unknown"
  }));

  return (
    <main className="min-h-screen bg-bg bg-mesh">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-6 px-3 py-5 sm:px-5">
        <header className="rounded-3xl border border-line bg-card/75 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-glow">
                <Image src="/icon-store.png" alt="Store icon" width={56} height={56} className="h-12 w-12 object-cover sm:h-14 sm:w-14" />
              </div>
              <div>
                <p className="text-sm text-muted">Aimuselim Online Store</p>
                <h1 className="text-2xl font-semibold">Отслеживание продаж</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
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

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <StatCard icon={<ChartNoAxesCombined size={18} />} label="Продажи" value={String(sales.length)} />
            <StatCard icon={<DollarSign size={18} />} label="Выручка" value={money(totals.revenue)} />
            <StatCard icon={<TrendingUp size={18} />} label="Маржа" value={money(totalNetMargin)} accent />
            <CalculationCard totalNetMargin={totalNetMargin} sales={sales.map((s) => ({ createdAt: s.createdAt.toISOString(), margin: Number(s.margin) }))} />
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
    <div className="h-28 rounded-2xl border border-line bg-card/70 p-3.5">
      <p className="mb-2 inline-flex items-center gap-2 text-sm text-muted">
        <span>{icon}</span>
        {label}
      </p>
      <p className={`text-xl font-semibold ${accent ? "text-success" : "text-text"}`}>{value}</p>
    </div>
  );
}
