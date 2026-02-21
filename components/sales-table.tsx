"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
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

function money(value: string | number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value));
}

export function SalesTable({ sales }: { sales: Sale[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;

    return sales.filter((item) =>
      [item.clientName, item.clientPhone, item.productName, item.size ?? "", item.createdByName, item.updatedByName]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, sales]);

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
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по клиенту, товару, автору..."
          className="h-11 w-full rounded-2xl border border-line bg-[#031325] pl-9 pr-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-line bg-card/70">
        <div className="hidden grid-cols-[1.3fr_1fr_1.2fr_0.8fr_0.7fr_1fr_1fr_1fr_1fr_0.9fr] gap-3 border-b border-line px-4 py-3 text-xs uppercase tracking-wide text-muted lg:grid">
          <span>Клиент</span>
          <span>Телефон</span>
          <span>Товар</span>
          <span>Размер</span>
          <span>Кол-во</span>
          <span>Цена товара</span>
          <span>Цена продажи</span>
          <span>Маржа</span>
          <span>Кто добавил</span>
          <span className="text-right">Действия</span>
        </div>

        <div className="divide-y divide-line">
          {filtered.map((sale) => (
            <div key={sale.id} className="grid gap-3 p-4 lg:grid-cols-[1.3fr_1fr_1.2fr_0.8fr_0.7fr_1fr_1fr_1fr_1fr_0.9fr] lg:items-center">
              <div>
                <p className="font-medium text-text">{sale.clientName}</p>
                <p className="text-xs text-muted lg:hidden">{sale.clientPhone}</p>
              </div>
              <p className="hidden text-sm text-text lg:block">{sale.clientPhone}</p>
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
                {sale.createdByName}
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
    </div>
  );
}
