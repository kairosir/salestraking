"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Link2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createIdeaAction, deleteIdeaAction, updateIdeaAction } from "@/app/actions";

type IdeaItem = {
  id: string;
  title: string;
  description: string;
  links: string[];
  screenshots: string[];
  updatedAt: string;
};

function parseScreenshotList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("[")) return [trimmed];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [trimmed];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [trimmed];
  }
}

function serializeScreenshotList(list: string[]) {
  const normalized = list.map((item) => item.trim()).filter(Boolean);
  if (!normalized.length) return "";
  if (normalized.length === 1) return normalized[0];
  return JSON.stringify(normalized);
}

export function IdeasBoard({ ideas }: { ideas: IdeaItem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<IdeaItem[]>(ideas);
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linksText, setLinksText] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(ideas);
  }, [ideas]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items]);

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setLinksText("");
    setScreenshots([]);
    setFormOpen(true);
  };

  const openEdit = (item: IdeaItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description || "");
    setLinksText(item.links.join("\n"));
    setScreenshots(item.screenshots);
    setFormOpen(true);
  };

  const onSelectImages = (files: FileList | null) => {
    if (!files?.length) return;
    const jobs = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          if (!file.type.startsWith("image/")) {
            reject(new Error("not_image"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("read_failed"));
          reader.readAsDataURL(file);
        })
    );

    Promise.allSettled(jobs).then((results) => {
      const good = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter(Boolean);
      setScreenshots((prev) => [...prev, ...good]);
      if (results.some((r) => r.status === "rejected")) {
        setMessage("Некоторые файлы не удалось добавить");
      }
    });
  };

  const saveIdea = () => {
    startTransition(async () => {
      setMessage("");
      const fd = new FormData();
      fd.set("title", title);
      fd.set("description", description);
      fd.set("links", linksText);
      fd.set("screenshotsJson", serializeScreenshotList(screenshots));
      const result = editingId ? (fd.set("id", editingId), await updateIdeaAction(fd)) : await createIdeaAction(fd);
      if (!result.ok) {
        setMessage(result.error || "Ошибка сохранения");
        return;
      }
      setFormOpen(false);
      setEditingId(null);
      setTitle("");
      setDescription("");
      setLinksText("");
      setScreenshots([]);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[80px] w-full flex-col rounded-2xl border border-line bg-card/70 bg-panel px-2.5 py-2 text-left sm:h-28 sm:p-3.5"
      >
        <p className="inline-flex items-center gap-2 text-sm text-muted sm:text-sm">Идеи</p>
        <p className="mt-1 text-xl font-semibold leading-none text-text sm:mt-3 sm:text-xl">{sorted.length}</p>
      </button>

      {open && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[92] grid place-items-end bg-black/75 p-0 sm:place-items-center sm:p-4">
            <div className="h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-text">Идеи</h3>
                  <p className="text-sm text-muted">Предложения и ссылки для развития</p>
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
                  <p className="mb-1 text-xs font-semibold text-text">Название</p>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none transition focus:border-accent"
                    placeholder="Короткое название"
                  />

                  <p className="mb-1 mt-3 text-xs font-semibold text-text">Описание</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-accent"
                    placeholder="Описание идеи"
                  />

                  <p className="mb-1 mt-3 text-xs font-semibold text-text">Ссылки (несколько, каждая с новой строки)</p>
                  <textarea
                    value={linksText}
                    onChange={(e) => setLinksText(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-accent"
                    placeholder="https://..."
                  />

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-text"
                    >
                      <Upload size={14} /> Скриншоты
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        onSelectImages(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                    {screenshots.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {screenshots.map((shot, idx) => (
                          <div key={`idea-shot-${idx}`} className="overflow-hidden rounded-xl border border-line bg-bg">
                            <img src={shot} alt={`Идея ${idx + 1}`} className="h-24 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setScreenshots((prev) => prev.filter((_, i) => i !== idx))}
                              className="inline-flex h-8 w-full items-center justify-center border-t border-line text-xs text-red-300"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={saveIdea}
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
                {sorted.length === 0 && <p className="text-xs text-muted">Идей пока нет.</p>}
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
                          <p className="truncate text-sm text-text">{item.title}</p>
                        </div>
                        {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 border-t border-line pt-2">
                          <p className="whitespace-pre-wrap text-sm text-text">{item.description || "-"}</p>

                          {item.links.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.links.map((link, idx) => (
                                <a key={`${item.id}-link-${idx}`} href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent">
                                  <Link2 size={12} /> {link}
                                </a>
                              ))}
                            </div>
                          )}

                          {item.screenshots.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {item.screenshots.map((shot, idx) => (
                                <img key={`${item.id}-img-${idx}`} src={shot} alt={`idea-${idx + 1}`} className="h-24 w-full rounded-lg border border-line object-cover" />
                              ))}
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-line px-2 text-xs text-muted hover:text-text"
                            >
                              Изм
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                startTransition(async () => {
                                  const fd = new FormData();
                                  fd.set("id", item.id);
                                  const result = await deleteIdeaAction(fd);
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
          </div>,
          document.body
        )}
    </>
  );
}
