"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, TriangleAlert, X } from "lucide-react";
import { createPortal } from "react-dom";

export const OPEN_SALE_FROM_NOTIFICATION_EVENT = "open-sale-from-notification";

type SaleForNotice = {
  id: string;
  clientName: string;
  clientPhone: string;
  productName: string;
  productId: string | null;
  status: "DONE" | "TODO" | "WAITING";
};

function parseTrackCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    } catch {
      // ignore
    }
  }
  return trimmed
    .split(/[\n,;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function NotificationsCenter({ sales }: { sales: SaleForNotice[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [systemEnabled, setSystemEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSystemEnabled(typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted");
  }, []);

  const items = useMemo(() => {
    const active = sales.filter((sale) => sale.status !== "WAITING");
    const grouped = new Map<string, {
      id: string;
      clientName: string;
      clientPhone: string;
      productName: string;
      missingTrack: boolean;
      needTodo: boolean;
    }>();

    for (const sale of active) {
      const missingTrack = parseTrackCodes(sale.productId).length === 0;
      const needTodo = sale.status !== "DONE";
      if (!missingTrack && !needTodo) continue;

      const existing = grouped.get(sale.id);
      if (!existing) {
        grouped.set(sale.id, {
          id: sale.id,
          clientName: sale.clientName,
          clientPhone: sale.clientPhone,
          productName: sale.productName,
          missingTrack,
          needTodo
        });
        continue;
      }

      existing.missingTrack = existing.missingTrack || missingTrack;
      existing.needTodo = existing.needTodo || needTodo;
    }

    return Array.from(grouped.values());
  }, [sales]);

  const badgeCount = items.length;

  useEffect(() => {
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      const nav = navigator as Navigator & { setAppBadge?: (value?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (badgeCount > 0) {
        nav.setAppBadge?.(badgeCount).catch(() => undefined);
      } else {
        nav.clearAppBadge?.().catch(() => undefined);
      }
    }
  }, [badgeCount]);

  useEffect(() => {
    if (!systemEnabled || !items.length || typeof window === "undefined") return;
    const headline = `Нужно проверить ${items.length} заказ(ов)`;
    const body = items
      .slice(0, 3)
      .map((item) => `${item.clientName}: ${item.productName}`)
      .join("\n");
    const key = `salestraking-notice-${items.map((i) => i.id).join("|")}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    try {
      new Notification(headline, { body });
    } catch {
      // ignore
    }
  }, [systemEnabled, items]);

  const enableSystem = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setSystemEnabled(perm === "granted");
  };

  const openSaleFromNotification = (saleId: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(OPEN_SALE_FROM_NOTIFICATION_EVENT, {
        detail: { saleId }
      })
    );
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Уведомления"
        aria-label="Уведомления"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-card text-muted transition hover:border-accent hover:text-text"
      >
        <Bell size={16} />
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {badgeCount}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[95] grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
            <div className="h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-text">Уведомления</h3>
                  <p className="text-sm text-muted">Контроль заказов и трек-кодов</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                  <X size={20} />
                </button>
              </div>

              {!systemEnabled && (
                <button
                  type="button"
                  onClick={enableSystem}
                  className="mb-3 inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm text-text"
                >
                  Включить системные уведомления
                </button>
              )}

              <div className="space-y-2">
                {items.length === 0 && <p className="text-sm text-muted">Критичных уведомлений нет.</p>}
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openSaleFromNotification(item.id)}
                    className="w-full rounded-xl border border-line bg-card p-3 text-left transition hover:border-accent"
                  >
                    <p className="text-sm font-semibold text-red-400">ВАЖНО:</p>
                    <p className="text-sm text-text">{item.clientName} · {item.clientPhone || "-"}</p>
                    <p className="text-sm text-text">{item.productName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.needTodo && <span className="rounded-lg border border-red-400/60 bg-red-500/20 px-2 py-1 text-xs text-red-200">Доделать</span>}
                      {item.missingTrack && <span className="rounded-lg border border-amber-400/60 bg-amber-500/20 px-2 py-1 text-xs text-amber-100">Добавить трек код</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function MissingTrackAlert({ productId }: { productId: string | null | undefined }) {
  const missing = parseTrackCodes(productId).length === 0;
  if (!missing) return null;
  return (
    <span title="Не указан трек-код" className="inline-flex items-center justify-center text-amber-400 animate-pulse">
      <TriangleAlert size={14} />
    </span>
  );
}
