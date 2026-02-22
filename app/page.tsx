import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChartNoAxesCombined, LogOut, TrendingUp, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesForm } from "@/components/sales-form";
import { SalesTable } from "@/components/sales-table";
import { CalculationCard } from "@/components/calculation-card";
import { ScriptsBoard } from "@/components/scripts-board";
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
  const fetchScripts = () =>
    prisma.scriptTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100
    });

  let sales: Awaited<ReturnType<typeof fetchSales>> = [];
  let scripts: Awaited<ReturnType<typeof fetchScripts>> = [];
  try {
    [sales, scripts] = await Promise.all([fetchSales(), fetchScripts()]);
  } catch (error) {
    console.error("Failed to load home data:", error);
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
    trackingNumber: s.trackingNumber,
    trackingProvider: s.trackingProvider,
    trackingStatus: s.trackingStatus,
    trackingSubstatus: s.trackingSubstatus,
    trackingLastEvent: s.trackingLastEvent,
    trackingSyncedAt: s.trackingSyncedAt ? s.trackingSyncedAt.toISOString() : null,
    size: s.size,
    quantity: s.quantity,
    costPriceCny: decimalText(s.costPriceCny),
    costPrice: decimalText(s.costPrice),
    salePrice: decimalText(s.salePrice),
    margin: decimalText(s.margin),
    status: s.status,
    isIssued: s.isIssued,
    createdAt: s.createdAt.toISOString(),
    createdByName: s.createdBy?.name || s.createdBy?.username || s.createdBy?.email || "Unknown",
    updatedByName: s.updatedBy?.name || s.updatedBy?.username || s.updatedBy?.email || "Unknown"
  }));

  return (
    <main className="min-h-screen bg-bg bg-mesh">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-5 sm:py-5">
        <header className="rounded-3xl border border-line bg-card/75 bg-panel p-3 backdrop-blur sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-glow">
                <Image src="/icon-store.png" alt="Store icon" width={56} height={56} className="h-12 w-12 object-cover sm:h-14 sm:w-14" />
              </div>
              <div>
                <p className="text-sm text-muted">Aimuselim Online Store</p>
                <h1 className="text-xl font-semibold sm:text-2xl">Отслеживание продаж</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle iconOnly />
              <Link
                href="/account"
                title={session.user.name || session.user.email || "Кабинет"}
                aria-label="Личный кабинет"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-card text-muted transition hover:border-accent hover:text-text"
              >
                <User size={16} />
              </Link>
              <form action={logoutAction}>
                <button
                  title="Выйти"
                  aria-label="Выйти"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-card text-muted transition hover:border-accent hover:text-text"
                >
                  <LogOut size={16} />
                </button>
              </form>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:mt-4 sm:gap-3 md:grid-cols-5">
            <StatCard icon={<ChartNoAxesCombined size={18} />} label="Продажи" value={String(sales.length)} />
            <StatCard icon={<TengeIcon />} label="Выручка" value={money(totals.revenue)} />
            <StatCard icon={<TrendingUp size={18} />} label="Маржа" value={money(totalNetMargin)} accent />
            <CalculationCard totalNetMargin={totalNetMargin} sales={sales.map((s) => ({ createdAt: s.createdAt.toISOString(), margin: Number(s.margin) }))} />
            <ScriptsBoard
              scripts={scripts.map((item) => ({
                id: item.id,
                question: item.question,
                answer: item.answer,
                updatedAt: item.updatedAt.toISOString()
              }))}
            />
          </div>
        </header>

        <SalesTable sales={uiSales} />

        <div className="fixed bottom-5 left-5 z-40">
          <SalesForm />
        </div>
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
    <div className="flex h-[74px] flex-col rounded-2xl border border-line bg-card/70 bg-panel p-2.5 sm:h-28 sm:p-3.5">
      <p className="inline-flex items-center gap-2 text-xs text-muted sm:text-sm">
        <span>{icon}</span>
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold leading-none sm:mt-3 sm:text-xl ${accent ? "text-success" : "text-text"}`}>{value}</p>
    </div>
  );
}
