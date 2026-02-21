"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Eye, LayoutGrid, List, Loader2, MessageCircle, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteSaleAction, markSaleDoneAction } from "@/app/actions";
import { SalesForm } from "@/components/sales-form";

type Sale = {
  id: string;
  productId: string | null;
  clientName: string;
  clientPhone: string;
  productName: string;
  productLink: string | null;
  paidTo: string | null;
  orderDate: string | null;
  paymentDate: string | null;
  screenshotData: string | null;
  size: string | null;
  quantity: number;
  costPriceCny: string;
  costPrice: string;
  salePrice: string;
  margin: string;
  status: "DONE" | "TODO" | "WAITING";
  createdAt: string;
  createdByName: string;
  updatedByName: string;
};

type SortMode = "newest" | "oldest" | "marginDesc" | "revenueDesc";
type MobileView = "cards" | "list";

function money(value: string | number) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(safe) + " ₸";
}

function dateFmt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return "-";
  }
}

function onlyDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  } catch {
    return "-";
  }
}

function waLink(phone: string) {
  const digitsRaw = phone.replace(/\D/g, "");
  if (!digitsRaw) return null;
  let normalized = digitsRaw;
  if (normalized.length === 10) normalized = `7${normalized}`;
  if (normalized.startsWith("8") && normalized.length === 11) normalized = `7${normalized.slice(1)}`;
  if (normalized.length < 11) return null;
  return `https://wa.me/${normalized}`;
}

function statusLabel(status: Sale["status"]) {
  if (status === "DONE") return "Выполнено";
  if (status === "TODO") return "Доделать";
  return "Ожидание";
}

function statusColor(status: Sale["status"]) {
  if (status === "DONE") return "bg-emerald-500";
  if (status === "TODO") return "bg-rose-500 status-blink";
  return "bg-amber-400 status-blink";
}

function safeTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function SalesTable({ sales }: { sales: Sale[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [mobileView, setMobileView] = useState<MobileView>("cards");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [markingDone, startMarkingDone] = useTransition();

  const authors = useMemo(() => {
    const unique = Array.from(new Set(sales.map((s) => s.createdByName))).sort((a, b) => a.localeCompare(b, "ru"));
    return unique;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const byQuery = sales.filter((item) => {
      if (!q) return true;
      return [item.clientName, item.clientPhone, item.productName, item.productId ?? "", item.size ?? "", item.createdByName, item.updatedByName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const byAuthor = byQuery.filter((item) => (author === "all" ? true : item.createdByName === author));

    return [...byAuthor].sort((a, b) => {
      const aDone = a.status === "DONE";
      const bDone = b.status === "DONE";
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (sort === "newest") return safeTime(b.createdAt) - safeTime(a.createdAt);
      if (sort === "oldest") return safeTime(a.createdAt) - safeTime(b.createdAt);
      if (sort === "marginDesc") return Number(b.margin) - Number(a.margin);
      const aRevenue = Number(a.salePrice) * a.quantity;
      const bRevenue = Number(b.salePrice) * b.quantity;
      return bRevenue - aRevenue;
    });
  }, [query, sales, author, sort]);

  if (!sales.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-card/50 p-10 text-center text-muted">
        <p className="mb-1 text-lg text-text">Нет записей</p>
        <p className="mb-4 text-sm">Добавьте первую продажу, чтобы начать отслеживание.</p>
        <SalesForm />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card/60 p-3 sm:p-4">
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клиенту, товару, трек-коду, автору..."
            className="h-11 w-full rounded-2xl border border-line bg-[#031325] pl-9 pr-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="h-10 rounded-xl border border-line bg-[#031325] px-3 text-sm outline-none transition focus:border-accent"
          >
            <option value="all">Все авторы</option>
            {authors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-10 rounded-xl border border-line bg-[#031325] px-3 text-sm outline-none transition focus:border-accent"
          >
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="marginDesc">По марже (убыв.)</option>
            <option value="revenueDesc">По выручке (убыв.)</option>
          </select>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">Записей: {filtered.length}</p>
            <div className="inline-flex rounded-xl border border-line bg-[#031325] p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileView("cards")}
                className={`rounded-lg px-2 py-1 text-xs ${mobileView === "cards" ? "bg-accent text-[#00131f]" : "text-muted"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className={`rounded-lg px-2 py-1 text-xs ${mobileView === "list" ? "bg-accent text-[#00131f]" : "text-muted"}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden rounded-3xl border border-line bg-card/70 lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1320px]">
            <div className="grid grid-cols-[0.22fr_1.1fr_1fr_1.1fr_0.7fr_0.55fr_0.8fr_0.8fr_0.8fr_0.85fr_1.1fr_0.95fr] gap-2 border-b border-line px-3 py-2 text-[11px] uppercase tracking-wide text-muted">
              <span>Статус</span>
              <span>Клиент</span>
              <span>Телефон</span>
              <span>Товар</span>
              <span>Размер</span>
              <span>Кол-во</span>
              <span>Цена товара</span>
              <span>Цена продажи</span>
              <span>Маржа</span>
              <span>Выручка</span>
              <span>Автор/дата</span>
              <span className="text-right">Действия</span>
            </div>

            <div className="divide-y divide-line">
              {filtered.map((sale) => {
                const whatsapp = waLink(sale.clientPhone);
                const revenue = Number(sale.salePrice) * sale.quantity;

                return (
                  <div key={sale.id} className="grid items-center gap-2 px-3 py-2.5 lg:grid-cols-[0.22fr_1.1fr_1fr_1.1fr_0.7fr_0.55fr_0.8fr_0.8fr_0.8fr_0.85fr_1.1fr_0.95fr]">
                    <div className="flex items-center gap-1">
                      <span className={`h-7 w-1.5 rounded-full ${statusColor(sale.status)}`} />
                      {sale.status === "DONE" && <Check size={12} className="text-emerald-300" />}
                    </div>
                    <p className="truncate text-sm font-medium text-text">{sale.clientName}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs text-text">{sale.clientPhone}</p>
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 transition hover:bg-emerald-500/30"
                          title="Открыть WhatsApp"
                        >
                          <MessageCircle size={12} />
                        </a>
                      )}
                    </div>
                    <div>
                      <p className="truncate text-xs text-text">{sale.productName}</p>
                      {sale.productId && <p className="text-[11px] text-muted">Трек: {sale.productId}</p>}
                    </div>
                    <p className="text-xs text-text">{sale.size || "-"}</p>
                    <p className="text-xs text-text">{sale.quantity}</p>
                    <p className="text-xs text-text">{money(sale.costPrice)}</p>
                    <p className="text-xs text-text">{money(sale.salePrice)}</p>
                    <p className="text-xs font-semibold text-success">{money(sale.margin)}</p>
                    <p className="text-xs text-text">{money(revenue)}</p>
                    <p className="text-[11px] text-muted">
                      {sale.createdByName} · {dateFmt(sale.createdAt)}
                      <br />
                      изм. {sale.updatedByName}
                      <br />
                      {statusLabel(sale.status)}
                    </p>

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSale(sale)}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-[#04111f] px-2 text-xs text-text transition hover:border-accent"
                      >
                        <Eye size={14} />
                        Открыть
                      </button>

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
                          orderDate: sale.orderDate,
                          paymentDate: sale.paymentDate,
                          screenshotData: sale.screenshotData,
                          size: sale.size,
                          quantity: sale.quantity,
                          costPriceCny: sale.costPriceCny,
                          salePrice: sale.salePrice,
                          status: sale.status
                        }}
                      />

                      <form action={deleteSaleAction}>
                        <input type="hidden" name="id" value={sale.id} />
                        <button
                          type="submit"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={`space-y-3 lg:hidden ${mobileView === "cards" ? "block" : "hidden"}`}>
        {filtered.map((sale) => {
          const whatsapp = waLink(sale.clientPhone);
          const revenue = Number(sale.salePrice) * sale.quantity;

          return (
            <article key={sale.id} className="rounded-2xl border border-line bg-card/70 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusColor(sale.status)}`} />
                    {sale.status === "DONE" && <Check size={12} className="text-emerald-300" />}
                    <p className="text-[11px] text-muted">{statusLabel(sale.status)}</p>
                  </div>
                  <p className="text-base font-semibold text-text">{sale.clientName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted">{sale.clientPhone}</p>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
                        title="Открыть WhatsApp"
                      >
                        <MessageCircle size={12} />
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted">{dateFmt(sale.createdAt)}</p>
              </div>

              <p className="text-sm text-text">{sale.productName}</p>
              {sale.productId && <p className="text-xs text-muted">Трек: {sale.productId}</p>}
              <p className="mt-1 text-xs text-muted">
                Размер: {sale.size || "-"} · Кол-во: {sale.quantity}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-line bg-[#031325] p-2">
                  <p className="text-muted">Маржа</p>
                  <p className="font-semibold text-success">{money(sale.margin)}</p>
                </div>
                <div className="rounded-lg border border-line bg-[#031325] p-2">
                  <p className="text-muted">Выручка</p>
                  <p className="text-text">{money(revenue)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSale(sale)}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-[#04111f] px-2 text-xs text-text"
                >
                  <Eye size={14} />
                  Открыть
                </button>

                <SalesForm
                  sale={{
                    id: sale.id,
                    productId: sale.productId,
                    clientName: sale.clientName,
                    clientPhone: sale.clientPhone,
                    productName: sale.productName,
                    productLink: sale.productLink,
                    paidTo: sale.paidTo,
                    orderDate: sale.orderDate,
                    paymentDate: sale.paymentDate,
                    screenshotData: sale.screenshotData,
                    size: sale.size,
                    quantity: sale.quantity,
                    costPriceCny: sale.costPriceCny,
                    salePrice: sale.salePrice,
                    status: sale.status
                  }}
                  compact
                />
                <form action={deleteSaleAction}>
                  <input type="hidden" name="id" value={sale.id} />
                  <button type="submit" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-red-400 hover:text-red-300">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      <div className={`space-y-2 lg:hidden ${mobileView === "list" ? "block" : "hidden"}`}>
        {filtered.map((sale) => {
          const revenue = Number(sale.salePrice) * sale.quantity;

          return (
            <div key={sale.id} className="rounded-xl border border-line bg-card/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusColor(sale.status)}`} />
                    {sale.status === "DONE" && <Check size={12} className="text-emerald-300" />}
                    <p className="text-[11px] text-muted">{statusLabel(sale.status)}</p>
                  </div>
                  <p className="font-medium text-text">{sale.clientName}</p>
                  <p className="text-xs text-muted">{sale.productName}</p>
                </div>
                <p className="text-sm font-semibold text-success">{money(sale.margin)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">Выручка: {money(revenue)}</p>
              <p className="text-xs text-muted">{sale.clientPhone}</p>
            </div>
          );
        })}
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#020b14] p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-text">Карточка товара</h3>
                <p className="text-sm text-muted">Полная информация</p>
              </div>
              <button type="button" onClick={() => setSelectedSale(null)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Трек код товара" value={selectedSale.productId || "-"} />
              <Info label="Товар" value={selectedSale.productName} />
              <Info label="Клиент" value={selectedSale.clientName} />
              <Info label="Телефон" value={selectedSale.clientPhone} />
              <Info label="Дата заказа" value={onlyDate(selectedSale.orderDate)} />
              <Info label="Дата оплаты" value={onlyDate(selectedSale.paymentDate)} />
              <Info label="Куда оплатили" value={selectedSale.paidTo || "-"} />
              <Info label="Размер" value={selectedSale.size || "-"} />
              <Info label="Количество" value={String(selectedSale.quantity)} />
              <Info label="Цена товара (¥)" value={selectedSale.costPriceCny} />
              <Info label="Цена товара (₸)" value={money(selectedSale.costPrice)} />
              <Info label="Цена продажи (₸)" value={money(selectedSale.salePrice)} />
              <Info label="Маржа (₸)" value={money(selectedSale.margin)} />
              <Info label="Выручка (₸)" value={money(Number(selectedSale.salePrice) * selectedSale.quantity)} />
              <Info label="Статус" value={statusLabel(selectedSale.status)} />
              <Info label="Создал" value={selectedSale.createdByName} />
              <Info label="Изменил" value={selectedSale.updatedByName} />
            </div>

            {selectedSale.productLink && (
              <a href={selectedSale.productLink} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl border border-line px-4 py-2 text-sm text-accent transition hover:border-accent">
                Открыть ссылку товара
              </a>
            )}

            {selectedSale.screenshotData && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                <img src={selectedSale.screenshotData} alt="Скрин товара" className="max-h-[320px] w-full object-contain bg-[#04111f]" />
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="h-10 rounded-xl border border-line bg-[#04111f] text-sm text-text transition hover:border-accent"
              >
                Закрыть
              </button>
              <button
                type="button"
                disabled={markingDone || selectedSale.status === "DONE"}
                onClick={() => {
                  startMarkingDone(async () => {
                    const result = await markSaleDoneAction(selectedSale.id);
                    if (!result.ok) return;
                    setSelectedSale((prev) => (prev ? { ...prev, status: "DONE" } : prev));
                    router.refresh();
                  });
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-3 text-sm font-semibold text-[#00131f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingDone && <Loader2 size={14} className="animate-spin" />}
                {selectedSale.status === "DONE" ? "Выдано ✓" : "Выдано"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-[#04111f] p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  );
}
