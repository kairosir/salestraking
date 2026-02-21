import { NotificationKind, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ASTANA_TIMEZONE = "Asia/Almaty";
const ASTANA_UTC_OFFSET_HOURS = 5;
type NotificationScope = { userId?: string };
type RunNotificationScope = NotificationScope & { forceWeekly?: boolean };

type AstanaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function astanaParts(date: Date): AstanaParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ASTANA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day))).getUTCDay()
  };
}

function dayIndexInAstana(date: Date) {
  const p = astanaParts(date);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

function astanaDateKey(date: Date) {
  const p = astanaParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function astanaDateFromParts(parts: Pick<AstanaParts, "year" | "month" | "day">, hour = 0, minute = 0) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - ASTANA_UTC_OFFSET_HOURS, minute, 0, 0));
}

function shiftAstanaDate(parts: Pick<AstanaParts, "year" | "month" | "day">, days: number) {
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  const shifted = new Date(utcMidnight + days * 86_400_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function formatAstanaPeriodDate(parts: { year: number; month: number; day: number }, time: string) {
  const d = String(parts.day).padStart(2, "0");
  const m = String(parts.month).padStart(2, "0");
  return `${d}.${m}.${parts.year} ${time}`;
}

function weeklyWindow(now: Date) {
  const p = astanaParts(now);
  const daysSinceMonday = (p.weekday + 6) % 7;
  const monday = shiftAstanaDate(p, -daysSinceMonday);
  const sunday = shiftAstanaDate(monday, 6);
  const startUtc = astanaDateFromParts(monday, 6, 0);
  const endUtc = astanaDateFromParts(sunday, 22, 0);
  const key = `${monday.year}${String(monday.month).padStart(2, "0")}${String(monday.day).padStart(2, "0")}-${sunday.year}${String(sunday.month).padStart(2, "0")}${String(sunday.day).padStart(2, "0")}`;

  return {
    monday,
    sunday,
    startUtc,
    endUtc,
    key,
    isWeeklySendMoment: p.weekday === 0 && p.hour === 22
  };
}

function pendingWindowKey(now: Date) {
  const p = astanaParts(now);
  const block = Math.floor(p.hour / 3);
  return `${astanaDateKey(now)}-h${block}`;
}

function pendingMessage(input: { clientName: string; clientPhone: string; productName: string; status: SaleStatus; id: string }) {
  return [
    `Нужно доработать товар (${input.status === "TODO" ? "Доделать" : "Ожидание"})`,
    `Товар: ${input.productName || "-"}`,
    `Клиент: ${input.clientName || "-"}`,
    `Телефон: ${input.clientPhone || "-"}`,
    `ID: ${input.id}`
  ].join("\n");
}

function inTransitMessage(input: { clientName: string; clientPhone: string; productName: string; id: string; days: number }) {
  return [
    "Проверка статуса товара в пути",
    `Прошло дней с добавления: ${input.days}`,
    `Товар: ${input.productName || "-"}`,
    `Клиент: ${input.clientName || "-"}`,
    `Телефон: ${input.clientPhone || "-"}`,
    `ID: ${input.id}`
  ].join("\n");
}

function weeklySummaryMessage(input: {
  startLabel: string;
  endLabel: string;
  totalMargin: number;
  aimShare: number;
  dashaShare: number;
  salesCount: number;
}) {
  return [
    "Пора проверить расчет за неделю",
    `Период: ${input.startLabel} - ${input.endLabel}`,
    `Карточек в периоде: ${input.salesCount}`,
    `Общая маржа: ${money(input.totalMargin)}`,
    `Aim (40%): ${money(input.aimShare)}`,
    `Dasha (60%): ${money(input.dashaShare)}`
  ].join("\n");
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

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "TELEGRAM_BOT_TOKEN missing" as const };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, reason: `telegram ${response.status}: ${body}` as const };
  }

  return { ok: true as const };
}

async function sendEmailMessage(email: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { ok: false, reason: "RESEND_API_KEY/RESEND_FROM missing" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, reason: `email ${response.status}: ${body}` as const };
  }

  return { ok: true as const };
}

export async function runTestNotifications(scope: NotificationScope = {}) {
  const recipients = await prisma.notificationRecipient.findMany({
    where: {
      isActive: true,
      ...(scope.userId ? { userId: scope.userId } : {})
    }
  });
  const activeRecipients = recipients.filter((r) => r.telegramEnabled && r.telegramChatId);

  let sent = 0;
  let skipped = 0;
  const text = ["Тестовое уведомление Salestraking", `Время: ${new Date().toISOString()}`].join("\n");

  for (const recipient of activeRecipients) {
    let delivered = false;
    if (recipient.telegramEnabled && recipient.telegramChatId) {
      const tg = await sendTelegramMessage(recipient.telegramChatId, text);
      delivered = delivered || tg.ok;
    }

    if (delivered) sent += 1;
    else skipped += 1;
  }

  return { ok: true, sent, skipped, recipients: activeRecipients.length };
}

async function wasSent(kind: NotificationKind, windowKey: string, saleId: string, recipientId: string) {
  const existing = await prisma.notificationLog.findUnique({
    where: {
      kind_windowKey_saleId_recipientId: {
        kind,
        windowKey,
        saleId,
        recipientId
      }
    },
    select: { id: true }
  });
  return Boolean(existing);
}

async function saveSent(kind: NotificationKind, windowKey: string, saleId: string, recipientId: string) {
  await prisma.notificationLog.create({
    data: {
      kind,
      windowKey,
      saleId,
      recipientId
    }
  });
}

export async function runNotifications(scope: RunNotificationScope = {}) {
  const now = new Date();
  const recipients = await prisma.notificationRecipient.findMany({
    where: {
      isActive: true,
      ...(scope.userId ? { userId: scope.userId } : {})
    }
  });
  const activeRecipients = recipients.filter((r) => r.telegramEnabled && r.telegramChatId);
  if (!activeRecipients.length) {
    return { ok: true, sent: 0, skipped: 0, reason: "no recipients" };
  }

  const sales = await prisma.sale.findMany({
    where: {
      status: { in: [SaleStatus.TODO, SaleStatus.WAITING] },
      ...(scope.userId ? { createdById: scope.userId } : {})
    },
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      productName: true,
      createdAt: true,
      status: true
    }
  });

  let sent = 0;
  let skipped = 0;
  const pendingKey = pendingWindowKey(now);
  const dayKey = astanaDateKey(now);
  const nowDayIdx = dayIndexInAstana(now);
  const week = weeklyWindow(now);

  for (const sale of sales) {
    const daysSince = nowDayIdx - dayIndexInAstana(sale.createdAt);
    const shouldSendInTransit = daysSince >= 10 && daysSince <= 13;

    for (const recipient of activeRecipients) {
      const pendingAlready = await wasSent(NotificationKind.PENDING_3H, pendingKey, sale.id, recipient.id);
      if (!pendingAlready) {
        const text = pendingMessage({
          clientName: sale.clientName,
          clientPhone: sale.clientPhone,
          productName: sale.productName,
          status: sale.status,
          id: sale.id
        });

        let delivered = false;
        if (recipient.telegramEnabled && recipient.telegramChatId) {
          const tgResult = await sendTelegramMessage(recipient.telegramChatId, text);
          delivered = delivered || tgResult.ok;
        }

        if (delivered) {
          await saveSent(NotificationKind.PENDING_3H, pendingKey, sale.id, recipient.id);
          sent += 1;
        } else {
          skipped += 1;
        }
      } else {
        skipped += 1;
      }

      if (!shouldSendInTransit) continue;

      const transitAlready = await wasSent(NotificationKind.IN_TRANSIT_10D, dayKey, sale.id, recipient.id);
      if (transitAlready) {
        skipped += 1;
        continue;
      }

      const transitText = inTransitMessage({
        clientName: sale.clientName,
        clientPhone: sale.clientPhone,
        productName: sale.productName,
        id: sale.id,
        days: daysSince
      });

      let delivered = false;
      if (recipient.telegramEnabled && recipient.telegramChatId) {
        const tgResult = await sendTelegramMessage(recipient.telegramChatId, transitText);
        delivered = delivered || tgResult.ok;
      }

      if (delivered) {
        await saveSent(NotificationKind.IN_TRANSIT_10D, dayKey, sale.id, recipient.id);
        sent += 1;
      } else {
        skipped += 1;
      }
    }
  }

  const shouldSendWeekly = week.isWeeklySendMoment || Boolean(scope.forceWeekly);
  if (shouldSendWeekly) {
    const [weeklyAgg, weeklyCount] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          createdAt: {
            gte: week.startUtc,
            lte: week.endUtc
          },
          ...(scope.userId ? { createdById: scope.userId } : {})
        },
        _sum: { margin: true }
      }),
      prisma.sale.count({
        where: {
          createdAt: {
            gte: week.startUtc,
            lte: week.endUtc
          },
          ...(scope.userId ? { createdById: scope.userId } : {})
        }
      })
    ]);

    const totalMargin = Number(weeklyAgg._sum.margin ?? 0);
    const aimShare = totalMargin * 0.4;
    const dashaShare = totalMargin * 0.6;
    const summaryText = weeklySummaryMessage({
      startLabel: formatAstanaPeriodDate(week.monday, "06:00"),
      endLabel: formatAstanaPeriodDate(week.sunday, "22:00"),
      totalMargin,
      aimShare,
      dashaShare,
      salesCount: weeklyCount
    });

    for (const recipient of activeRecipients) {
      let delivered = false;
      if (recipient.telegramEnabled && recipient.telegramChatId) {
        const tgResult = await sendTelegramMessage(recipient.telegramChatId, summaryText);
        delivered = delivered || tgResult.ok;
      }

      if (delivered) {
        sent += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return {
    ok: true,
    sent,
    skipped,
    recipients: activeRecipients.length,
    sales: sales.length,
    weekly: {
      enabled: shouldSendWeekly,
      windowKey: `weekly-${week.key}`
    }
  };
}
