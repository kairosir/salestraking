"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/actions";

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-[#031325] px-3 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        setMessage(null);
        setError(null);

        startTransition(async () => {
          try {
            await changePasswordAction(formData);
            setMessage("Пароль обновлен");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось изменить пароль");
          }
        });
      }}
      className="space-y-3"
    >
      <input className={inputClass} name="currentPassword" type="password" placeholder="Текущий пароль" required />
      <input className={inputClass} name="newPassword" type="password" placeholder="Новый пароль (минимум 8 символов)" required />
      <input className={inputClass} name="confirmPassword" type="password" placeholder="Повторите новый пароль" required />

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-[#00131f] transition hover:brightness-110 disabled:opacity-70"
      >
        {pending ? "Сохранение..." : "Сменить пароль"}
      </button>

      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </form>
  );
}
