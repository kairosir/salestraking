"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, Save, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createScriptAction, deleteScriptAction, updateScriptAction } from "@/app/actions";

type ScriptItem = {
  id: string;
  question: string;
  answer: string;
  updatedAt: string;
};

export function ScriptsBoard({ scripts }: { scripts: ScriptItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<ScriptItem[]>(scripts);
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(scripts);
  }, [scripts]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items]);

  const openCreate = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setFormOpen(true);
  };

  const openEdit = (item: ScriptItem) => {
    setEditingId(item.id);
    setQuestion(item.question);
    setAnswer(item.answer);
    setFormOpen(true);
  };

  const saveScript = () => {
    startTransition(async () => {
      setMessage("");
      const fd = new FormData();
      fd.set("question", question);
      fd.set("answer", answer);
      const result = editingId ? (fd.set("id", editingId), await updateScriptAction(fd)) : await createScriptAction(fd);
      if (!result.ok) {
        setMessage(result.error || "Ошибка сохранения");
        return;
      }
      setFormOpen(false);
      setEditingId(null);
      setQuestion("");
      setAnswer("");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[86px] w-full flex-col rounded-2xl border border-line bg-card/70 bg-panel p-3 text-left sm:h-28 sm:p-3.5"
      >
        <p className="inline-flex items-center gap-2 text-xs text-muted sm:text-sm">Скрипты</p>
        <p className="mt-2 text-lg font-semibold leading-none text-text sm:mt-3 sm:text-xl">{sorted.length}</p>
      </button>

      {open && mounted &&
        createPortal(
        <div className="fixed inset-0 z-[90] grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
          <div className="h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-text">Скрипты</h3>
                <p className="text-sm text-muted">Готовые ответы клиентам</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-muted transition hover:bg-card hover:text-text">
                <X size={20} />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button type="button" onClick={openCreate} className="btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold">
                <Plus size={14} /> Добавить
              </button>
            </div>

            {formOpen && (
              <div className="mb-3 rounded-2xl border border-line bg-card p-3">
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
                  <button
                    type="button"
                    disabled={pending}
                    onClick={saveScript}
                    className="btn-primary inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-60"
                  >
                    <Save size={14} /> {editingId ? "Сохранить" : "Добавить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormOpen(false);
                      setEditingId(null);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {message && <p className="mb-3 text-xs text-muted">{message}</p>}

            <div className="space-y-2">
              {sorted.length === 0 && <p className="text-xs text-muted">Скриптов пока нет.</p>}
              {sorted.map((item) => {
                const isExpanded = expanded[item.id] ?? false;
                return (
                  <div key={item.id} className="rounded-xl border border-line bg-card p-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [item.id]: !isExpanded }))}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Вопрос клиента</p>
                        <p className="truncate text-sm text-text">{item.question}</p>
                      </div>
                      {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 border-t border-line pt-2">
                        <p className="text-xs text-muted">Ответ</p>
                        <p className="whitespace-pre-wrap text-sm text-text">{item.answer || "-"}</p>

                        <div className="mt-2 flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(item.answer || "")}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-line px-2 text-xs text-muted hover:text-text"
                            title="Копировать ответ"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-line px-2 text-xs text-muted hover:text-text"
                            title="Изменить"
                          >
                            Изм
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              startTransition(async () => {
                                const fd = new FormData();
                                fd.set("id", item.id);
                                const result = await deleteScriptAction(fd);
                                if (!result.ok) {
                                  setMessage(result.error || "Не удалось удалить");
                                  return;
                                }
                                router.refresh();
                              });
                            }}
                            disabled={pending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-red-300 hover:border-red-400"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
