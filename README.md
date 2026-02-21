# SalesTracker

Современный мини-сервис для учета продаж с авторизацией и Neon PostgreSQL.

## Что реализовано

- Личный кабинет
  - вход по логину/паролю (Credentials)
  - вход через Google
  - вход через Apple
- Таблица продаж и удобная мобильная форма
- Поля:
  - имя клиента
  - телефон клиента
  - товар
  - ссылка на товар
  - размер
  - количество
  - цена товара
  - цена продажи
  - маржа (считается автоматически)
- Аудит изменений:
  - кто добавил запись
  - кто последний изменил запись

## Стек

- Next.js 15 (App Router, Server Actions)
- NextAuth v5
- Prisma
- Neon PostgreSQL
- Tailwind CSS

## Запуск

1. Установите зависимости:

```bash
npm install
```

2. Скопируйте env:

```bash
cp .env.example .env
```

3. Заполните `.env`:

- `DATABASE_URL` из Neon
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (`http://localhost:3000` локально)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `APPLE_ID` / `APPLE_SECRET`

4. Создайте таблицы в БД:

```bash
npm run prisma:push
npm run prisma:generate
```

5. Создайте тестового пользователя (логин/пароль):

```bash
npm run db:seed
```

Демо-логин после seed:

- login: `admin` или `admin@salestracker.local`
- password: `admin12345`

6. Запустите проект:

```bash
npm run dev
```

## OAuth callback URLs

Для Google и Apple в настройках провайдера укажите callback:

`http://localhost:3000/api/auth/callback/google`

`http://localhost:3000/api/auth/callback/apple`

Для продакшена замените домен на ваш Vercel URL.

## Автопуш в GitHub

В репозитории включен `post-commit` hook через `core.hooksPath=.githooks`.

Что это дает:

- после каждого `git commit` автоматически выполняется `git push` в текущую ветку

Дополнительно есть скрипт:

```bash
./scripts/auto-sync.sh "your commit message"
```

Он делает `add + commit + push` одной командой.

## Автодеплой из GitHub в Vercel

Добавлен workflow:

- `.github/workflows/vercel-deploy.yml`

Поведение:

- push в `main` -> production deploy в Vercel
- pull request в `main` -> preview deploy в Vercel

Нужно добавить GitHub Secrets в репозитории (`Settings` -> `Secrets and variables` -> `Actions`):

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Также в Vercel должен быть создан и привязан проект к этому репозиторию.
