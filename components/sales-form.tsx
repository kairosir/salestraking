"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
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
  "h-16 w-full rounded-2xl border border-line bg-[#04111f] px-5 text-[42px] text-base text-text placeholder:text-muted outline-none transition focus:border-accent sm:h-14 sm:text-[32px]";

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="mb-2 text-[34px] text-lg font-semibold text-text sm:text-base">
      {text}
      {required && <span className="ml-1 text-red-400">*</span>}
    </p>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function SalesForm({ sale }: { sale?: SaleRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState<number>(sale?.quantity ?? 1);
  const [costPrice, setCostPrice] = useState<number>(Number(sale?.costPrice ?? 0));
  const [salePrice, setSalePrice] = useState<number>(Number(sale?.salePrice ?? 0));

  const marginPerUnit = useMemo(() => salePrice - costPrice, [salePrice, costPrice]);
  const marginTotal = useMemo(() => marginPerUnit * quantity, [marginPerUnit, quantity]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-[#00131f] shadow-glow transition hover:brightness-110"
      >
        <Plus size={16} />
        {sale ? "Изменить" : "Добавить"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#020b14] sm:h-auto sm:max-h-[95vh] sm:max-w-4xl sm:rounded-3xl">
            <div className="p-5 sm:p-8">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[48px] text-4xl font-semibold text-text sm:text-5xl">{sale ? "Редактирование" : "Новая продажа"}</h2>
                  <p className="mt-2 text-[32px] text-xl text-muted sm:text-2xl">Заполните данные о новой продаже</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text"
                  type="button"
                  aria-label="Закрыть"
                >
                  <X size={28} />
                </button>
              </div>

              {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}

              <form
                action={(formData) => {
                  setError(null);
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
                      setError(e instanceof Error ? e.message : "Ошибка сохранения");
                    }
                  });
                }}
                className="space-y-5"
              >
                <div>
                  <Label text="Имя клиента" required />
                  <input className={inputClass} placeholder="Иван Иванов" name="clientName" defaultValue={sale?.clientName ?? ""} required />
                </div>

                <div>
                  <Label text="Телефон" />
                  <input className={inputClass} placeholder="+7 (999) 123-45-67" name="clientPhone" defaultValue={sale?.clientPhone ?? ""} required />
                </div>

                <div>
                  <Label text="Товар" required />
                  <input className={inputClass} placeholder="Название товара" name="productName" defaultValue={sale?.productName ?? ""} required />
                </div>

                <div>
                  <Label text="Ссылка на товар" />
                  <input className={inputClass} placeholder="https://..." name="productLink" defaultValue={sale?.productLink ?? ""} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label text="Размер" />
                    <input className={inputClass} placeholder="M, L, 42..." name="size" defaultValue={sale?.size ?? ""} />
                  </div>
                  <div>
                    <Label text="Количество" required />
                    <input
                      className={inputClass}
                      placeholder="1"
                      name="quantity"
                      type="number"
                      min={1}
                      defaultValue={sale?.quantity ?? 1}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label text="Цена товара" required />
                    <input
                      className={inputClass}
                      placeholder="0.00"
                      name="costPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={sale?.costPrice ?? "0"}
                      onChange={(e) => setCostPrice(Number(e.target.value || 0))}
                      required
                    />
                  </div>
                  <div>
                    <Label text="Цена продажи" required />
                    <input
                      className={inputClass}
                      placeholder="0.00"
                      name="salePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={sale?.salePrice ?? "0"}
                      onChange={(e) => setSalePrice(Number(e.target.value || 0))}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-line bg-[#04111f] px-5 py-4">
                  <div className="flex items-center justify-between text-[34px] text-xl text-muted sm:text-lg">
                    <span>Маржа за единицу</span>
                    <span className="font-semibold text-success">{money(marginPerUnit)} $</span>
                  </div>
                  <div className="my-3 h-px bg-line" />
                  <div className="flex items-center justify-between text-[36px] text-2xl text-text sm:text-xl">
                    <span className="font-semibold">Общая маржа</span>
                    <span className="font-bold text-success">{money(marginTotal)} $</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-16 rounded-2xl border border-line bg-[#04111f] text-[36px] text-xl text-text transition hover:border-accent sm:h-14 sm:text-lg"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-accent text-[36px] text-xl font-semibold text-[#00131f] transition hover:brightness-110 disabled:opacity-70 sm:h-14 sm:text-lg"
                  >
                    {pending && <Loader2 className="animate-spin" size={18} />}
                    {sale ? "Сохранить" : "Добавить"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
