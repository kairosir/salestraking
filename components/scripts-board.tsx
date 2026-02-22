"use client";

import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type ScriptItem = {
  id: string;
  question: string;
  answer: string;
  updatedAt: string;
};

const STORAGE_KEY = "salestraking:scripts:v1";

function loadScripts(): ScriptItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScriptItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveScripts(items: ScriptItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function ScriptsBoard() {
  const [items, setItems] = useState<ScriptItem[]>(() => loadScripts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const sorted = useMemo(() => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items]);

  const resetForm = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
  };

  const upsert = () => {
    const q = question.trim();
    const a = answer.trim();
    if (!q && !a) return;

    const nextItem: ScriptItem = {
      id: editingId || Math.random().toString(36).slice(2),
      question: q || "Без вопроса",
      answer: a || "",
      updatedAt: new Date().toISOString()
    };

    const next = editingId ? items.map((item) => (item.id === editingId ? nextItem : item)) : [nextItem, ...items];
    setItems(next);
    saveScripts(next);
    resetForm();
  };

  return (
    <section className="rounded-3xl border border-line bg-card/70 bg-panel p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text">Скрипты</p>
          <p className="text-xs text-muted">Шаблоны ответов клиенту. Можно добавить, изменить, удалить и копировать в 1 клик.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-3">
        <p className="mb-1 text-xs font-semibold text-text">Вопрос клиента</p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-accent"
          placeholder="Например: Когда отправите заказ?"
        />

        <p className="mb-1 mt-3 text-xs font-semibold text-text">Ответ</p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-accent"
          placeholder="Ваш готовый ответ"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={upsert} className="btn-primary inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold">
            {editingId ? <Save size={14} /> : <Plus size={14} />} {editingId ? "Сохранить" : "Добавить"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text">
              <X size={14} /> Отмена
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {sorted.length === 0 && <p className="text-xs text-muted">Скриптов пока нет.</p>}
        {sorted.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-card p-3">
            <p className="text-xs text-muted">Вопрос клиента</p>
            <p className="text-sm text-text">{item.question}</p>

            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted">Ответ</p>
                <p className="whitespace-pre-wrap text-sm text-text">{item.answer || "-"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(item.question || "")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-text"
                  title="Копировать вопрос"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(item.answer || "")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-text"
                  title="Копировать ответ"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id);
                    setQuestion(item.question);
                    setAnswer(item.answer);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-text"
                  title="Изменить"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = items.filter((x) => x.id !== item.id);
                    setItems(next);
                    saveScripts(next);
                    if (editingId === item.id) resetForm();
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-red-300 hover:border-red-400"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
