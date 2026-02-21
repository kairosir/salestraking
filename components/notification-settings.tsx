"use client";

import { useState, useTransition } from "react";
import { addNotificationEmailAction, runNotificationsNowAction, sendTestNotificationsAction } from "@/app/actions";

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
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string>("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-3xl border border-line bg-card/70 p-4">
      <p className="mb-3 text-sm text-muted">Уведомления (Email + Telegram)</p>

      <div className="mb-3 rounded-xl border border-line bg-[#031325] p-3 text-xs text-muted">
        <p>Telegram: отправьте боту команду `/start {loginHint}` чтобы привязать чат к вашему аккаунту.</p>
        <p className="mt-1">После этого уведомления и тестовые отправки будут приходить в Telegram.</p>
        <p className="mt-1">Команды бота: `/help`, `/status`, `/stop`, `/resume`.</p>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email для уведомлений"
          className="h-10 w-full rounded-xl border border-line bg-[#04111f] px-3 text-sm text-text outline-none transition focus:border-accent"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage("");
              const fd = new FormData();
              fd.append("email", email);
              const result = await addNotificationEmailAction(fd);
              if (!result.ok) {
                setMessage(result.error || "Ошибка добавления email");
                return;
              }
              setEmail("");
              setMessage("Email добавлен в получатели уведомлений.");
            })
          }
          className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-[#00131f] transition hover:brightness-110 disabled:opacity-60"
        >
          Добавить email
        </button>
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
          className="h-10 rounded-xl border border-line bg-[#04111f] px-4 text-sm text-text transition hover:border-accent disabled:opacity-60"
        >
          Тест уведомлений (email + tg)
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
          className="h-10 rounded-xl border border-line bg-[#04111f] px-4 text-sm text-text transition hover:border-accent disabled:opacity-60"
        >
          Запустить рассылку сейчас
        </button>
      </div>

      {message && <p className="mb-3 text-xs text-muted">{message}</p>}

      <div className="space-y-2">
        {recipients.length === 0 && <p className="text-xs text-muted">Получателей пока нет.</p>}
        {recipients.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-[#031325] p-3 text-xs text-muted">
            <p>Email: {r.email || "-"}</p>
            <p>Telegram: {r.telegramUsername ? `@${r.telegramUsername}` : r.telegramChatId || "-"}</p>
            <p>Активен: {r.isActive ? "Да" : "Нет"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
