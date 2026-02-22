import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/notifications";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string; first_name?: string };
  };
};

function parseCommand(text: string) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const command = (parts[0] || "").toLowerCase();
  const arg = (parts[1] || "").trim().toLowerCase();
  return { command, arg };
}

async function linkUserByLogin(loginHint: string) {
  if (!loginHint) return null;
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: loginHint }, { email: loginHint }]
    },
    select: { id: true, username: true, email: true }
  });
  return user;
}

async function getOpenSalesCount(userId: string | null) {
  if (!userId) return null;
  const count = await prisma.sale.count({
    where: {
      createdById: userId,
      status: "TODO"
    }
  });
  return count;
}

export async function handleTelegramWebhook(update: TelegramUpdate) {
  const text = update.message?.text?.trim() ?? "";
  const chatIdRaw = update.message?.chat?.id;
  const chatId = chatIdRaw != null ? String(chatIdRaw) : "";
  const username = update.message?.from?.username ?? null;
  const firstName = update.message?.from?.first_name ?? "Пользователь";

  if (!chatId) return { ok: true };

  const { command, arg } = parseCommand(text);

  const existing = await prisma.notificationRecipient.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true, userId: true, telegramEnabled: true }
  });

  if (command === "/start" || command === "start") {
    const linkedUser = await linkUserByLogin(arg);
    const targetUserId = linkedUser?.id ?? existing?.userId ?? null;
    const existingUserId = existing?.userId ?? null;

    if (existingUserId && linkedUser?.id && linkedUser.id !== existingUserId) {
      await sendTelegramMessage(chatId, "Этот Telegram-чат уже привязан к другому пользователю и не может быть перепривязан.");
      return { ok: true };
    }

    const userId = targetUserId;

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

    const linkMsg = linkedUser
      ? `Аккаунт привязан: ${linkedUser.username || linkedUser.email || "user"}`
      : "Для привязки к аккаунту отправьте: /start ваш_логин";
    await sendTelegramMessage(
      chatId,
      [
        `Привет, ${firstName}!`,
        "Вы подключили уведомления Salestraking.",
        linkMsg,
        "Команды: /help, /status, /stop, /resume"
      ].join("\n")
    );
    return { ok: true };
  }

  if (!existing) {
    await sendTelegramMessage(chatId, "Сначала выполните /start");
    return { ok: true };
  }

  if (command === "/help") {
    await sendTelegramMessage(
      chatId,
      [
        "Команды бота:",
        "/start [логин] - подключить уведомления",
        "/status - проверить подключение и открытые карточки",
        "/stop - пауза telegram-уведомлений",
        "/resume - включить telegram-уведомления"
      ].join("\n")
    );
    return { ok: true };
  }

  if (command === "/stop") {
    await prisma.notificationRecipient.update({
      where: { telegramChatId: chatId },
      data: { telegramEnabled: false }
    });
    await sendTelegramMessage(chatId, "Telegram-уведомления приостановлены. Для возврата: /resume");
    return { ok: true };
  }

  if (command === "/resume") {
    await prisma.notificationRecipient.update({
      where: { telegramChatId: chatId },
      data: { telegramEnabled: true, isActive: true }
    });
    await sendTelegramMessage(chatId, "Telegram-уведомления снова включены.");
    return { ok: true };
  }

  if (command === "/status") {
    const open = await getOpenSalesCount(existing.userId);
    await sendTelegramMessage(
      chatId,
      [
        `Статус подключения: ${existing.telegramEnabled ? "включено" : "выключено"}`,
        `Открытых карточек (Доделать): ${open ?? "-"}`
      ].join("\n")
    );
    return { ok: true };
  }

  await sendTelegramMessage(chatId, "Команда не распознана. Используйте /help");
  return { ok: true };
}
