"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useModalHistory } from "@/lib/use-modal-history";

const CNY_TO_KZT = 80;
const FEE_RATE = 0.05;

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
  size: string | null;
  quantity: number;
  costPriceCny: string;
  salePrice: string;
  margin: string;
  status: "DONE" | "TODO";
  createdAt: string;
};

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? -1 : 1;
  const abs = Math.abs(safe);
  const base = Math.floor(abs);
  const frac = abs - base;
  const rounded = frac > 0.5 ? base + 1 : base;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sign * rounded) + " ₸";
}

function toNumber(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function FinanceAuditPanel({ sales }: { sales: SaleRow[] }) {
  const [query, setQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const closeSelectedSaleModal = useModalHistory(Boolean(selectedSale), () => setSelectedSale(null));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!q) return true;
      return [sale.clientName, sale.clientPhone, sale.productName, sale.productId ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [query, sales]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, sale) => {
        const salePrice = toNumber(sale.salePrice);
        const fee = salePrice * FEE_RATE;
        const saleAfterFee = salePrice - fee;
        const costKzt = toNumber(sale.costPriceCny) * CNY_TO_KZT;
        const marginCalculated = saleAfterFee - costKzt;
        acc.sale += salePrice;
        acc.fee += fee;
        acc.saleAfterFee += saleAfterFee;
        acc.cost += costKzt;
        acc.margin += marginCalculated;
        return acc;
      },
      { sale: 0, fee: 0, saleAfterFee: 0, cost: 0, margin: 0 }
    );
  }, [filtered]);

  return (
    <section className="rounded-3xl border border-line bg-card/70 bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Финансовая проверка</p>
          <h2 className="text-base font-semibold text-text">Все товары на сайте</h2>
        </div>
        <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs text-muted">
          Формула: (Цена продажи - 5%) - Себестоимость(¥*80)
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        <MiniStat label="Продажа" value={money(totals.sale)} />
        <MiniStat label="Вычтено 5%" value={money(totals.fee)} />
        <MiniStat label="После -5%" value={money(totals.saleAfterFee)} />
        <MiniStat label="Себестоимость" value={money(totals.cost)} />
        <MiniStat label="Маржа" value={money(totals.margin)} accent />
      </div>

      <div className="relative mb-3 mt-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по клиенту, номеру, товару, трек-коду..."
          className="h-10 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm outline-none transition focus:border-accent"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[1.15fr_1.1fr_0.8fr_0.7fr_0.85fr_0.9fr_0.85fr_0.65fr] gap-2 border-b border-line bg-card px-3 py-2 text-[11px] uppercase tracking-wide text-muted">
            <span>Клиент / Товар</span>
            <span>Трек</span>
            <span>Продажа</span>
            <span>-5%</span>
            <span>После -5%</span>
            <span>Себестоим. (¥*80)</span>
            <span>Маржа</span>
            <span>Статус</span>
          </div>

          <div className="divide-y divide-line">
            {filtered.length === 0 && <p className="px-3 py-4 text-sm text-muted">Нет данных</p>}
            {filtered.map((sale) => {
              const salePrice = toNumber(sale.salePrice);
              const fee = salePrice * FEE_RATE;
              const saleAfterFee = salePrice - fee;
              const costKzt = toNumber(sale.costPriceCny) * CNY_TO_KZT;
              const marginCalculated = saleAfterFee - costKzt;
              return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setSelectedSale(sale)}
                  className="grid w-full grid-cols-[1.15fr_1.1fr_0.8fr_0.7fr_0.85fr_0.9fr_0.85fr_0.65fr] items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-card"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text">{sale.clientName || "Без имени"}</p>
                    <p className="truncate text-[11px] text-muted">{sale.productName || "Без товара"}</p>
                  </div>
                  <span className="truncate text-text">{sale.productId || "-"}</span>
                  <span className="text-text">{money(salePrice)}</span>
                  <span className="text-red-300">{money(fee)}</span>
                  <span className="text-text">{money(saleAfterFee)}</span>
                  <span className="text-text">{money(costKzt)}</span>
                  <span className="font-semibold text-success">{money(marginCalculated)}</span>
                  <span className="text-muted">{sale.status === "DONE" ? "Выполнено" : "Доделать"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Финансовая карточка товара</p>
                <h3 className="text-xl font-semibold text-text">{selectedSale.productName}</h3>
              </div>
              <button
                type="button"
                onClick={closeSelectedSaleModal}
                className="rounded-xl border border-line px-3 py-1 text-sm text-muted transition hover:border-accent hover:text-text"
              >
                Закрыть
              </button>
            </div>

            {(() => {
              const salePrice = toNumber(selectedSale.salePrice);
              const fee = salePrice * FEE_RATE;
              const saleAfterFee = salePrice - fee;
              const costKzt = toNumber(selectedSale.costPriceCny) * CNY_TO_KZT;
              const marginCalculated = saleAfterFee - costKzt;
              const dbMargin = toNumber(selectedSale.margin);
              const delta = dbMargin - marginCalculated;

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Info label="Клиент" value={selectedSale.clientName} />
                    <Info label="Телефон" value={selectedSale.clientPhone} />
                    <Info label="Трек-код" value={selectedSale.productId || "-"} />
                    <Info label="Статус" value={selectedSale.status === "DONE" ? "Выполнено" : "Доделать"} />
                  </div>

                  <div className="rounded-xl border border-line bg-card p-3">
                    <p className="text-sm font-semibold text-text">Проверка расчета</p>
                    <div className="mt-2 space-y-1.5 text-sm text-muted">
                      <p>Цена продажи: <span className="text-text">{money(salePrice)}</span></p>
                      <p>Минус 5%: <span className="text-red-300">-{money(fee)}</span></p>
                      <p>После -5%: <span className="text-text">{money(saleAfterFee)}</span></p>
                      <p>Себестоимость (¥*80): <span className="text-text">-{money(costKzt)}</span></p>
                      <p>Итоговая маржа (расчет): <span className="font-semibold text-success">{money(marginCalculated)}</span></p>
                      <p>Маржа в БД: <span className="text-text">{money(dbMargin)}</span></p>
                      <p>Разница (БД - расчет): <span className={Math.abs(delta) < 0.01 ? "text-success" : "text-amber-300"}>{money(delta)}</span></p>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-card p-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${accent ? "text-success" : "text-text"}`}>{value}</p>
    </div>
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
