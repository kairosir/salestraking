# SalesTracker

Сервис учета продаж с Neon PostgreSQL и обязательной авторизацией.

## Что реализовано

- Вход только по логину/паролю (Google/Apple отключены)
- После успешного входа пользователь попадает на таблицу продаж
- Таблица продаж и мобильный UX:
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
- Личный кабинет `/account`:
  - мой заработок (сумма маржи)
  - моя выручка
  - последние мои записи
  - смена пароля

## Стек

- Next.js 15
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

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET` (рекомендуется тем же значением, что и `AUTH_SECRET`)
- `NEXTAUTH_URL`

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

## Тестовые доступы после seed

- `admin / admin12345`
- `test / test1234`

## Проверка состояния

Открой `/api/health`:

- `db: "ok"` — БД подключена
- `auth.credentials: true` — credentials auth активен

## Автопуш и автодеплой

- После каждого `git commit` срабатывает `post-commit` hook и делает `git push`.
- GitHub Actions workflow `.github/workflows/vercel-deploy.yml` выполняет деплой в Vercel.
