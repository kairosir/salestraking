import { NotificationKind, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ASTANA_TIMEZONE = "Asia/Almaty";

type AstanaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

function astanaParts(date: Date): AstanaParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ASTANA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour)
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

function pendingWindowKey(now: Date) {
  const p = astanaParts(now);
  const block = Math.floor(p.hour / 3);
  return `${astanaDateKey(now)}-h${block}`;
}

function pendingMessage(input: { clientName: string; clientPhone: string; productName: string; status: SaleStatus; id: string }) {
  return [
    "Напоминание по карточке товара",
    `Статус: ${input.status === "TODO" ? "Доделать" : "Ожидание"}`,
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

export async function runTestNotifications() {
  const recipients = await prisma.notificationRecipient.findMany({
    where: { isActive: true }
  });
  const activeRecipients = recipients.filter((r) => (r.telegramEnabled && r.telegramChatId) || (r.emailEnabled && r.email));

  let sent = 0;
  let skipped = 0;
  const text = ["Тестовое уведомление Salestraking", `Время: ${new Date().toISOString()}`].join("\n");

  for (const recipient of activeRecipients) {
    let delivered = false;
    if (recipient.telegramEnabled && recipient.telegramChatId) {
      const tg = await sendTelegramMessage(recipient.telegramChatId, text);
      delivered = delivered || tg.ok;
    }
    if (recipient.emailEnabled && recipient.email) {
      const mail = await sendEmailMessage(recipient.email, "Тестовое уведомление Salestraking", text);
      delivered = delivered || mail.ok;
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

export async function runNotifications() {
  const now = new Date();
  const recipients = await prisma.notificationRecipient.findMany({
    where: { isActive: true }
  });
  const activeRecipients = recipients.filter((r) => (r.telegramEnabled && r.telegramChatId) || (r.emailEnabled && r.email));
  if (!activeRecipients.length) {
    return { ok: true, sent: 0, skipped: 0, reason: "no recipients" };
  }

  const sales = await prisma.sale.findMany({
    where: {
      status: { in: [SaleStatus.TODO, SaleStatus.WAITING] }
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
        if (recipient.emailEnabled && recipient.email) {
          const emailResult = await sendEmailMessage(recipient.email, "Напоминание: карточка товара требует действия", text);
          delivered = delivered || emailResult.ok;
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
      if (recipient.emailEnabled && recipient.email) {
        const emailResult = await sendEmailMessage(recipient.email, "Проверка: товар в пути", transitText);
        delivered = delivered || emailResult.ok;
      }

      if (delivered) {
        await saveSent(NotificationKind.IN_TRANSIT_10D, dayKey, sale.id, recipient.id);
        sent += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return { ok: true, sent, skipped, recipients: activeRecipients.length, sales: sales.length };
}
