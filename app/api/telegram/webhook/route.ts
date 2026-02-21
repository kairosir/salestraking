import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string };
  };
};

export async function POST(req: Request) {
  const secretPathToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  const tokenFromQuery = new URL(req.url).searchParams.get("secret");
  if (secretPathToken && tokenFromQuery !== secretPathToken) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
  const text = update.message?.text?.trim() ?? "";
  const chatIdRaw = update.message?.chat?.id;
  const chatId = chatIdRaw != null ? String(chatIdRaw) : "";
  const username = update.message?.from?.username ?? null;

  if (!chatId) return NextResponse.json({ ok: true });

  const parts = text.split(/\s+/).filter(Boolean);
  const command = (parts[0] || "").toLowerCase();
  const loginHint = (parts[1] || "").trim().toLowerCase();

  if (command === "/start" || command === "start") {
    let userId: string | null = null;
    if (loginHint) {
      const linkedUser = await prisma.user.findFirst({
        where: {
          OR: [{ username: loginHint }, { email: loginHint }]
        },
        select: { id: true }
      });
      userId = linkedUser?.id ?? null;
    }

    await prisma.notificationRecipient.upsert({
      where: { telegramChatId: chatId },
      update: {
        userId,
        telegramUsername: username,
        telegramEnabled: true,
        isActive: true
      },
      create: {
        userId,
        telegramChatId: chatId,
        telegramUsername: username,
        telegramEnabled: true,
        emailEnabled: false,
        isActive: true
      }
    });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const linkMessage = loginHint
        ? "Ваш Telegram привязан к аккаунту. Уведомления включены."
        : "Telegram подключен. Для привязки к аккаунту отправьте: /start ваш_логин";
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Вы подключили уведомления Salestraking.\n${linkMessage}`
        })
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
