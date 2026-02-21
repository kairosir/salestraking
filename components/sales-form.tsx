"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FileImage, Loader2, Pencil, Plus, Upload, X } from "lucide-react";
import { createSaleAction, updateSaleAction } from "@/app/actions";

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
  size: string | null;
  quantity: number;
  costPriceCny: string;
  salePrice: string;
  status: "DONE" | "TODO" | "WAITING";
};

const CNY_TO_KZT = 80;
const MAX_IMAGE_BYTES = 1_100_000;

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-[#04111f] px-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="mb-1.5 text-sm font-semibold text-text">
      {text}
      {required && <span className="ml-1 text-red-400">*</span>}
    </p>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " ₸";
}

function parseFlexibleNumber(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function SalesForm({ sale, compact }: { sale?: SaleRow; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [clientPhone, setClientPhone] = useState<string>(sale?.clientPhone ?? "");
  const [quantity, setQuantity] = useState<number>(sale?.quantity ?? 1);
  const [costPriceCnyInput, setCostPriceCnyInput] = useState<string>(sale?.costPriceCny ?? "");
  const [salePriceInput, setSalePriceInput] = useState<string>(sale?.salePrice ?? "");
  const [screenshotData, setScreenshotData] = useState<string>(sale?.screenshotData ?? "");
  const [status, setStatus] = useState<"DONE" | "TODO" | "WAITING">(sale?.status ?? "WAITING");

  const costPriceCny = useMemo(() => parseFlexibleNumber(costPriceCnyInput), [costPriceCnyInput]);
  const salePrice = useMemo(() => parseFlexibleNumber(salePriceInput), [salePriceInput]);
  const costPriceKzt = useMemo(() => costPriceCny * CNY_TO_KZT, [costPriceCny]);
  const marginPerUnit = useMemo(() => salePrice - costPriceKzt, [salePrice, costPriceKzt]);
  const marginTotal = useMemo(() => marginPerUnit * quantity, [marginPerUnit, quantity]);
  const payoutTotal = useMemo(() => marginTotal * 0.95, [marginTotal]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Можно загружать только изображения");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Скрин слишком большой. Максимум примерно 1 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result) return;
      if (result.length > 1_500_000) {
        setError("Файл слишком большой. Выберите изображение поменьше.");
        return;
      }
      setScreenshotData(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-[#04111f] px-2 text-xs font-semibold text-text transition hover:border-accent"
            : "inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-[#00131f] shadow-glow transition hover:brightness-110"
        }
      >
        {sale ? <Pencil size={14} /> : <Plus size={16} />}
        {compact ? (sale ? "Изм" : "Добав") : sale ? "Изменить" : "Добавить"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#020b14] sm:h-auto sm:max-h-[94vh] sm:max-w-2xl sm:rounded-3xl">
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-text">{sale ? "Редактирование" : "Новый товар"}</h2>
                  <p className="mt-1 text-sm text-muted">Заполните полную информацию по заказу</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text"
                  type="button"
                  aria-label="Закрыть"
                >
                  <X size={22} />
                </button>
              </div>

              {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}

              <form
                action={(formData) => {
                  setError(null);
                  startTransition(async () => {
                    let result: { ok: boolean; error?: string };

                    if (sale) {
                      formData.set("id", sale.id);
                      result = await updateSaleAction(formData);
                    } else {
                      result = await createSaleAction(formData);
                    }

                    if (!result.ok) {
                      setError(result.error ?? "Ошибка сохранения");
                      return;
                    }

                    setOpen(false);
                  });
                }}
                className="space-y-4"
              >
                <input type="hidden" name="screenshotData" value={screenshotData} />
                <input type="hidden" name="status" value={status} />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="ID товара" />
                    <input className={inputClass} placeholder="SKU / ID" name="productId" defaultValue={sale?.productId ?? ""} />
                  </div>
                  <div>
                    <Label text="Дата заказа" />
                    <input className={inputClass} type="date" name="orderDate" defaultValue={toDateInputValue(sale?.orderDate)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Дата оплаты" />
                    <input className={inputClass} type="date" name="paymentDate" defaultValue={toDateInputValue(sale?.paymentDate)} />
                  </div>
                  <div>
                    <Label text="Куда оплатили" />
                    <input className={inputClass} placeholder="Kaspi / карта / supplier" name="paidTo" defaultValue={sale?.paidTo ?? ""} />
                  </div>
                </div>

                <div>
                  <Label text="Имя клиента" />
                  <input className={inputClass} placeholder="Иван Иванов" name="clientName" defaultValue={sale?.clientName ?? ""} />
                </div>

                <div>
                  <Label text="Телефон" />
                  <input
                    className={inputClass}
                    placeholder="+7 7771234567 или 87771234567"
                    name="clientPhone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>

                <div>
                  <Label text="Товар" />
                  <input className={inputClass} placeholder="Название товара" name="productName" defaultValue={sale?.productName ?? ""} />
                </div>

                <div>
                  <Label text="Ссылка на товар" />
                  <input className={inputClass} placeholder="https://..." name="productLink" defaultValue={sale?.productLink ?? ""} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Размер" />
                    <input className={inputClass} placeholder="M, L, 42..." name="size" defaultValue={sale?.size ?? ""} />
                  </div>
                  <div>
                    <Label text="Количество" />
                    <input
                      className={inputClass}
                      placeholder="1"
                      name="quantity"
                      type="number"
                      min={1}
                      defaultValue={sale?.quantity ?? 1}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Цена товара (в юанях)" />
                    <input
                      className={inputClass}
                      placeholder="Например: 19.5 или 19,5"
                      name="costPriceCny"
                      inputMode="decimal"
                      value={costPriceCnyInput}
                      onChange={(e) => setCostPriceCnyInput(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted">Конвертация: 1 ¥ = 80 ₸. В тенге: {money(costPriceKzt)}</p>
                  </div>
                  <div>
                    <Label text="Цена продажи" />
                    <input
                      className={inputClass}
                      placeholder="0"
                      name="salePrice"
                      inputMode="decimal"
                      value={salePriceInput}
                      onChange={(e) => setSalePriceInput(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted">Это цена, которую платит клиент</p>
                  </div>
                </div>

                <div>
                  <Label text="Статус" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setStatus("DONE")}
                      className={`h-10 rounded-xl border text-sm transition ${status === "DONE" ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-line bg-[#04111f] text-text hover:border-emerald-500/50"}`}
                    >
                      Выполнено
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("TODO")}
                      className={`h-10 rounded-xl border text-sm transition ${status === "TODO" ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-line bg-[#04111f] text-text hover:border-rose-500/50"}`}
                    >
                      Доделать
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("WAITING")}
                      className={`h-10 rounded-xl border text-sm transition ${status === "WAITING" ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-line bg-[#04111f] text-text hover:border-amber-500/50"}`}
                    >
                      Ожидание
                    </button>
                  </div>
                </div>

                <div>
                  <Label text="Скрин товара (drag and drop)" />
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file);
                    }}
                    className="rounded-2xl border border-dashed border-line bg-[#04111f] p-4 text-center"
                  >
                    <FileImage className="mx-auto mb-2 text-muted" size={20} />
                    <p className="text-sm text-muted">Перетащите скрин сюда или загрузите кнопкой</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text transition hover:border-accent"
                    >
                      <Upload size={14} />
                      Выбрать файл
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </div>
                  {screenshotData && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-line">
                      <img src={screenshotData} alt="Скрин товара" className="max-h-40 w-full object-contain bg-[#020b14]" />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-line bg-[#04111f] px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>Цена товара в тенге</span>
                    <span className="font-semibold text-text">{money(costPriceKzt)}</span>
                  </div>
                  <div className="my-2 h-px bg-line" />
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>Маржа за единицу</span>
                    <span className="font-semibold text-success">{money(marginPerUnit)}</span>
                  </div>
                  <div className="my-2 h-px bg-line" />
                  <div className="flex items-center justify-between text-base text-text">
                    <span className="font-semibold">Маржа</span>
                    <span className="font-bold text-success">{money(payoutTotal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-11 rounded-xl border border-line bg-[#04111f] text-sm text-text transition hover:border-accent"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-[#00131f] transition hover:brightness-110 disabled:opacity-70"
                  >
                    {pending && <Loader2 className="animate-spin" size={16} />}
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
