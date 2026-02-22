"use client";

import { type SyntheticEvent, useMemo, useRef, useState, useTransition } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
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
  status: "DONE" | "TODO";
};

const CNY_TO_KZT = 80;
const MAX_IMAGE_BYTES = 1_100_000;
const SALE_DRAFT_KEY = "salestraking:new-sale-draft:v1";

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="mb-1.5 text-sm font-semibold text-text">
      {text}
      {required && <span className="ml-1 text-red-400">*</span>}
    </p>
  );
}

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? -1 : 1;
  const abs = Math.abs(safe);
  const base = Math.floor(abs);
  const frac = abs - base;
  const rounded = frac > 0.5 ? base + 1 : base;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sign * rounded) + " ₸";
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

type SaleDraft = {
  orderDate: string;
  paymentDate: string;
  paidTo: string;
  clientName: string;
  clientPhone: string;
  productName: string;
  productId: string;
  productLink: string;
  size: string;
  quantity: string;
  costPriceCny: string;
  salePrice: string;
  status: "DONE" | "TODO";
  screenshotData: string;
};

function emptyDraft(): SaleDraft {
  return {
    orderDate: "",
    paymentDate: "",
    paidTo: "",
    clientName: "",
    clientPhone: "",
    productName: "",
    productId: "",
    productLink: "",
    size: "",
    quantity: "1",
    costPriceCny: "",
    salePrice: "",
    status: "TODO",
    screenshotData: ""
  };
}

function loadDraft(): SaleDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = window.localStorage.getItem(SALE_DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<SaleDraft>;
    return { ...emptyDraft(), ...parsed };
  } catch {
    return emptyDraft();
  }
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    image.src = src;
  });
}

type CropPixels = { x: number; y: number; width: number; height: number };

function shrinkCanvas(source: HTMLCanvasElement, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(source.width * scale));
  canvas.height = Math.max(1, Math.floor(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось подготовить изображение");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encodeCanvasToTargetSize(source: HTMLCanvasElement, maxBytes: number) {
  let canvas = source;
  let quality = 0.92;
  for (let i = 0; i < 14; i += 1) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const bytes = estimateDataUrlBytes(dataUrl);
    if (bytes <= maxBytes) return dataUrl;

    if (quality > 0.55) {
      quality = Math.max(0.55, quality - 0.08);
      continue;
    }

    canvas = shrinkCanvas(canvas, 0.85);
    quality = 0.88;
  }

  return canvas.toDataURL("image/jpeg", 0.55);
}

async function getCroppedDataUrl(imageSrc: string, cropPixels: CropPixels, renderedImage: HTMLImageElement | null) {
  const image = renderedImage ?? (await loadImage(imageSrc));
  const renderWidth = renderedImage?.width || image.width;
  const renderHeight = renderedImage?.height || image.height;
  const naturalWidth = renderedImage?.naturalWidth || image.naturalWidth || image.width;
  const naturalHeight = renderedImage?.naturalHeight || image.naturalHeight || image.height;
  const scaleX = naturalWidth / Math.max(1, renderWidth);
  const scaleY = naturalHeight / Math.max(1, renderHeight);

  const srcX = Math.max(0, Math.round(cropPixels.x * scaleX));
  const srcY = Math.max(0, Math.round(cropPixels.y * scaleY));
  const srcW = Math.max(1, Math.round(cropPixels.width * scaleX));
  const srcH = Math.max(1, Math.round(cropPixels.height * scaleY));

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось подготовить изображение");

  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return encodeCanvasToTargetSize(canvas, MAX_IMAGE_BYTES);
}

export function SalesForm({
  sale,
  compact,
  initialClient
}: {
  sale?: SaleRow;
  compact?: boolean;
  initialClient?: { clientName?: string; clientPhone?: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<SaleDraft>(emptyDraft());

  const [clientPhone, setClientPhone] = useState<string>(sale?.clientPhone ?? "");
  const [quantity, setQuantity] = useState<number>(sale?.quantity ?? 1);
  const [costPriceCnyInput, setCostPriceCnyInput] = useState<string>(sale?.costPriceCny ?? "");
  const [salePriceInput, setSalePriceInput] = useState<string>(sale?.salePrice ?? "");
  const [screenshotData, setScreenshotData] = useState<string>(sale?.screenshotData ?? "");
  const [screenshotChanged, setScreenshotChanged] = useState(false);
  const [status, setStatus] = useState<"DONE" | "TODO">(sale?.status === "DONE" ? "DONE" : "TODO");
  const [cropSource, setCropSource] = useState<string>("");
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    x: 10,
    y: 10,
    width: 80,
    height: 80
  });
  const [cropPixels, setCropPixels] = useState<PixelCrop | null>(null);
  const [cropPending, setCropPending] = useState(false);

  const costPriceCny = useMemo(() => parseFlexibleNumber(costPriceCnyInput), [costPriceCnyInput]);
  const salePrice = useMemo(() => parseFlexibleNumber(salePriceInput), [salePriceInput]);
  const costPriceKzt = useMemo(() => costPriceCny * CNY_TO_KZT, [costPriceCny]);
  const marginPerUnit = useMemo(() => salePrice - costPriceKzt, [salePrice, costPriceKzt]);
  const marginTotal = useMemo(() => marginPerUnit * quantity, [marginPerUnit, quantity]);
  const payoutTotal = useMemo(() => marginTotal * 0.95, [marginTotal]);

  const persistDraft = (patch: Partial<SaleDraft>) => {
    if (sale || typeof window === "undefined") return;
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(SALE_DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private mode/quota), do not break UI.
      }
      return next;
    });
  };

  const applyCroppedImage = async () => {
    if (!cropSource) return;
    setCropPending(true);
    try {
      const img = cropImageRef.current;
      const effectiveCrop =
        cropPixels && cropPixels.width > 0 && cropPixels.height > 0
          ? cropPixels
          : img
            ? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
            : null;
      if (!effectiveCrop) {
        setError("Не удалось определить область обрезки");
        return;
      }

      const nextImage = await getCroppedDataUrl(cropSource, effectiveCrop, cropImageRef.current);
      if (estimateDataUrlBytes(nextImage) > MAX_IMAGE_BYTES) {
        setError("Файл после обрезки всё ещё большой. Обрежьте сильнее.");
        return;
      }
      setScreenshotData(nextImage);
      setScreenshotChanged(true);
      persistDraft({ screenshotData: nextImage });
      setCropSource("");
      setError(null);
    } catch {
      setError("Не удалось обрезать изображение");
    } finally {
      setCropPending(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Можно загружать только изображения");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result) return;
      setCropSource(result);
      setCrop({
        unit: "%",
        x: 10,
        y: 10,
        width: 80,
        height: 80
      });
      setCropPixels(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCropImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    cropImageRef.current = event.currentTarget;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setScreenshotChanged(false);
          if (!sale) {
            const draftData = loadDraft();
            const withPrefill = {
              ...draftData,
              clientName: draftData.clientName || initialClient?.clientName || "",
              clientPhone: draftData.clientPhone || initialClient?.clientPhone || ""
            };
            setDraft(withPrefill);
            setClientPhone(withPrefill.clientPhone);
            setQuantity(Math.max(1, Number(withPrefill.quantity) || 1));
            setCostPriceCnyInput(withPrefill.costPriceCny);
            setSalePriceInput(withPrefill.salePrice);
            setScreenshotData(withPrefill.screenshotData);
            setStatus(withPrefill.status === "DONE" ? "DONE" : "TODO");
          }
          setOpen(true);
        }}
        className={
          compact
            ? "inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-card px-2 text-xs font-semibold text-text transition hover:border-accent"
            : "btn-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-glow transition"
        }
      >
        {sale ? <Pencil size={14} /> : <Plus size={16} />}
        {compact ? (sale ? "Изм" : "Добав") : sale ? "Изменить" : "Добавить"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg sm:h-auto sm:max-h-[94vh] sm:max-w-2xl sm:rounded-3xl">
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

                    if (!sale && typeof window !== "undefined") {
                      try {
                        window.localStorage.removeItem(SALE_DRAFT_KEY);
                      } catch {
                        // Ignore storage errors, data already submitted.
                      }
                      setDraft(emptyDraft());
                    }
                    setOpen(false);
                  });
                }}
                className="space-y-4"
              >
                <input
                  type="hidden"
                  name="screenshotData"
                  value={sale && !screenshotChanged && !screenshotData ? "__KEEP__" : screenshotData}
                />
                <input type="hidden" name="status" value={status} />

                <div>
                  <Label text="Дата заказа" />
                  <input
                    className={inputClass}
                    type="date"
                    name="orderDate"
                    defaultValue={sale ? toDateInputValue(sale.orderDate) : draft.orderDate}
                    onChange={(e) => persistDraft({ orderDate: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Дата оплаты" />
                    <input
                      className={inputClass}
                      type="date"
                      name="paymentDate"
                      defaultValue={sale ? toDateInputValue(sale.paymentDate) : draft.paymentDate}
                      onChange={(e) => persistDraft({ paymentDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label text="Куда оплатили" />
                    <input
                      className={inputClass}
                      placeholder="Kaspi / карта / supplier"
                      name="paidTo"
                      defaultValue={sale?.paidTo ?? draft.paidTo}
                      onChange={(e) => persistDraft({ paidTo: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label text="Имя клиента" />
                  <input
                    className={inputClass}
                    placeholder="Иван Иванов"
                    name="clientName"
                    defaultValue={sale?.clientName ?? draft.clientName}
                  onChange={(e) => persistDraft({ clientName: e.target.value })}
                />
                </div>

                <div>
                  <Label text="Телефон" />
                  <input
                    className={inputClass}
                    placeholder="+7 7771234567 или 87771234567"
                    name="clientPhone"
                    value={clientPhone}
                    onChange={(e) => {
                      setClientPhone(e.target.value);
                      persistDraft({ clientPhone: e.target.value });
                    }}
                  />
                </div>

                <div>
                  <Label text="Товар" />
                  <input
                    className={inputClass}
                    placeholder="Название товара"
                    name="productName"
                    defaultValue={sale?.productName ?? draft.productName}
                    onChange={(e) => persistDraft({ productName: e.target.value })}
                  />
                </div>

                <div>
                  <Label text="Трек код товара" />
                  <input
                    className={inputClass}
                    placeholder="TRK123456789"
                    name="productId"
                    defaultValue={sale?.productId ?? draft.productId}
                    onChange={(e) => persistDraft({ productId: e.target.value })}
                  />
                </div>

                <div>
                  <Label text="Ссылка на товар" />
                  <input
                    className={inputClass}
                    placeholder="https://..."
                    name="productLink"
                    defaultValue={sale?.productLink ?? draft.productLink}
                    onChange={(e) => persistDraft({ productLink: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Размер" />
                    <input
                      className={inputClass}
                      placeholder="M, L, 42..."
                      name="size"
                      defaultValue={sale?.size ?? draft.size}
                      onChange={(e) => persistDraft({ size: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label text="Количество" />
                    <input
                      className={inputClass}
                      placeholder="1"
                      name="quantity"
                      type="number"
                      min={1}
                      defaultValue={sale?.quantity ?? draft.quantity}
                      onChange={(e) => {
                        const nextQty = Math.max(1, Number(e.target.value || 1));
                        setQuantity(nextQty);
                        persistDraft({ quantity: String(nextQty) });
                      }}
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
                      onChange={(e) => {
                        setCostPriceCnyInput(e.target.value);
                        persistDraft({ costPriceCny: e.target.value });
                      }}
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
                      onChange={(e) => {
                        setSalePriceInput(e.target.value);
                        persistDraft({ salePrice: e.target.value });
                      }}
                    />
                    <p className="mt-1 text-xs text-muted">Это цена, которую платит клиент</p>
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
                    className="rounded-2xl border border-dashed border-line bg-card p-4 text-center"
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
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                  {screenshotData && (
                    <>
                      <div className="mt-2 overflow-hidden rounded-xl border border-line">
                        <img src={screenshotData} alt="Скрин товара" className="max-h-40 w-full object-contain bg-bg" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCropSource(screenshotData);
                          setCrop({
                            unit: "%",
                            x: 10,
                            y: 10,
                            width: 80,
                            height: 80
                          });
                        }}
                        className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text transition hover:border-accent"
                      >
                        <Pencil size={14} />
                        Редактировать скрин
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <Label text="Статус" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("DONE");
                        persistDraft({ status: "DONE" });
                      }}
                      className={`h-10 rounded-xl border text-sm transition ${status === "DONE" ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-line bg-card text-text hover:border-emerald-500/50"}`}
                    >
                      Выполнено
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("TODO");
                        persistDraft({ status: "TODO" });
                      }}
                      className={`h-10 rounded-xl border text-sm transition ${status === "TODO" ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-line bg-card text-text hover:border-rose-500/50"}`}
                    >
                      Доделать
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-card px-4 py-3">
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
                    className="h-11 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent"
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={pending}
                    className="btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:opacity-70"
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

      {cropSource && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Обрезка скрина</p>
              <button
                type="button"
                className="rounded-lg p-1 text-muted transition hover:bg-card hover:text-text"
                onClick={() => setCropSource("")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl bg-black p-2">
              <ReactCrop
                crop={crop}
                onChange={(nextCrop) => setCrop(nextCrop)}
                onComplete={(nextPixelCrop) => setCropPixels(nextPixelCrop)}
                ruleOfThirds
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cropSource}
                  alt="Обрезка"
                  onLoad={handleCropImageLoad}
                  className="max-h-[62vh] w-auto max-w-full object-contain"
                />
              </ReactCrop>
            </div>
            <p className="mt-3 text-xs text-muted">Потяните за углы/края рамки, чтобы обрезать как в обычном редакторе.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCropSource("")}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={applyCroppedImage}
                disabled={cropPending}
                className="btn-primary inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:opacity-70"
              >
                {cropPending && <Loader2 size={14} className="animate-spin" />}
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
