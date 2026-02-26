"use client";

import { type SyntheticEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ChevronDown, FileImage, Loader2, Pencil, Plus, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { createSaleAction, updateSaleAction } from "@/app/actions";
import { useModalHistory } from "@/lib/use-modal-history";

type SaleRow = {
  id: string;
  orderId?: string | null;
  orderStatus?: "DONE" | "TODO" | "WAITING";
  orderComment?: string | null;
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
  color?: string | null;
  quantity: number;
  costPriceCny: string;
  salePrice: string;
  status: "DONE" | "TODO";
};

type FormLineItem = {
  productName: string;
  productId: string;
  productLink: string;
  size: string;
  sizeCustom: boolean;
  quantity: string;
  costPriceCny: string;
  salePrice: string;
  screenshotData: string;
  receiptData: string;
};

type SaleDraft = {
  orderDate: string;
  paymentDate: string;
  paidTo: string;
  clientName: string;
  clientPhone: string;
  status: "DONE" | "TODO";
  lineItems: FormLineItem[];
};

type CropPixels = { x: number; y: number; width: number; height: number };
type CropTarget = { itemIndex: number; shotIndex: number | null; kind: "product" | "receipt" };

const CNY_TO_KZT = 80;
const MAX_IMAGE_BYTES = 1_100_000;
const SALE_DRAFT_KEY = "salestraking:new-sale-draft:v2";
const OWN_OPTION = "__custom__";
const PAID_TO_OPTIONS = ["Halyk", "Kaspi", "Kaspi Pay", "Kaspi Red", "Kaspi рассрочка", "Kaspi перевод", "BCC", "Freedom Bank", "Наличные"];
const SIZE_OPTIONS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "Стандарт"];

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

function Label({ text }: { text: string }) {
  return <p className="mb-1.5 text-sm font-semibold text-text">{text}</p>;
}

function money(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? -1 : 1;
  const abs = Math.abs(safe);
  const base = Math.floor(abs);
  const frac = abs - base;
  const rounded = frac > 0.5 ? base + 1 : base;
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sign * rounded)} ₸`;
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

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, srcW, srcH);
  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return encodeCanvasToTargetSize(canvas, MAX_IMAGE_BYTES);
}

function emptyLineItem(): FormLineItem {
  return {
    productName: "",
    productId: "",
    productLink: "",
    size: "",
    sizeCustom: false,
    quantity: "1",
    costPriceCny: "",
    salePrice: "",
    screenshotData: "",
    receiptData: ""
  };
}

function parseScreenshotList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("[")) return [trimmed];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [trimmed];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [trimmed];
  }
}

function serializeScreenshotList(list: string[]) {
  const normalized = list.map((item) => item.trim()).filter(Boolean);
  if (!normalized.length) return "";
  if (normalized.length === 1) return normalized[0];
  return JSON.stringify(normalized);
}

function parseTrackCodes(raw: string | null | undefined): string[] {
  if (!raw) return [""];
  const trimmed = raw.trim();
  if (!trimmed) return [""];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const asStrings = parsed.map((item) => (typeof item === "string" ? item.trim() : ""));
        return asStrings.length ? asStrings : [""];
      }
    } catch {
      // ignore and fallback to split
    }
  }
  const split = raw.split(/[\n,;]/g).map((item) => item.trim());
  return split.length ? split : [""];
}

function serializeTrackCodes(codes: string[]) {
  const normalized = codes.map((item) => item.trim());
  return normalized.join(", ");
}

function emptyDraft(): SaleDraft {
  return {
    orderDate: "",
    paymentDate: "",
    paidTo: "",
    clientName: "",
    clientPhone: "",
    status: "TODO",
    lineItems: [emptyLineItem()]
  };
}

function normalizeDraft(raw: Partial<SaleDraft>): SaleDraft {
  return {
    orderDate: raw.orderDate ?? "",
    paymentDate: raw.paymentDate ?? "",
    paidTo: raw.paidTo ?? "",
    clientName: raw.clientName ?? "",
    clientPhone: raw.clientPhone ?? "",
    status: raw.status === "DONE" ? "DONE" : "TODO",
    lineItems: Array.isArray(raw.lineItems) && raw.lineItems.length > 0 ? raw.lineItems.map((item) => ({ ...emptyLineItem(), ...item })) : [emptyLineItem()]
  };
}

function loadDraft(): SaleDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = window.localStorage.getItem(SALE_DRAFT_KEY);
    if (!raw) return emptyDraft();
    return normalizeDraft(JSON.parse(raw) as Partial<SaleDraft>);
  } catch {
    return emptyDraft();
  }
}

function ItemEditor({
  item,
  index,
  screenshots,
  expanded,
  removable,
  onToggle,
  onRemove,
  onChange,
  onSelectScreenshot,
  onEditScreenshot,
  onRemoveScreenshot,
  receipts,
  onSelectReceipt,
  onEditReceipt,
  onRemoveReceipt,
  onPreviewImage
}: {
  item: FormLineItem;
  index: number;
  screenshots: string[];
  expanded: boolean;
  removable: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<FormLineItem>) => void;
  onSelectScreenshot: (index: number) => void;
  onEditScreenshot: (index: number, shotIndex: number) => void;
  onRemoveScreenshot: (index: number, shotIndex: number) => void;
  receipts: string[];
  onSelectReceipt: (index: number) => void;
  onEditReceipt: (index: number, shotIndex: number) => void;
  onRemoveReceipt: (index: number, shotIndex: number) => void;
  onPreviewImage: (src: string, title: string) => void;
}) {
  const costKzt = parseFlexibleNumber(item.costPriceCny) * CNY_TO_KZT;
  const margin = (parseFlexibleNumber(item.salePrice) - costKzt) * 0.95;
  const trackCodes = parseTrackCodes(item.productId);

  return (
    <div className="rounded-2xl border border-line bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-text">Товар #{index + 1}</p>
          <p className="text-xs text-muted">{item.productName || "Без названия"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-success">{money(margin)}</span>
          <ChevronDown size={16} className={`text-muted transition ${expanded ? "rotate-180" : "rotate-0"}`} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label text="Название товара" />
              <input
                className={inputClass}
                placeholder="Название товара"
                value={item.productName}
                onChange={(e) => onChange({ productName: e.target.value })}
              />
            </div>
            <div>
              <Label text="Трек-код" />
              <div className="space-y-2">
                {trackCodes.map((code, idx) => (
                  <div key={`trk-${index}-${idx}`} className="flex items-center gap-2">
                    <input
                      className={inputClass}
                      placeholder={`TRK${idx + 1}`}
                      value={code}
                      onChange={(e) => {
                        const next = [...trackCodes];
                        next[idx] = e.target.value;
                        onChange({ productId: serializeTrackCodes(next) });
                      }}
                    />
                    {trackCodes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = trackCodes.filter((_, i) => i !== idx);
                          onChange({ productId: serializeTrackCodes(next) });
                        }}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/40 text-red-300 transition hover:bg-red-500/10"
                        title="Удалить трек-код"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onChange({ productId: serializeTrackCodes([...trackCodes, ""]) })}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs text-text transition hover:border-accent"
                >
                  <Plus size={12} />
                  Добавить трек-код
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label text="Ссылка" />
              <input
                className={inputClass}
                placeholder="https://..."
                value={item.productLink}
                onChange={(e) => onChange({ productLink: e.target.value })}
              />
            </div>
            <div>
              <Label text="Размер" />
              <select
                className={inputClass}
                value={item.sizeCustom ? OWN_OPTION : (item.size || "")}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === OWN_OPTION) {
                    onChange({ sizeCustom: true, size: item.sizeCustom ? item.size : "" });
                    return;
                  }
                  onChange({ sizeCustom: false, size: next });
                }}
              >
                <option value="">Не указан</option>
                {SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
                <option value={OWN_OPTION}>Свое</option>
              </select>
              {item.sizeCustom && (
                <input
                  className={inputClass + " mt-2"}
                  placeholder="Введите свой размер"
                  value={item.size}
                  onChange={(e) => onChange({ size: e.target.value, sizeCustom: true })}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <Label text="Количество" />
              <input
                className={inputClass}
                type="text"
                inputMode="numeric"
                value={item.quantity}
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/[^\d]/g, "");
                  onChange({ quantity: onlyDigits });
                }}
                onBlur={() => {
                  const normalized = String(Math.max(1, Math.floor(parseFlexibleNumber(item.quantity) || 1)));
                  if (normalized !== item.quantity) onChange({ quantity: normalized });
                }}
              />
            </div>
            <div>
              <Label text="Цена (¥)" />
              <input
                className={inputClass}
                placeholder="19.5"
                inputMode="decimal"
                value={item.costPriceCny}
                onChange={(e) => onChange({ costPriceCny: e.target.value })}
              />
            </div>
            <div>
              <Label text="Цена продажи" />
              <input
                className={inputClass}
                placeholder="0"
                inputMode="decimal"
                value={item.salePrice}
                onChange={(e) => onChange({ salePrice: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <Label text="Скрин товара" />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectScreenshot(index)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text transition hover:border-accent"
                >
                  <Upload size={14} />
                  Добавить скрин
                </button>
              </div>
              {screenshots.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {screenshots.map((shot, shotIndex) => (
                    <div key={`shot-${index}-${shotIndex}`} className="overflow-hidden rounded-xl border border-line bg-bg">
                      <button type="button" onClick={() => onPreviewImage(shot, `Скрин товара ${shotIndex + 1}`)} className="w-full">
                      <img src={shot} alt={`Скрин товара ${shotIndex + 1}`} className="h-28 w-full object-cover" />
                    </button>
                      <div className="grid grid-cols-2 gap-1 border-t border-line p-1.5">
                        <button
                          type="button"
                          onClick={() => onEditScreenshot(index, shotIndex)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-line text-xs text-text transition hover:border-accent"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveScreenshot(index, shotIndex)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-red-500/40 text-xs text-red-300 transition hover:bg-red-500/10"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label text="Скрин чека" />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectReceipt(index)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text transition hover:border-accent"
                >
                  <FileImage size={14} />
                  Добавить чек
                </button>
                {removable && (
                  <button
                    type="button"
                    onClick={onRemove}
                    className="inline-flex h-9 items-center rounded-xl border border-red-500/40 px-3 text-sm text-red-300 transition hover:bg-red-500/10"
                  >
                    Удалить товар
                  </button>
                )}
              </div>
              {receipts.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {receipts.map((shot, shotIndex) => (
                    <div key={`receipt-${index}-${shotIndex}`} className="overflow-hidden rounded-xl border border-line bg-bg">
                      <button type="button" onClick={() => onPreviewImage(shot, `Скрин чека ${shotIndex + 1}`)} className="w-full">
                      <img src={shot} alt={`Скрин чека ${shotIndex + 1}`} className="h-28 w-full object-cover" />
                    </button>
                      <div className="grid grid-cols-2 gap-1 border-t border-line p-1.5">
                        <button
                          type="button"
                          onClick={() => onEditReceipt(index, shotIndex)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-line text-xs text-text transition hover:border-accent"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveReceipt(index, shotIndex)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-red-500/40 text-xs text-red-300 transition hover:bg-red-500/10"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SalesForm({
  sale,
  compact,
  compactVariant = "default",
  iconOnly,
  iconOnlySmall,
  initialClient,
  onAfterClose
}: {
  sale?: SaleRow;
  compact?: boolean;
  compactVariant?: "default" | "plus";
  iconOnly?: boolean;
  iconOnlySmall?: boolean;
  initialClient?: { clientName?: string; clientPhone?: string };
  onAfterClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const productFileInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(null);
  const [uploadTargetKind, setUploadTargetKind] = useState<"product" | "receipt">("product");

  const [orderDate, setOrderDate] = useState<string>(sale ? toDateInputValue(sale.orderDate) : "");
  const [paymentDate, setPaymentDate] = useState<string>(sale ? toDateInputValue(sale.paymentDate) : "");
  const [paidTo, setPaidTo] = useState<string>(sale?.paidTo ?? "");
  const [paidToCustom, setPaidToCustom] = useState<boolean>(Boolean(sale?.paidTo && !PAID_TO_OPTIONS.includes(sale.paidTo)));
  const [clientName, setClientName] = useState<string>(sale?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState<string>(sale?.clientPhone ?? "");

  const [lineItems, setLineItems] = useState<FormLineItem[]>(
    sale
      ? [
          {
            productName: sale.productName ?? "",
            productId: sale.productId ?? "",
            productLink: sale.productLink ?? "",
            size: sale.size ?? "",
            sizeCustom: sale.size ? !SIZE_OPTIONS.includes(sale.size) : false,
            quantity: String(sale.quantity || 1),
            costPriceCny: sale.costPriceCny ?? "",
            salePrice: sale.salePrice ?? "",
            screenshotData: sale.screenshotData ?? "",
            receiptData: sale.receiptData ?? ""
          }
        ]
      : [emptyLineItem()]
  );

  const [status, setStatus] = useState<"DONE" | "TODO">(sale?.status === "DONE" ? "DONE" : "TODO");
  const [expandedItems, setExpandedItems] = useState<number[]>([0]);

  const [cropSource, setCropSource] = useState<string>("");
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
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
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

  const totals = useMemo(() => {
    const costKzt = lineItems.reduce((sum, item) => {
      const itemCostKzt = parseFlexibleNumber(item.costPriceCny) * CNY_TO_KZT;
      return sum + itemCostKzt;
    }, 0);

    const saleKzt = lineItems.reduce((sum, item) => {
      const itemSale = parseFlexibleNumber(item.salePrice);
      return sum + itemSale;
    }, 0);

    return {
      costKzt,
      marginWithFee: (saleKzt - costKzt) * 0.95
    };
  }, [lineItems]);

  const persistDraft = (patch: Partial<SaleDraft>) => {
    if (sale || typeof window === "undefined") return;
    const current = loadDraft();
    const next = normalizeDraft({ ...current, ...patch });
    try {
      window.localStorage.setItem(SALE_DRAFT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const setLineItemPatch = (index: number, patch: Partial<FormLineItem>) => {
    setLineItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, ...patch } : item));
      persistDraft({ lineItems: next });
      return next;
    });
  };

  const handleFile = (file: File, index: number, kind: "product" | "receipt") => {
    if (!file.type.startsWith("image/")) {
      setError("Можно загружать только изображения");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result) return;
      setCropSource(result);
      setCropTarget({ itemIndex: index, shotIndex: null, kind });
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

  const applyCroppedImage = async () => {
    if (!cropSource || !cropTarget) return;
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

      setLineItems((prev) => {
        const next = prev.map((item, i) => {
          if (i !== cropTarget.itemIndex) return item;
          const fieldName = cropTarget.kind === "receipt" ? "receiptData" : "screenshotData";
          const list = parseScreenshotList(item[fieldName]);
          if (cropTarget.shotIndex === null) {
            list.push(nextImage);
          } else if (cropTarget.shotIndex >= 0 && cropTarget.shotIndex < list.length) {
            list[cropTarget.shotIndex] = nextImage;
          } else {
            list.push(nextImage);
          }
          return { ...item, [fieldName]: serializeScreenshotList(list) };
        });
        persistDraft({ lineItems: next });
        return next;
      });
      closeCropModal();
      setError(null);
    } catch {
      setError("Не удалось обрезать изображение");
    } finally {
      setCropPending(false);
    }
  };

  const handleOpen = () => {
    setError(null);
    if (!sale) {
      const draft = loadDraft();
      const merged = normalizeDraft({
        ...draft,
        clientName: draft.clientName || initialClient?.clientName || "",
        clientPhone: draft.clientPhone || initialClient?.clientPhone || ""
      });
      setOrderDate(merged.orderDate);
      setPaymentDate(merged.paymentDate);
      setPaidTo(merged.paidTo);
      setPaidToCustom(Boolean(merged.paidTo && !PAID_TO_OPTIONS.includes(merged.paidTo)));
      setClientName(merged.clientName);
      setClientPhone(merged.clientPhone);
      setStatus(merged.status);
      setLineItems(merged.lineItems);
      setExpandedItems([0]);
    }
    setOpen(true);
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      let result: { ok: boolean; error?: string };

      if (sale) {
        const first = lineItems[0] ?? emptyLineItem();
        formData.set("id", sale.id);
        formData.set("productName", first.productName);
        formData.set("productId", first.productId);
        formData.set("productLink", first.productLink);
        formData.set("size", first.size);
        formData.set("quantity", first.quantity);
        formData.set("costPriceCny", first.costPriceCny);
        formData.set("salePrice", first.salePrice);
        formData.set("screenshotData", first.screenshotData || "");
        formData.set("receiptData", first.receiptData || "");
        result = await updateSaleAction(formData);
      } else {
        const normalizedItems = lineItems.map((item) => ({
          productName: item.productName,
          productId: item.productId,
          productLink: item.productLink,
          size: item.size,
          quantity: item.quantity,
          costPriceCny: item.costPriceCny,
          salePrice: item.salePrice,
          screenshotData: item.screenshotData,
          receiptData: item.receiptData
        }));
        formData.set("lineItems", JSON.stringify(normalizedItems));
        formData.set("screenshotData", "");
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
          // ignore
        }
      }

      closeFormModal();
    });
  };

  const handleCropImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    cropImageRef.current = event.currentTarget;
  };

  const addItem = () => {
    const next = [...lineItems, emptyLineItem()];
    setLineItems(next);
    setExpandedItems((prev) => [...prev, next.length - 1]);
    persistDraft({ lineItems: next });
  };

  const removeItem = (index: number) => {
    if (lineItems.length <= 1) return;
    const next = lineItems.filter((_, i) => i !== index);
    setLineItems(next);
    setExpandedItems([0]);
    persistDraft({ lineItems: next });
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const closeFormModal = useModalHistory(open && mounted, () => {
    setOpen(false);
    onAfterClose?.();
  });
  const closeCropModal = useModalHistory(Boolean(cropSource && mounted), () => {
    setCropSource("");
    setCropTarget(null);
  });
  const closePreviewModal = useModalHistory(Boolean(previewImage && mounted), () => setPreviewImage(null));

  const applyDateValue = (nextValue: string, key: "orderDate" | "paymentDate") => {
    if (key === "orderDate") setOrderDate(nextValue);
    if (key === "paymentDate") setPaymentDate(nextValue);
    persistDraft({ [key]: nextValue });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          compact
            ? "inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-line bg-card px-3 text-xs font-semibold text-text transition hover:border-accent"
            : iconOnly
              ? iconOnlySmall
                ? "btn-primary inline-flex h-11 w-11 items-center justify-center rounded-full shadow-glow transition"
                : "btn-primary inline-flex h-14 w-14 items-center justify-center rounded-full shadow-glow transition"
              : "btn-primary inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-glow transition"
        }
      >
        {sale ? <Pencil size={14} /> : <Plus size={iconOnlySmall ? 15 : 16} />}
        {compact
          ? sale
            ? "Изменить"
            : compactVariant === "plus"
              ? ""
              : "Добав"
          : iconOnly
            ? ""
          : sale
            ? "Изменить"
            : "Добавить"}
      </button>

      {open && mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
            <div className="h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg sm:h-auto sm:max-h-[94vh] sm:max-w-3xl sm:rounded-3xl">
              <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-text">{sale ? "Редактирование" : "Новая продажа"}</h2>
                  <p className="mt-1 text-sm text-muted">Клиент и несколько товаров в одном добавлении</p>
                </div>
                <button
                  onClick={closeFormModal}
                  className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text"
                  type="button"
                  aria-label="Закрыть"
                >
                  <X size={22} />
                </button>
              </div>

              {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}

              <form action={handleSubmit} className="space-y-4">
                <input type="hidden" name="status" value={status} />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Дата заказа" />
                    <input
                      className={inputClass}
                      type="date"
                      name="orderDate"
                      value={orderDate}
                      onInput={(e) => applyDateValue(e.currentTarget.value, "orderDate")}
                      onChange={(e) => applyDateValue(e.target.value, "orderDate")}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                    />
                  </div>
                  <div>
                    <Label text="Дата оплаты" />
                    <input
                      className={inputClass}
                      type="date"
                      name="paymentDate"
                      value={paymentDate}
                      onInput={(e) => applyDateValue(e.currentTarget.value, "paymentDate")}
                      onChange={(e) => applyDateValue(e.target.value, "paymentDate")}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                    />
                  </div>
                </div>

                <div>
                  <Label text="Куда оплатили" />
                  <input type="hidden" name="paidTo" value={paidTo} />
                  <select
                    className={inputClass}
                    value={paidToCustom ? OWN_OPTION : (paidTo || "")}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === OWN_OPTION) {
                        setPaidToCustom(true);
                        if (!paidTo || PAID_TO_OPTIONS.includes(paidTo)) {
                          setPaidTo("");
                          persistDraft({ paidTo: "" });
                        }
                        return;
                      }
                      setPaidToCustom(false);
                      setPaidTo(next);
                      persistDraft({ paidTo: next });
                    }}
                  >
                    <option value="">Не указано</option>
                    {PAID_TO_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value={OWN_OPTION}>Свое</option>
                  </select>
                  {paidToCustom && (
                    <input
                      className={inputClass + " mt-2"}
                      placeholder="Введите свой способ оплаты"
                      value={paidTo}
                      onChange={(e) => {
                        setPaidTo(e.target.value);
                        persistDraft({ paidTo: e.target.value });
                      }}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label text="Имя клиента" />
                    <input
                      className={inputClass}
                      name="clientName"
                      placeholder="Иван Иванов"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        persistDraft({ clientName: e.target.value });
                      }}
                    />
                  </div>
                  <div>
                    <Label text="Телефон" />
                    <input
                      className={inputClass}
                      name="clientPhone"
                      placeholder="+7 7771234567"
                      value={clientPhone}
                      onChange={(e) => {
                        setClientPhone(e.target.value);
                        persistDraft({ clientPhone: e.target.value });
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-bg p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Label text="Товары клиента" />
                    {!sale && (
                      <button
                        type="button"
                        onClick={addItem}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text transition hover:border-accent"
                      >
                        <Plus size={14} />
                        Добавить товар
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <ItemEditor
                        key={`item-${index}`}
                        item={item}
                        index={index}
                        screenshots={parseScreenshotList(item.screenshotData)}
                        receipts={parseScreenshotList(item.receiptData)}
                        expanded={expandedItems.includes(index)}
                        removable={!sale && lineItems.length > 1}
                        onToggle={() => {
                          setExpandedItems((prev) =>
                            prev.includes(index) ? prev.filter((itemIndex) => itemIndex !== index) : [...prev, index]
                          );
                        }}
                        onRemove={() => removeItem(index)}
                        onChange={(patch) => setLineItemPatch(index, patch)}
                        onSelectScreenshot={(targetIndex) => {
                          setUploadTargetIndex(targetIndex);
                          setUploadTargetKind("product");
                          productFileInputRef.current?.click();
                        }}
                        onEditScreenshot={(targetIndex, shotIndex) => {
                          const src = parseScreenshotList(lineItems[targetIndex]?.screenshotData)[shotIndex];
                          if (!src) return;
                          setCropSource(src);
                          setCropTarget({ itemIndex: targetIndex, shotIndex, kind: "product" });
                          setCrop({ unit: "%", x: 10, y: 10, width: 80, height: 80 });
                          setCropPixels(null);
                        }}
                        onRemoveScreenshot={(targetIndex, shotIndex) => {
                          setLineItems((prev) => {
                            const next = prev.map((line, i) => {
                              if (i !== targetIndex) return line;
                              const list = parseScreenshotList(line.screenshotData);
                              const filtered = list.filter((_, idx) => idx !== shotIndex);
                              return { ...line, screenshotData: serializeScreenshotList(filtered) };
                            });
                            persistDraft({ lineItems: next });
                            return next;
                          });
                        }}
                        onSelectReceipt={(targetIndex) => {
                          setUploadTargetIndex(targetIndex);
                          setUploadTargetKind("receipt");
                          receiptFileInputRef.current?.click();
                        }}
                        onEditReceipt={(targetIndex, shotIndex) => {
                          const src = parseScreenshotList(lineItems[targetIndex]?.receiptData)[shotIndex];
                          if (!src) return;
                          setCropSource(src);
                          setCropTarget({ itemIndex: targetIndex, shotIndex, kind: "receipt" });
                          setCrop({ unit: "%", x: 10, y: 10, width: 80, height: 80 });
                          setCropPixels(null);
                        }}
                        onRemoveReceipt={(targetIndex, shotIndex) => {
                          setLineItems((prev) => {
                            const next = prev.map((line, i) => {
                              if (i !== targetIndex) return line;
                              const list = parseScreenshotList(line.receiptData);
                              const filtered = list.filter((_, idx) => idx !== shotIndex);
                              return { ...line, receiptData: serializeScreenshotList(filtered) };
                            });
                            persistDraft({ lineItems: next });
                            return next;
                          });
                        }}
                        onPreviewImage={(src, title) => setPreviewImage({ src, title })}
                      />
                    ))}
                  </div>

                  <input
                    ref={productFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && uploadTargetIndex !== null) {
                        handleFile(file, uploadTargetIndex, uploadTargetKind);
                      }
                      e.currentTarget.value = "";
                    }}
                  />

                  <input
                    ref={receiptFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && uploadTargetIndex !== null) {
                        handleFile(file, uploadTargetIndex, "receipt");
                      }
                      e.currentTarget.value = "";
                    }}
                  />
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
                    <span>Сумма товара (₸)</span>
                    <span className="font-semibold text-text">{money(totals.costKzt)}</span>
                  </div>
                  <div className="my-2 h-px bg-line" />
                  <div className="flex items-center justify-between text-base text-text">
                    <span className="font-semibold">Маржа</span>
                    <span className="font-bold text-success">{money(totals.marginWithFee)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={closeFormModal}
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
        , document.body)}


      {previewImage && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[130] grid place-items-center bg-black/90 p-2 sm:p-4">
            <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-bg p-2 sm:p-3">
              <button
                type="button"
                onClick={closePreviewModal}
                className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-text"
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
              <img src={previewImage.src} alt={previewImage.title} className="mx-auto max-h-[84dvh] w-auto max-w-full object-contain" />
            </div>
          </div>
        , document.body)}

      {cropSource && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/90 p-2 sm:grid sm:place-items-center sm:p-4">
            <div className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-bg p-3 sm:h-auto sm:max-h-[94vh] sm:rounded-3xl sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Обрезка изображения</p>
              <button
                type="button"
                className="rounded-lg p-1 text-muted transition hover:bg-card hover:text-text"
                onClick={() => {
                  closeCropModal();
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-black p-2">
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
                  className="mx-auto max-h-[68vh] w-auto max-w-full object-contain sm:max-h-[72vh]"
                />
              </ReactCrop>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  closeCropModal();
                }}
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
        , document.body)}
    </>
  );
}
