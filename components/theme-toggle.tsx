"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "salestraking:theme";
type Theme = "light" | "dark";

function applyTheme(nextTheme: Theme) {
  const root = document.documentElement;
  if (nextTheme === "dark") root.classList.add("theme-dark");
  else root.classList.remove("theme-dark");
  root.setAttribute("data-theme", nextTheme);
}

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const next: Theme = stored === "dark" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    setReady(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-10 items-center rounded-2xl border border-line bg-card text-sm text-muted transition hover:border-accent hover:text-text ${iconOnly ? "w-10 justify-center px-0" : "gap-2 px-3"}`}
      aria-label="Переключить тему"
      title={theme === "dark" ? "Светлая тема" : "Темная тема"}
      disabled={!ready}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {!iconOnly && <span>{theme === "dark" ? "Светлая" : "Темная"}</span>}
    </button>
  );
}
