"use client";

import { useState, useTransition } from "react";
import {
  runNotificationsGlobalNowAction,
  runNotificationsNowAction,
  sendTestNotificationsAction,
  sendTestNotificationsGlobalAction
} from "@/app/actions";

type Recipient = {
  id: string;
  email: string | null;
  telegramChatId: string | null;
  telegramUsername: string | null;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  isActive: boolean;
};

export function NotificationSettings({ recipients, loginHint }: { recipients: Recipient[]; loginHint: string }) {
  const [message, setMessage] = useState<string>("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-3xl border border-line bg-card/70 p-4">
      <p className="mb-3 text-sm text-muted">Уведомления (Telegram)</p>

      <div className="mb-3 rounded-xl border border-line bg-card p-3 text-xs text-muted">
        <p>Telegram: отправьте боту команду `/start {loginHint}` чтобы привязать чат к вашему аккаунту.</p>
        <p className="mt-1">Кнопки `мой` отправляют только вам, кнопки `общий` отправляют всем получателям.</p>
        <p className="mt-1">Email-уведомления временно отключены. Работают только Telegram-уведомления.</p>
        <p className="mt-1">Напоминания: каждые 3 часа по товарам со статусом `Доделать`.</p>
        <p className="mt-1">Итог недели: в воскресенье в 22:00 (Астана), период расчета Пн 06:00 - Вс 22:00.</p>
        <p className="mt-1">Команды бота: `/help`, `/status`, `/stop`, `/resume`.</p>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const result = await sendTestNotificationsAction();
              if (!result.ok) {
                setMessage(result.error || "Ошибка тестовой отправки");
                return;
              }
              setMessage(`Тест отправлен. Отправлено: ${result.sent ?? 0}, пропущено: ${result.skipped ?? 0}`);
            })
          }
          className="h-10 rounded-xl border border-line bg-card px-4 text-sm text-text transition hover:border-accent disabled:opacity-60"
        >
          Тест мой (tg)
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const result = await sendTestNotificationsGlobalAction();
              if (!result.ok) {
                setMessage(result.error || "Ошибка общего теста");
                return;
              }
              setMessage(`Общий тест отправлен. Отправлено: ${result.sent ?? 0}, пропущено: ${result.skipped ?? 0}`);
            })
          }
          className="h-10 rounded-xl border border-line bg-card px-4 text-sm text-text transition hover:border-accent disabled:opacity-60"
        >
          Тест общий (tg)
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const result = await runNotificationsNowAction();
              if (!result.ok) {
                setMessage(result.error || "Ошибка запуска рассылки");
                return;
              }
              setMessage(`Рассылка запущена вручную. Отправлено: ${result.sent ?? 0}, пропущено: ${result.skipped ?? 0}`);
            })
          }
          className="h-10 rounded-xl border border-line bg-card px-4 text-sm text-text transition hover:border-accent disabled:opacity-60"
        >
          Запуск мой
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const result = await runNotificationsGlobalNowAction();
              if (!result.ok) {
                setMessage(result.error || "Ошибка общего запуска");
                return;
              }
              setMessage(`Общая рассылка запущена. Отправлено: ${result.sent ?? 0}, пропущено: ${result.skipped ?? 0}`);
            })
          }
          className="h-10 rounded-xl border border-line bg-card px-4 text-sm text-text transition hover:border-accent disabled:opacity-60"
        >
          Запуск общий
        </button>
      </div>

      {message && <p className="mb-3 text-xs text-muted">{message}</p>}

      <div className="space-y-2">
        {recipients.length === 0 && <p className="text-xs text-muted">Получателей пока нет.</p>}
        {recipients.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-card p-3 text-xs text-muted">
            <p>Telegram: {r.telegramUsername ? `@${r.telegramUsername}` : r.telegramChatId || "-"}</p>
            <p>Активен: {r.isActive ? "Да" : "Нет"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
