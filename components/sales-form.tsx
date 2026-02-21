"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createSaleAction, updateSaleAction } from "@/app/actions";

type SaleRow = {
  id: string;
  clientName: string;
  clientPhone: string;
  productName: string;
  productLink: string | null;
  size: string | null;
  quantity: number;
  costPrice: string;
  salePrice: string;
};

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-[#031325] px-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

export function SalesForm({ sale }: { sale?: SaleRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const profitHint = useMemo(() => {
    if (!sale) return "Маржа рассчитается автоматически";
    return "Сохранение обновит маржу автоматически";
  }, [sale]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#00131f] shadow-glow transition hover:brightness-110"
      >
        <Plus size={16} />
        {sale ? "Изменить" : "Добавить"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-4">
          <div className="h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#031021] p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">{sale ? "Редактирование" : "Новая продажа"}</h2>
              <button onClick={() => setOpen(false)} className="text-sm text-muted transition hover:text-text" type="button">
                Закрыть
              </button>
            </div>

            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    if (sale) {
                      formData.set("id", sale.id);
                      await updateSaleAction(formData);
                    } else {
                      await createSaleAction(formData);
                    }
                    setOpen(false);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "Ошибка");
                  }
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <input className={inputClass} placeholder="Имя клиента" name="clientName" defaultValue={sale?.clientName ?? ""} required />
              <input className={inputClass} placeholder="Телефон" name="clientPhone" defaultValue={sale?.clientPhone ?? ""} required />
              <input className={inputClass} placeholder="Товар" name="productName" defaultValue={sale?.productName ?? ""} required />
              <input className={inputClass} placeholder="Ссылка на товар" name="productLink" defaultValue={sale?.productLink ?? ""} />
              <input className={inputClass} placeholder="Размер" name="size" defaultValue={sale?.size ?? ""} />
              <input className={inputClass} placeholder="Количество" name="quantity" type="number" min={1} defaultValue={sale?.quantity ?? 1} required />
              <input
                className={inputClass}
                placeholder="Цена товара"
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={sale?.costPrice ?? "0"}
                required
              />
              <input
                className={inputClass}
                placeholder="Цена продажи"
                name="salePrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={sale?.salePrice ?? "0"}
                required
              />

              <p className="sm:col-span-2 text-xs text-muted">{profitHint}</p>

              <button
                type="submit"
                disabled={pending}
                className="sm:col-span-2 mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-[#00131f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pending && <Loader2 className="animate-spin" size={16} />}
                {sale ? "Сохранить изменения" : "Создать запись"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
