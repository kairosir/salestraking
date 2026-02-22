"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  clearTrashAction,
  markSaleDoneAction,
  moveSaleToTrashAction,
  restoreArchivedSalesAction,
  restoreSalesFromTrashAction
} from "@/app/actions";
import { SalesForm } from "@/components/sales-form";

type Sale = {
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
  hasScreenshot?: boolean;
  trackingNumber: string | null;
  trackingProvider: string | null;
  trackingStatus: string | null;
  trackingSubstatus: string | null;
  trackingLastEvent: string | null;
  trackingSyncedAt: string | null;
  size: string | null;
  quantity: number;
  costPriceCny: string;
  costPrice: string;
  salePrice: string;
  margin: string;
  status: "DONE" | "TODO" | "WAITING";
  isIssued: boolean;
  createdAt: string;
  createdByName: string;
  updatedByName: string;
};

type SortMode = "newest" | "oldest" | "marginDesc" | "revenueDesc";
type MobileView = "cards" | "list";

type ArchiveGroup = {
  key: string;
  clientName: string;
  clientPhone: string;
  sales: Sale[];
};

type ActiveGroup = {
  key: string;
  clientName: string;
  clientPhone: string;
  sales: Sale[];
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

function dateFmt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return "-";
  }
}

function onlyDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  } catch {
    return "-";
  }
}

function waLink(phone: string) {
  const digitsRaw = phone.replace(/\D/g, "");
  if (!digitsRaw) return null;
  let normalized = digitsRaw;
  if (normalized.length === 10) normalized = `7${normalized}`;
  if (normalized.startsWith("8") && normalized.length === 11) normalized = `7${normalized.slice(1)}`;
  if (normalized.length < 11) return null;
  return `https://wa.me/${normalized}`;
}

function statusLabel(status: Sale["status"]) {
  return status === "DONE" ? "Выполнено" : "Доделать";
}

function statusColor(status: Sale["status"]) {
  return status === "DONE" ? "bg-emerald-500" : "bg-rose-500 status-blink";
}

function safeTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function archiveGroupKey(sale: Pick<Sale, "clientName" | "clientPhone" | "id">) {
  const phone = normalizePhone(sale.clientPhone);
  if (phone) return `p:${phone}`;
  const name = normalizeName(sale.clientName);
  if (name) return `n:${name}`;
  return `u:${sale.id}`;
}

const CLIENT_DOT_COLORS = [
  "bg-rose-400",
  "bg-orange-400",
  "bg-amber-400",
  "bg-lime-400",
  "bg-emerald-400",
  "bg-teal-400",
  "bg-cyan-400",
  "bg-sky-400",
  "bg-blue-400",
  "bg-indigo-400",
  "bg-violet-400",
  "bg-fuchsia-400"
] as const;

function clientDotColor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CLIENT_DOT_COLORS[hash % CLIENT_DOT_COLORS.length];
}

export function SalesTable({ sales }: { sales: Sale[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [mobileView, setMobileView] = useState<MobileView>("cards");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [trashTargetSale, setTrashTargetSale] = useState<Sale | null>(null);
  const [screenshotCache, setScreenshotCache] = useState<Record<string, string>>({});
  const [screenshotLoadingId, setScreenshotLoadingId] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<Record<string, string>>({});

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [expandedActiveGroups, setExpandedActiveGroups] = useState<Record<string, boolean>>({});
  const [expandedArchiveGroups, setExpandedArchiveGroups] = useState<Record<string, boolean>>({});
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Record<string, boolean>>({});
  const [selectedTrashIds, setSelectedTrashIds] = useState<Record<string, boolean>>({});

  const [pendingAction, startPendingAction] = useTransition();
  const [markingDone, startMarkingDone] = useTransition();

  const confirmMoveSaleToTrash = () => {
    if (!trashTargetSale) return;
    const target = trashTargetSale;
    startPendingAction(async () => {
      const fd = new FormData();
      fd.set("id", target.id);
      const result = await moveSaleToTrashAction(fd);
      if (result.ok) {
        if (selectedSale?.id === target.id) setSelectedSale(null);
        setTrashTargetSale(null);
        router.refresh();
      }
    });
  };

  const loadScreenshot = async (saleId: string) => {
    setScreenshotLoadingId(saleId);
    setScreenshotError((prev) => {
      const next = { ...prev };
      delete next[saleId];
      return next;
    });

    try {
      const res = await fetch(`/api/sales/${saleId}/screenshot`, { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        setScreenshotError((prev) => ({ ...prev, [saleId]: `Ошибка загрузки (${res.status})` }));
        return;
      }
      const json = (await res.json()) as { screenshotData?: string | null };
      if (json.screenshotData) {
        setScreenshotCache((prev) => ({ ...prev, [saleId]: json.screenshotData as string }));
      } else {
        setScreenshotError((prev) => ({ ...prev, [saleId]: "Скрин не найден" }));
      }
    } catch {
      setScreenshotError((prev) => ({ ...prev, [saleId]: "Не удалось загрузить скрин" }));
    } finally {
      setScreenshotLoadingId((prev) => (prev === saleId ? null : prev));
    }
  };

  const openSaleDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    if (!sale.hasScreenshot || screenshotCache[sale.id]) return;
    await loadScreenshot(sale.id);
  };

  const authors = useMemo(() => {
    const unique = Array.from(new Set(sales.map((s) => s.createdByName))).sort((a, b) => a.localeCompare(b, "ru"));
    return unique;
  }, [sales]);

  const activeSales = useMemo(() => sales.filter((sale) => sale.status !== "WAITING" && !sale.isIssued), [sales]);
  const archiveSales = useMemo(() => sales.filter((sale) => sale.isIssued), [sales]);
  const trashSales = useMemo(() => sales.filter((sale) => sale.status === "WAITING"), [sales]);

  const filteredActiveSales = useMemo(() => {
    const q = query.trim().toLowerCase();

    const byQuery = activeSales.filter((item) => {
      if (!q) return true;
      return [
        item.clientName,
        item.clientPhone,
        item.productName,
        item.productId ?? "",
        item.size ?? "",
        item.createdByName,
        item.updatedByName
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const byAuthor = byQuery.filter((item) => (author === "all" ? true : item.createdByName === author));

    return [...byAuthor].sort((a, b) => {
      if (sort === "newest") return safeTime(b.createdAt) - safeTime(a.createdAt);
      if (sort === "oldest") return safeTime(a.createdAt) - safeTime(b.createdAt);
      if (sort === "marginDesc") return Number(b.margin) - Number(a.margin);
      return Number(b.salePrice) * b.quantity - Number(a.salePrice) * a.quantity;
    });
  }, [query, activeSales, author, sort]);

  const activeGroups = useMemo(() => {
    const map = new Map<string, ActiveGroup>();
    for (const sale of filteredActiveSales) {
      const key = archiveGroupKey(sale);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          clientName: sale.clientName || "Без имени",
          clientPhone: sale.clientPhone || "-",
          sales: [sale]
        });
        continue;
      }
      existing.sales.push(sale);
      if ((!existing.clientPhone || existing.clientPhone === "-") && sale.clientPhone) existing.clientPhone = sale.clientPhone;
    }

    const groups = Array.from(map.values());
    groups.sort((a, b) => safeTime(b.sales[0]?.createdAt ?? "") - safeTime(a.sales[0]?.createdAt ?? ""));
    return groups;
  }, [filteredActiveSales]);

  const archiveGroups = useMemo(() => {
    const map = new Map<string, ArchiveGroup>();
    for (const sale of archiveSales) {
      const key = archiveGroupKey(sale);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          clientName: sale.clientName || "Без имени",
          clientPhone: sale.clientPhone || "-",
          sales: [sale]
        });
        continue;
      }
      existing.sales.push(sale);
      if ((!existing.clientPhone || existing.clientPhone === "-") && sale.clientPhone) existing.clientPhone = sale.clientPhone;
    }

    const groups = Array.from(map.values());
    for (const group of groups) {
      group.sales.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));
    }
    groups.sort((a, b) => safeTime(b.sales[0]?.createdAt ?? "") - safeTime(a.sales[0]?.createdAt ?? ""));
    return groups;
  }, [archiveSales]);

  const selectedArchive = useMemo(
    () => archiveSales.filter((sale) => selectedArchiveIds[sale.id]),
    [archiveSales, selectedArchiveIds]
  );
  const selectedTrash = useMemo(
    () => trashSales.filter((sale) => selectedTrashIds[sale.id]),
    [trashSales, selectedTrashIds]
  );

  const archiveIdsCsv = selectedArchive.map((s) => s.id).join(",");
  const trashIdsCsv = selectedTrash.map((s) => s.id).join(",");

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
      <div className="rounded-2xl border border-line bg-card/60 bg-panel p-3 sm:p-4">
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по клиенту, товару, трек-коду, автору..."
            className="h-11 w-full rounded-2xl border border-line bg-card pl-9 pr-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="h-10 rounded-xl border border-line bg-card px-3 text-sm outline-none transition focus:border-accent"
          >
            <option value="all">Все авторы</option>
            {authors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-10 rounded-xl border border-line bg-card px-3 text-sm outline-none transition focus:border-accent"
          >
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="marginDesc">По марже (убыв.)</option>
            <option value="revenueDesc">По выручке (убыв.)</option>
          </select>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">Записей: {filteredActiveSales.length}</p>
            <div className="inline-flex rounded-xl border border-line bg-card p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileView("cards")}
                className={`rounded-lg px-2 py-1 text-xs ${mobileView === "cards" ? "btn-primary" : "text-muted"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className={`rounded-lg px-2 py-1 text-xs ${mobileView === "list" ? "btn-primary" : "text-muted"}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden rounded-3xl border border-line bg-card/70 bg-panel lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1220px]">
            <div className="grid grid-cols-[0.2fr_1fr_0.95fr_1.25fr_0.6fr_0.5fr_0.75fr_0.75fr_0.75fr_0.75fr_1fr_0.95fr] gap-2 border-b border-line px-3 py-2 text-[11px] uppercase tracking-wide text-muted">
              <span>Статус</span>
              <span>Клиент</span>
              <span>Телефон</span>
              <span>Товар</span>
              <span>Размер</span>
              <span>Кол-во</span>
              <span>Цена товара</span>
              <span>Цена продажи</span>
              <span>Маржа</span>
              <span>Выручка</span>
              <span>Автор/дата</span>
              <span className="text-right">Действия</span>
            </div>

            <div className="divide-y divide-line">
              {activeGroups.map((group) => {
                const isExpanded = expandedActiveGroups[group.key] ?? false;
                const wa = waLink(group.clientPhone);
                return (
                  <div key={group.key}>
                    <div className="grid items-center gap-2 px-3 py-2 lg:grid-cols-[0.2fr_1fr_0.95fr_1.25fr_0.6fr_0.5fr_0.75fr_0.75fr_0.75fr_0.75fr_1fr_0.95fr]">
                      <button
                        type="button"
                        onClick={() => setExpandedActiveGroups((prev) => ({ ...prev, [group.key]: !isExpanded }))}
                        className="inline-flex items-center justify-center rounded-lg border border-line bg-card p-1 text-muted transition hover:border-accent"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-text">
                        <span className={`h-2.5 w-2.5 rounded-full ${clientDotColor(group.key)}`} />
                        {group.clientName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-text">{group.clientPhone || "-"}</p>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
                          >
                            <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 lg:col-span-9">
                        <p className="text-xs text-muted">{group.sales.length} товар(ов)</p>
                        <div onClick={(event) => event.stopPropagation()}>
                          <SalesForm
                            compact
                            compactVariant="plus"
                            initialClient={{
                              clientName: group.clientName,
                              clientPhone: group.clientPhone === "-" ? "" : group.clientPhone
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-1 pb-1">
                        {group.sales.map((sale) => {
                          const revenue = Number(sale.salePrice) * sale.quantity;
                          return (
                            <div
                              key={sale.id}
                              className="grid cursor-pointer items-center gap-2 px-3 py-2 lg:grid-cols-[0.2fr_1fr_0.95fr_1.25fr_0.6fr_0.5fr_0.75fr_0.75fr_0.75fr_0.75fr_1fr_0.95fr]"
                              onClick={() => openSaleDetails(sale)}
                            >
                              <div className="flex items-center gap-1">
                                <span className={`h-7 w-1.5 rounded-full ${statusColor(sale.status)}`} />
                              </div>
                              <p className="break-words text-sm font-medium leading-4 text-text">{sale.clientName}</p>
                              <p className="break-all text-xs leading-4 text-text">{sale.clientPhone}</p>
                              <div className="min-w-0">
                                <p className="break-words text-xs leading-4 text-text">{sale.productName}</p>
                                {sale.productId && <p className="break-all text-[11px] text-muted">Трек: {sale.productId}</p>}
                              </div>
                              <p className="text-xs text-text">{sale.size || "-"}</p>
                              <p className="text-xs text-text">{sale.quantity}</p>
                              <p className="text-xs text-text">{money(sale.costPrice)}</p>
                              <p className="text-xs text-text">{money(sale.salePrice)}</p>
                              <p className="text-xs font-semibold text-success">{money(sale.margin)}</p>
                              <p className="text-xs text-text">{money(revenue)}</p>
                              <p className="break-words text-[11px] leading-4 text-muted">
                                {sale.createdByName} · {dateFmt(sale.createdAt)}
                                <br />
                                изм. {sale.updatedByName}
                                <br />
                                {statusLabel(sale.status)}
                              </p>

                              <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
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
                                    size: sale.size,
                                    quantity: sale.quantity,
                                    costPriceCny: sale.costPriceCny,
                                    salePrice: sale.salePrice,
                                    status: sale.status === "DONE" ? "DONE" : "TODO"
                                  }}
                                />

                                <button
                                  type="button"
                                  onClick={() => setTrashTargetSale(sale)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-red-400 hover:text-red-300"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={`space-y-3 lg:hidden ${mobileView === "cards" ? "block" : "hidden"}`}>
        {activeGroups.map((group) => {
          const isExpanded = expandedActiveGroups[group.key] ?? false;
          const whatsapp = waLink(group.clientPhone);
          return (
            <article key={group.key} className="rounded-2xl border border-line bg-card/70 bg-panel p-3">
              <button
                type="button"
                onClick={() => setExpandedActiveGroups((prev) => ({ ...prev, [group.key]: !isExpanded }))}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <p className="inline-flex items-center gap-2 text-base font-semibold text-text">
                    <span className={`h-2.5 w-2.5 rounded-full ${clientDotColor(group.key)}`} />
                    {group.clientName}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted">{group.clientPhone}</p>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MessageCircle size={12} />
                      </a>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
              </button>
              <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                <SalesForm
                  compact
                  compactVariant="plus"
                  initialClient={{
                    clientName: group.clientName,
                    clientPhone: group.clientPhone === "-" ? "" : group.clientPhone
                  }}
                />
              </div>
              {isExpanded && (
                <div className="mt-2 space-y-2 border-t border-line pt-2">
                  {group.sales.map((sale) => {
                    const revenue = Number(sale.salePrice) * sale.quantity;
                    return (
                      <div key={sale.id} className="rounded-xl border border-line bg-card p-2" onClick={() => openSaleDetails(sale)}>
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-6 w-1.5 shrink-0 rounded-full ${statusColor(sale.status)}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text">{sale.productName}</p>
                            <p className="text-xs text-muted">{dateFmt(sale.createdAt)}</p>
                          </div>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                          <p className="text-muted">Маржа: <span className="text-success">{money(sale.margin)}</span></p>
                          <p className="text-muted">Выручка: <span className="text-text">{money(revenue)}</span></p>
                        </div>
                        <div className="mt-2 flex justify-end" onClick={(event) => event.stopPropagation()}>
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
                              size: sale.size,
                              quantity: sale.quantity,
                              costPriceCny: sale.costPriceCny,
                              salePrice: sale.salePrice,
                              status: sale.status === "DONE" ? "DONE" : "TODO"
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-text">Карточка товара</h3>
                <p className="text-sm text-muted">Полная информация</p>
              </div>
              <button type="button" onClick={() => setSelectedSale(null)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Трек код товара" value={selectedSale.productId || "-"} />
              <Info label="Трек статус" value={selectedSale.trackingStatus || "-"} />
              <Info label="Товар" value={selectedSale.productName} />
              <Info label="Клиент" value={selectedSale.clientName} />
              <div className="rounded-xl border border-line bg-card p-3">
                <p className="text-xs text-muted">Телефон</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm text-text">{selectedSale.clientPhone}</p>
                  {waLink(selectedSale.clientPhone) && (
                    <a
                      href={waLink(selectedSale.clientPhone) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
                    >
                      <MessageCircle size={14} />
                    </a>
                  )}
                </div>
              </div>
              <Info label="Дата заказа" value={onlyDate(selectedSale.orderDate)} />
              <Info label="Дата оплаты" value={onlyDate(selectedSale.paymentDate)} />
              <Info label="Куда оплатили" value={selectedSale.paidTo || "-"} />
              <Info label="Размер" value={selectedSale.size || "-"} />
              <Info label="Количество" value={String(selectedSale.quantity)} />
              <Info label="Цена товара (¥)" value={selectedSale.costPriceCny} />
              <Info label="Цена товара (₸)" value={money(selectedSale.costPrice)} />
              <Info label="Цена продажи (₸)" value={money(selectedSale.salePrice)} />
              <Info label="Маржа (₸)" value={money(selectedSale.margin)} />
              <Info label="Выручка (₸)" value={money(Number(selectedSale.salePrice) * selectedSale.quantity)} />
              <Info label="Статус" value={statusLabel(selectedSale.status)} />
              <Info label="Создал" value={selectedSale.createdByName} />
              <Info label="Изменил" value={selectedSale.updatedByName} />
            </div>

            {selectedSale.productLink && (
              <a href={selectedSale.productLink} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl border border-line px-4 py-2 text-sm text-accent transition hover:border-accent">
                Открыть ссылку товара
              </a>
            )}

            {(selectedSale.screenshotData || screenshotCache[selectedSale.id]) && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                <img src={selectedSale.screenshotData || screenshotCache[selectedSale.id]} alt="Скрин товара" className="max-h-[320px] w-full object-contain bg-card" />
              </div>
            )}

            {selectedSale.hasScreenshot && !selectedSale.screenshotData && !screenshotCache[selectedSale.id] && (
              <div className="mt-4 rounded-2xl border border-line bg-card p-3">
                <p className="text-xs text-muted">
                  {screenshotLoadingId === selectedSale.id
                    ? "Загрузка скрина..."
                    : screenshotError[selectedSale.id] || "Скрин не загружен"}
                </p>
                {screenshotLoadingId !== selectedSale.id && (
                  <button
                    type="button"
                    onClick={() => loadScreenshot(selectedSale.id)}
                    className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-bg px-3 text-xs text-text transition hover:border-accent"
                  >
                    Загрузить скрин
                  </button>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent"
              >
                Закрыть
              </button>

              <button
                type="button"
                disabled={pendingAction}
                onClick={() => setTrashTargetSale(selectedSale)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-400/60 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                <Trash2 size={14} /> В корзину
              </button>

              <button
                type="button"
                disabled={markingDone || selectedSale.isIssued}
                onClick={() => {
                  startMarkingDone(async () => {
                    const result = await markSaleDoneAction(selectedSale.id);
                    if (!result.ok) return;
                    setSelectedSale(null);
                    router.refresh();
                  });
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-3 text-sm font-semibold text-[#00131f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingDone && <Loader2 size={14} className="animate-spin" />}
                {selectedSale.isIssued ? "Выдано ✓" : "Выдано"}
              </button>
            </div>
          </div>
        </div>
      )}

      {trashTargetSale && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-bg p-4">
            <h4 className="text-base font-semibold text-text">Переместить в корзину?</h4>
            <p className="mt-2 text-sm text-muted">
              Товар: <span className="text-text">{trashTargetSale.productName || "-"}</span>
            </p>
            <p className="text-sm text-muted">
              Клиент: <span className="text-text">{trashTargetSale.clientName || "-"}</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTrashTargetSale(null)}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pendingAction}
                onClick={confirmMoveSaleToTrash}
                className="h-10 rounded-xl border border-red-400/60 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                В корзину
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setArchiveOpen(true)}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line bg-card text-text shadow-glow transition hover:border-accent"
          title="Архив"
        >
          <Archive size={20} />
        </button>
        <button
          type="button"
          onClick={() => setTrashOpen(true)}
          className="btn-primary inline-flex h-14 w-14 items-center justify-center rounded-full shadow-glow"
          title="Корзина"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {archiveOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[86vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-text">Архив</h3>
                <p className="text-sm text-muted">Выданные товары с группировкой по клиенту</p>
              </div>
              <button type="button" onClick={() => setArchiveOpen(false)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={20} />
              </button>
            </div>

            {archiveGroups.length === 0 ? (
              <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">Архив пустой</p>
            ) : (
              <div className="space-y-3">
                {archiveGroups.map((group) => {
                  const isExpanded = expandedArchiveGroups[group.key] ?? false;
                  const wa = waLink(group.clientPhone);

                  return (
                    <article key={group.key} className="rounded-xl border border-line bg-card p-3">
                      <button
                        type="button"
                        onClick={() => setExpandedArchiveGroups((prev) => ({ ...prev, [group.key]: !isExpanded }))}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={15} className="text-muted" /> : <ChevronRight size={15} className="text-muted" />}
                          <div>
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-text">
                              <span className={`h-2.5 w-2.5 rounded-full ${clientDotColor(group.key)}`} />
                              {group.clientName}
                            </p>
                            <p className="text-xs text-muted">{group.clientPhone || "-"}</p>
                          </div>
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
                            >
                              <MessageCircle size={13} />
                            </a>
                          )}
                        </div>
                        <span className="text-xs text-muted">{group.sales.length} шт.</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-line pt-3">
                          {group.sales.map((sale) => (
                            <div
                              key={sale.id}
                              className="cursor-pointer rounded-xl border border-line bg-bg p-3"
                              onClick={() => openSaleDetails(sale)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-text">{sale.productName}</p>
                                  {sale.productId && <p className="text-xs text-muted">Трек: {sale.productId}</p>}
                                  <p className="text-xs text-muted">{dateFmt(sale.createdAt)}</p>
                                </div>
                                <p className="text-sm font-semibold text-success">{money(sale.margin)}</p>
                              </div>

                              <div className="mt-2 flex items-center justify-between" onClick={(event) => event.stopPropagation()}>
                                <label className="inline-flex items-center gap-2 text-xs text-muted">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedArchiveIds[sale.id])}
                                    onChange={(e) =>
                                      setSelectedArchiveIds((prev) => ({
                                        ...prev,
                                        [sale.id]: e.target.checked
                                      }))
                                    }
                                  />
                                  Выбрать
                                </label>

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
                                    size: sale.size,
                                    quantity: sale.quantity,
                                    costPriceCny: sale.costPriceCny,
                                    salePrice: sale.salePrice,
                                    status: "DONE"
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={pendingAction || !selectedArchive.length}
                onClick={() => {
                  startPendingAction(async () => {
                    const fd = new FormData();
                    fd.set("ids", archiveIdsCsv);
                    await restoreArchivedSalesAction(fd);
                    setSelectedArchiveIds({});
                    router.refresh();
                  });
                }}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent disabled:opacity-60"
              >
                Восстановить выбранные
              </button>

              <button
                type="button"
                disabled={pendingAction || archiveSales.length === 0}
                onClick={() => {
                  startPendingAction(async () => {
                    const allIds = archiveSales.map((s) => s.id).join(",");
                    const fd = new FormData();
                    fd.set("ids", allIds);
                    await restoreArchivedSalesAction(fd);
                    setSelectedArchiveIds({});
                    router.refresh();
                  });
                }}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent disabled:opacity-60"
              >
                Восстановить все
              </button>
            </div>
          </div>
        </div>
      )}

      {trashOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[86vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-text">Корзина</h3>
                <p className="text-sm text-muted">Удаленные карточки сначала попадают сюда</p>
              </div>
              <button type="button" onClick={() => setTrashOpen(false)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={20} />
              </button>
            </div>

            {trashSales.length === 0 ? (
              <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">Корзина пустая</p>
            ) : (
              <div className="space-y-2">
                {trashSales.map((sale) => {
                  const checked = Boolean(selectedTrashIds[sale.id]);
                  return (
                    <label key={sale.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedTrashIds((prev) => ({
                            ...prev,
                            [sale.id]: e.target.checked
                          }))
                        }
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{sale.clientName} · {sale.productName}</p>
                        <p className="text-xs text-muted">{sale.clientPhone} · {dateFmt(sale.createdAt)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={pendingAction || !selectedTrash.length}
                onClick={() => {
                  startPendingAction(async () => {
                    const fd = new FormData();
                    fd.set("ids", trashIdsCsv);
                    await restoreSalesFromTrashAction(fd);
                    setSelectedTrashIds({});
                    router.refresh();
                  });
                }}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent disabled:opacity-60"
              >
                Восстановить выбранные
              </button>

              <button
                type="button"
                disabled={pendingAction || trashSales.length === 0}
                onClick={() => {
                  startPendingAction(async () => {
                    const allIds = trashSales.map((s) => s.id).join(",");
                    const fd = new FormData();
                    fd.set("ids", allIds);
                    await restoreSalesFromTrashAction(fd);
                    setSelectedTrashIds({});
                    router.refresh();
                  });
                }}
                className="h-10 rounded-xl border border-line bg-card text-sm text-text transition hover:border-accent disabled:opacity-60"
              >
                Восстановить все
              </button>

              <button
                type="button"
                disabled={pendingAction || !selectedTrash.length}
                onClick={() => {
                  if (!window.confirm("Удалить выбранные карточки навсегда?")) return;
                  startPendingAction(async () => {
                    const fd = new FormData();
                    fd.set("ids", trashIdsCsv);
                    await clearTrashAction(fd);
                    setSelectedTrashIds({});
                    router.refresh();
                  });
                }}
                className="h-10 rounded-xl border border-red-400/60 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                Очистить выбранные
              </button>

              <button
                type="button"
                disabled={pendingAction || trashSales.length === 0}
                onClick={() => {
                  if (!window.confirm("Очистить всю корзину навсегда?")) return;
                  startPendingAction(async () => {
                    const fd = new FormData();
                    await clearTrashAction(fd);
                    setSelectedTrashIds({});
                    router.refresh();
                  });
                }}
                className="h-10 rounded-xl border border-red-400/60 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                Очистить всю корзину
              </button>
            </div>
          </div>
        </div>
      )}
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
