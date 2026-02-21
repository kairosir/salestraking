# SalesTracker

Современный сервис учета продаж с Neon PostgreSQL и авторизацией.

## Что реализовано

- Личный кабинет:
  - логин/пароль (Credentials)
  - Google OAuth (если ключи заданы)
  - Apple OAuth (если ключи заданы)
- Таблица продаж с мобильным UX:
  - поиск
  - фильтр по автору
  - сортировка (новые/старые/маржа/выручка)
  - мобильные режимы `карточки/список`
- Поля продажи:
  - имя клиента
  - номер телефона
  - товар
  - ссылка на товар
  - размер
  - количество
  - цена товара
  - цена продажи
  - маржа (авторасчет)
- Аудит:
  - кто добавил
  - кто изменил

## Стек

- Next.js 15 (App Router, Server Actions)
- NextAuth v5
- Prisma
- Neon PostgreSQL
- Tailwind CSS

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Подготовить env:

```bash
cp .env.example .env
```

3. Заполнить `.env`:

- `DATABASE_URL` из Neon
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (`http://localhost:3000` локально)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (опционально)
- `APPLE_ID` / `APPLE_SECRET` (опционально)

4. Инициализировать БД:

```bash
npm run prisma:push
npm run prisma:generate
npm run db:seed
```

5. Запустить:

```bash
npm run dev
```

## Проверка подключения Neon/Auth

После запуска открой:

- `/api/health`

Ожидаемо:

- `db: "ok"` — Neon подключен
- `auth.google/auth.apple` — видно, какие OAuth-провайдеры реально активны

## Подключение .env в Vercel

### Вариант A: через Vercel Dashboard

В проекте Vercel `Settings -> Environment Variables` добавь:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (например, `https://salestraking.vercel.app`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (если нужен Google login)
- `APPLE_ID` / `APPLE_SECRET` (если нужен Apple login)

### Вариант B: синхронизация из локального `.env`

Требуется установленный Vercel CLI и `VERCEL_TOKEN`.

```bash
export VERCEL_TOKEN="your_token"
npm run vercel:env:sync
```

Для preview-среды:

```bash
npm run vercel:env:sync:preview
```

## OAuth callback URLs

Для продакшена в Google/Apple укажи callback:

- `https://<your-domain>/api/auth/callback/google`
- `https://<your-domain>/api/auth/callback/apple`

## Автопуш и автодеплой

- После каждого `git commit` срабатывает `post-commit` hook и делает `git push`.
- GitHub Actions workflow `.github/workflows/vercel-deploy.yml` выполняет деплой в Vercel.
