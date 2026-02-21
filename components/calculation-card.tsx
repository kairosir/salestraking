"use client";

import { useMemo, useState } from "react";
import { Calculator, X } from "lucide-react";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " ₸";
}

export function CalculationCard({ totalNetMargin }: { totalNetMargin: number }) {
  const [open, setOpen] = useState(false);

  const split = useMemo(
    () => ({
      dasha: totalNetMargin * 0.6,
      aim: totalNetMargin * 0.4
    }),
    [totalNetMargin]
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-[#020b14] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-text">Расчет общей маржи</h3>
                <p className="text-sm text-muted">С учетом вычета -5%</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <Row label="Общая маржа (-5%)" value={money(totalNetMargin)} />
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
