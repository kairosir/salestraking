"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { SalesForm } from "@/components/sales-form";

type SaleRow = {
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
  receiptData: string | null;
  size: string | null;
  quantity: number;
  costPriceCny: string;
  salePrice: string;
  margin: string;
  status: "DONE" | "TODO";
  createdAt: string;
};

function money(value: string | number) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 0;
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

export function MyOrdersPanel({ sales }: { sales: SaleRow[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sales.filter((sale) => {
      if (!q) return true;
      return [sale.clientName, sale.clientPhone, sale.productName, sale.productId ?? ""].join(" ").toLowerCase().includes(q);
    });

    const map = new Map<string, { key: string; title: string; phone: string; sales: SaleRow[] }>();
    for (const sale of filtered) {
      const key = groupKey(sale.clientName, sale.clientPhone, sale.id);
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          key,
          title: sale.clientName || "Без имени",
          phone: sale.clientPhone || "-",
          sales: [sale]
        });
        continue;
      }
      current.sales.push(sale);
    }

    const list = Array.from(map.values());
    list.sort((a, b) => (new Date(b.sales[0]?.createdAt || 0).getTime() || 0) - (new Date(a.sales[0]?.createdAt || 0).getTime() || 0));
    return list;
  }, [query, sales]);

  return (
    <section className="rounded-3xl border border-line bg-card/70 bg-panel p-4">
      <p className="mb-3 text-sm text-muted">Мои заказы</p>

      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по клиенту, номеру, товару..."
          className="h-10 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm outline-none transition focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        {groups.length === 0 && <p className="text-sm text-muted">Нет совпадений</p>}
        {groups.map((group) => {
          const isExpanded = expanded[group.key] ?? false;
          return (
            <article key={group.key} className="rounded-xl border border-line bg-card p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setExpanded((prev) => ({ ...prev, [group.key]: !isExpanded }))}
              >
                <div>
                  <p className="text-sm font-semibold text-text">{group.title}</p>
                  <p className="text-xs text-muted">{group.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{group.sales.length} заказ(а)</span>
                  {isExpanded ? <ChevronDown size={15} className="text-muted" /> : <ChevronRight size={15} className="text-muted" />}
                </div>
              </button>

              {isExpanded && (
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
                        <div
                          key={sale.id}
                          className="grid cursor-pointer items-center gap-2 px-2 py-2 text-xs lg:grid-cols-[1.2fr_0.5fr_0.8fr_0.8fr_0.7fr]"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-text">{sale.productName}</p>
                            {sale.productId && <p className="truncate text-[11px] text-muted">Трек: {sale.productId}</p>}
                          </div>
                          <span className="text-text">{sale.quantity}</span>
                          <span className="font-semibold text-success">{money(sale.margin)}</span>
                          <span className="text-muted">{sale.status === "DONE" ? "Выдано" : "Доделать"}</span>
                          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
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
                                receiptData: sale.receiptData,
                                size: sale.size,
                                quantity: sale.quantity,
                                costPriceCny: sale.costPriceCny,
                                salePrice: sale.salePrice,
                                status: sale.status
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Карточка заказа</p>
                <h3 className="text-xl font-semibold text-text">{selectedSale.productName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="rounded-xl border border-line px-3 py-1 text-sm text-muted transition hover:border-accent hover:text-text"
              >
                Закрыть
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Клиент" value={selectedSale.clientName} />
              <Info label="Телефон" value={selectedSale.clientPhone} />
              <Info label="Трек код" value={selectedSale.productId || "-"} />
              <Info label="Размер" value={selectedSale.size || "-"} />
              <Info label="Количество" value={String(selectedSale.quantity)} />
              <Info label="Цена товара (¥)" value={selectedSale.costPriceCny} />
              <Info label="Цена продажи (₸)" value={money(selectedSale.salePrice)} />
              <Info label="Маржа (₸)" value={money(selectedSale.margin)} />
              <Info label="Статус" value={selectedSale.status === "DONE" ? "Выдано" : "Доделать"} />
            </div>

            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <SalesForm
                compact
                sale={{
                  id: selectedSale.id,
                  productId: selectedSale.productId,
                  clientName: selectedSale.clientName,
                  clientPhone: selectedSale.clientPhone,
                  productName: selectedSale.productName,
                  productLink: selectedSale.productLink,
                  paidTo: selectedSale.paidTo,
                  orderDate: selectedSale.orderDate,
                  paymentDate: selectedSale.paymentDate,
                  screenshotData: selectedSale.screenshotData,
                  receiptData: selectedSale.receiptData,
                  size: selectedSale.size,
                  quantity: selectedSale.quantity,
                  costPriceCny: selectedSale.costPriceCny,
                  salePrice: selectedSale.salePrice,
                  status: selectedSale.status
                }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  );
}
