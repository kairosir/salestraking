"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, Search, Trash2 } from "lucide-react";
import { deleteSaleAction } from "@/app/actions";
import { SalesForm } from "@/components/sales-form";

type Sale = {
  id: string;
  clientName: string;
  clientPhone: string;
  productName: string;
  productLink: string | null;
  size: string | null;
  quantity: number;
  costPrice: string;
  salePrice: string;
  margin: string;
  createdAt: string;
  createdByName: string;
  updatedByName: string;
};

type SortMode = "newest" | "oldest" | "marginDesc" | "revenueDesc";
type MobileView = "cards" | "list";

function money(value: string | number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value));
}

function dateFmt(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function SalesTable({ sales }: { sales: Sale[] }) {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [mobileView, setMobileView] = useState<MobileView>("cards");

  const authors = useMemo(() => {
    const unique = Array.from(new Set(sales.map((s) => s.createdByName))).sort((a, b) => a.localeCompare(b, "ru"));
    return unique;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const byQuery = sales.filter((item) => {
      if (!q) return true;
      return [item.clientName, item.clientPhone, item.productName, item.size ?? "", item.createdByName, item.updatedByName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const byAuthor = byQuery.filter((item) => (author === "all" ? true : item.createdByName === author));

    return [...byAuthor].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
            placeholder="Поиск по клиенту, товару, автору..."
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

      <div className="hidden overflow-hidden rounded-3xl border border-line bg-card/70 lg:block">
        <div className="grid grid-cols-[1.3fr_1fr_1.2fr_0.8fr_0.7fr_1fr_1fr_1fr_1.2fr_0.9fr] gap-3 border-b border-line px-4 py-3 text-xs uppercase tracking-wide text-muted">
          <span>Клиент</span>
          <span>Телефон</span>
          <span>Товар</span>
          <span>Размер</span>
          <span>Кол-во</span>
          <span>Цена товара</span>
          <span>Цена продажи</span>
          <span>Маржа</span>
          <span>Автор/дата</span>
          <span className="text-right">Действия</span>
        </div>

        <div className="divide-y divide-line">
          {filtered.map((sale) => (
            <div key={sale.id} className="grid items-center gap-3 p-4 lg:grid-cols-[1.3fr_1fr_1.2fr_0.8fr_0.7fr_1fr_1fr_1fr_1.2fr_0.9fr]">
              <p className="font-medium text-text">{sale.clientName}</p>
              <p className="text-sm text-text">{sale.clientPhone}</p>
              <div>
                <p className="text-sm text-text">{sale.productName}</p>
                {sale.productLink && (
                  <a href={sale.productLink} target="_blank" className="text-xs text-accent underline-offset-2 hover:underline" rel="noreferrer">
                    Ссылка
                  </a>
                )}
              </div>
              <p className="text-sm text-text">{sale.size || "-"}</p>
              <p className="text-sm text-text">{sale.quantity}</p>
              <p className="text-sm text-text">{money(sale.costPrice)}</p>
              <p className="text-sm text-text">{money(sale.salePrice)}</p>
              <p className="text-sm font-semibold text-success">{money(sale.margin)}</p>
              <p className="text-xs text-muted">
                {sale.createdByName} · {dateFmt(sale.createdAt)}
                <br />
                изм. {sale.updatedByName}
              </p>

              <div className="flex items-center justify-end gap-2">
                <SalesForm
                  sale={{
                    id: sale.id,
                    clientName: sale.clientName,
                    clientPhone: sale.clientPhone,
                    productName: sale.productName,
                    productLink: sale.productLink,
                    size: sale.size,
                    quantity: sale.quantity,
                    costPrice: sale.costPrice,
                    salePrice: sale.salePrice
                  }}
                />

                <form action={deleteSaleAction}>
                  <input type="hidden" name="id" value={sale.id} />
                  <button type="submit" className="rounded-xl border border-line p-2 text-muted transition hover:border-red-400 hover:text-red-300">
                    <Trash2 size={16} />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`space-y-3 lg:hidden ${mobileView === "cards" ? "block" : "hidden"}`}>
        {filtered.map((sale) => (
          <article key={sale.id} className="rounded-2xl border border-line bg-card/70 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-text">{sale.clientName}</p>
                <p className="text-xs text-muted">{sale.clientPhone}</p>
              </div>
              <p className="text-xs text-muted">{dateFmt(sale.createdAt)}</p>
            </div>

            <p className="text-sm text-text">{sale.productName}</p>
            <p className="mt-1 text-xs text-muted">
              Размер: {sale.size || "-"} · Кол-во: {sale.quantity}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-[#031325] p-2">
                <p className="text-muted">Товар</p>
                <p className="text-text">{money(sale.costPrice)}</p>
              </div>
              <div className="rounded-lg border border-line bg-[#031325] p-2">
                <p className="text-muted">Продажа</p>
                <p className="text-text">{money(sale.salePrice)}</p>
              </div>
              <div className="rounded-lg border border-line bg-[#031325] p-2">
                <p className="text-muted">Маржа</p>
                <p className="font-semibold text-success">{money(sale.margin)}</p>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted">
              Добавил: {sale.createdByName} · Изм.: {sale.updatedByName}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <SalesForm
                sale={{
                  id: sale.id,
                  clientName: sale.clientName,
                  clientPhone: sale.clientPhone,
                  productName: sale.productName,
                  productLink: sale.productLink,
                  size: sale.size,
                  quantity: sale.quantity,
                  costPrice: sale.costPrice,
                  salePrice: sale.salePrice
                }}
              />
              <form action={deleteSaleAction}>
                <input type="hidden" name="id" value={sale.id} />
                <button type="submit" className="rounded-xl border border-line p-2 text-muted transition hover:border-red-400 hover:text-red-300">
                  <Trash2 size={16} />
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>

      <div className={`space-y-2 lg:hidden ${mobileView === "list" ? "block" : "hidden"}`}>
        {filtered.map((sale) => (
          <div key={sale.id} className="rounded-xl border border-line bg-card/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-text">{sale.clientName}</p>
                <p className="text-xs text-muted">{sale.productName}</p>
              </div>
              <p className="text-sm font-semibold text-success">{money(sale.margin)}</p>
            </div>
            <p className="mt-1 text-xs text-muted">{sale.clientPhone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
