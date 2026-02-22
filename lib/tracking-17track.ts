import { Prisma, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/notifications";

type SyncScope = { userId?: string };

type Track17Info = {
  status: string | null;
  substatus: string | null;
  lastEvent: string | null;
  raw: unknown;
};

type SyncSummary = {
  ok: boolean;
  enabled: boolean;
  checked: number;
  updated: number;
  failed: number;
  skipped: number;
  reason?: string;
};

const DEFAULT_BASE_URL = "https://api.17track.net/track/v2.4";

function normalizeTrackingNumber(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

function parseLimit() {
  const raw = Number(process.env.TRACK17_SYNC_LIMIT ?? "20");
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.min(200, Math.floor(raw));
}

function parseDaysEnv(name: string, fallback: number) {
  const raw = Number(process.env[name] ?? String(fallback));
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return Math.floor(raw);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function extractInfo(payload: unknown): Track17Info {
  const asObj = payload as Record<string, unknown> | null;
  if (!asObj || typeof asObj !== "object") {
    return { status: null, substatus: null, lastEvent: null, raw: payload };
  }

  const directData =
    (asObj.data as Record<string, unknown> | undefined) ??
    (asObj.track_info as Record<string, unknown> | undefined) ??
    (asObj.trackInfo as Record<string, unknown> | undefined) ??
    asObj;

  const latestStatus =
    (directData.latest_status as Record<string, unknown> | undefined) ??
    (directData.latestStatus as Record<string, unknown> | undefined) ??
    null;
  const latestEvent =
    (directData.latest_event as Record<string, unknown> | undefined) ??
    (directData.latestEvent as Record<string, unknown> | undefined) ??
    null;

  const status =
    (latestStatus?.status as string | undefined) ??
    (latestStatus?.description as string | undefined) ??
    (latestEvent?.status as string | undefined) ??
    (directData.status as string | undefined) ??
    null;

  const substatus =
    (latestStatus?.sub_status as string | undefined) ??
    (latestStatus?.subStatus as string | undefined) ??
    (latestEvent?.sub_status as string | undefined) ??
    (directData.sub_status as string | undefined) ??
    null;

  const lastEvent =
    (latestEvent?.description as string | undefined) ??
    (latestEvent?.event as string | undefined) ??
    (directData.latest_event_desc as string | undefined) ??
    null;

  return {
    status: status ? String(status) : null,
    substatus: substatus ? String(substatus) : null,
    lastEvent: lastEvent ? String(lastEvent) : null,
    raw: payload
  };
}

async function call17Track(apiKey: string, path: string, body: unknown) {
  const base = process.env.TRACK17_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "17token": apiKey
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    throw new Error(`17TRACK ${response.status}`);
  }

  return json;
}

async function registerIfNeeded(apiKey: string, trackingNumber: string, registeredAt: Date | null) {
  if (registeredAt) return { ok: true, registeredAt };

  try {
    await call17Track(apiKey, "/register", {
      data: [{ number: trackingNumber }]
    });
    return { ok: true, registeredAt: new Date() };
  } catch {
    return { ok: false, registeredAt: null as Date | null };
  }
}

async function getTrackInfo(apiKey: string, trackingNumber: string): Promise<Track17Info> {
  const payload = await call17Track(apiKey, "/gettrackinfo", {
    data: [{ number: trackingNumber }]
  });

  const obj = payload as Record<string, unknown> | null;
  const dataRoot = obj?.data as Record<string, unknown> | undefined;
  const accepted = dataRoot?.accepted as unknown[] | undefined;

  if (Array.isArray(accepted) && accepted.length > 0) {
    const first = accepted[0] as Record<string, unknown>;
    return extractInfo(first.track_info ?? first.trackInfo ?? first);
  }

  const dataArray = dataRoot as unknown;
  if (Array.isArray(dataArray) && dataArray.length > 0) {
    const first = dataArray[0] as Record<string, unknown>;
    return extractInfo(first.track_info ?? first.trackInfo ?? first);
  }

  return extractInfo(payload);
}

function looksDelivered(status: string | null, substatus: string | null) {
  const merged = `${status ?? ""} ${substatus ?? ""}`.toLowerCase();
  return ["delivered", "signed", "pod", "received", "delivered_to_recipient"].some((token) => merged.includes(token));
}

function looksArrivedInCountry(status: string | null, substatus: string | null, lastEvent: string | null) {
  const merged = `${status ?? ""} ${substatus ?? ""} ${lastEvent ?? ""}`.toLowerCase();
  const keywords = [
    "arrived at destination country",
    "destination country",
    "arrived in kazakhstan",
    "arrived at local facility",
    "arrival at destination",
    "import customs",
    "almaty",
    "astana",
    "kazakhstan"
  ];
  return keywords.some((token) => merged.includes(token));
}

function trackingStatusMessage(input: {
  clientName: string;
  clientPhone: string;
  productName: string;
  trackingNumber: string;
  status: string | null;
  substatus: string | null;
}) {
  return [
    "Обновлен трек-статус товара",
    `Товар: ${input.productName || "-"}`,
    `Клиент: ${input.clientName || "-"}`,
    `Телефон: ${input.clientPhone || "-"}`,
    `Трек: ${input.trackingNumber}`,
    `Статус: ${input.status || "-"}`,
    `Подстатус: ${input.substatus || "-"}`
  ].join("\n");
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.DbNull;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value as Prisma.InputJsonValue;
  if (typeof value === "object") return value as Prisma.InputJsonValue;
  return String(value);
}

export async function sync17Track(scope: SyncScope = {}): Promise<SyncSummary> {
  const apiKey = process.env.TRACK17_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: true,
      enabled: false,
      checked: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      reason: "TRACK17_API_KEY missing"
    };
  }

  const limit = parseLimit();
  const firstCheckDays = parseDaysEnv("TRACK17_FIRST_CHECK_DAYS", 2);
  const recheckDays = parseDaysEnv("TRACK17_RECHECK_DAYS", 4);
  const now = new Date();
  const sales = await prisma.sale.findMany({
    where: {
      status: { in: [SaleStatus.TODO, SaleStatus.DONE] },
      trackingArrivedAt: null,
      OR: [{ trackingNumber: { not: null } }, { productId: { not: null } }],
      AND: [
        {
          OR: [{ trackingNextCheckAt: null }, { trackingNextCheckAt: { lte: now } }]
        }
      ],
      ...(scope.userId ? { createdById: scope.userId } : {})
    },
    orderBy: [{ trackingNextCheckAt: "asc" }, { trackingSyncedAt: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      productId: true,
      clientName: true,
      clientPhone: true,
      productName: true,
      createdAt: true,
      trackingNumber: true,
      trackingStatus: true,
      trackingSubstatus: true,
      trackingLastEvent: true,
      trackingNextCheckAt: true,
      trackingArrivedAt: true,
      trackingLastChangedAt: true,
      trackingRegisteredAt: true,
      trackingProvider: true
    }
  });
  const recipients = await prisma.notificationRecipient.findMany({
    where: {
      isActive: true,
      telegramEnabled: true,
      telegramChatId: { not: null }
    },
    select: { telegramChatId: true }
  });

  let checked = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const sale of sales) {
    const trackingNumber = normalizeTrackingNumber(sale.productId || sale.trackingNumber);
    if (!trackingNumber) {
      skipped += 1;
      continue;
    }

    if (sale.trackingArrivedAt || looksDelivered(sale.trackingStatus, sale.trackingSubstatus)) {
      skipped += 1;
      continue;
    }

    const dueAt = sale.trackingNextCheckAt ?? addDays(sale.createdAt, firstCheckDays);
    if (dueAt > now) {
      skipped += 1;
      continue;
    }

    checked += 1;

    const registerResult = await registerIfNeeded(apiKey, trackingNumber, sale.trackingRegisteredAt);

    try {
      const info = await getTrackInfo(apiKey, trackingNumber);
      const changed =
        sale.trackingNumber !== trackingNumber ||
        sale.trackingStatus !== info.status ||
        sale.trackingSubstatus !== info.substatus ||
        sale.trackingLastEvent !== info.lastEvent ||
        sale.trackingProvider !== "17TRACK";
      const arrived = looksArrivedInCountry(info.status, info.substatus, info.lastEvent) || looksDelivered(info.status, info.substatus);

      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          trackingNumber,
          trackingProvider: "17TRACK",
          trackingStatus: info.status,
          trackingSubstatus: info.substatus,
          trackingLastEvent: info.lastEvent,
          trackingRaw: toJsonInput(info.raw),
          trackingSyncedAt: now,
          trackingRegisteredAt: registerResult.registeredAt,
          trackingNextCheckAt: arrived ? null : addDays(now, recheckDays),
          trackingArrivedAt: arrived ? now : null,
          trackingLastChangedAt: changed ? now : sale.trackingLastChangedAt
        }
      });

      if (changed) {
        updated += 1;
        const message = trackingStatusMessage({
          clientName: sale.clientName,
          clientPhone: sale.clientPhone,
          productName: sale.productName,
          trackingNumber,
          status: info.status,
          substatus: info.substatus
        });
        for (const recipient of recipients) {
          if (!recipient.telegramChatId) continue;
          await sendTelegramMessage(recipient.telegramChatId, message);
        }
      }
    } catch {
      failed += 1;
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          trackingNumber,
          trackingProvider: "17TRACK",
          trackingSyncedAt: now,
          trackingRegisteredAt: registerResult.registeredAt,
          trackingNextCheckAt: addDays(now, recheckDays)
        }
      });
    }
  }

  return {
    ok: true,
    enabled: true,
    checked,
    updated,
    failed,
    skipped
  };
}
