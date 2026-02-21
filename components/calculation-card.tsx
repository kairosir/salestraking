"use client";

import { useMemo, useState } from "react";
import { Calculator, X } from "lucide-react";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value) + " ₸";
}

type CalcSale = { createdAt: string; margin: number };

export function CalculationCard({ totalNetMargin, sales }: { totalNetMargin: number; sales: CalcSale[] }) {
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const periodMargin = useMemo(() => {
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return totalNetMargin;

    return sales.reduce((sum, sale) => {
      const created = new Date(sale.createdAt).getTime();
      if (!Number.isFinite(created)) return sum;
      if (created < fromMs || created > toMs) return sum;
      return sum + (Number.isFinite(sale.margin) ? sale.margin : 0);
    }, 0);
  }, [fromDate, toDate, sales, totalNetMargin]);

  const split = useMemo(
    () => ({
      dasha: periodMargin * 0.6,
      aim: periodMargin * 0.4
    }),
    [periodMargin]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-line bg-card/70 p-4 text-left transition hover:border-accent"
      >
        <p className="mb-2 inline-flex items-center gap-2 text-sm text-muted">
          <Calculator size={18} />
          Расчет
        </p>
        <p className="text-xl font-semibold text-text">{money(totalNetMargin)}</p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#020b14] p-4 sm:h-auto sm:max-h-[94vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-text">Расчет общей маржи</h3>
                <p className="text-sm text-muted">С учетом вычета -5%</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted">Период с</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-[#04111f] px-3 text-sm text-text outline-none transition focus:border-accent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Период по</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-[#04111f] px-3 text-sm text-text outline-none transition focus:border-accent"
                />
              </label>
            </div>

            <div className="space-y-2">
              <Row label="Маржа за период" value={money(periodMargin)} />
              <Row label="Dasha (60%)" value={money(split.dasha)} />
              <Row label="aim (40%)" value={money(split.aim)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-[#04111f] px-3 py-2.5">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-base font-semibold text-text">{value}</p>
    </div>
  );
}
