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
- Авто-трекинг 17TRACK:
  - берется из поля `Трек-код`
  - первый чек через 2 дня, затем каждые 4 дня до прибытия в страну
  - история проверок трек-кода сохраняется в БД
  - один трек-код проверяется один раз за цикл (без дублей)
  - статус/подстатус и последнее событие в карточке товара
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
- `tracking.enabled: true` — ключ 17TRACK установлен

## 17TRACK

1. Получи API key в кабинете 17TRACK.
2. Добавь в `.env` и Vercel:
   - `TRACK17_API_KEY`
   - `TRACK17_BASE_URL=https://api.17track.net/track/v2.4`
   - `TRACK17_SYNC_LIMIT=20`
   - `TRACK17_FIRST_CHECK_DAYS=2`
   - `TRACK17_RECHECK_DAYS=4`
3. Cron может бить в:
   - `/api/notifications/run` (уведомления + трекинг)
   - или отдельно `/api/tracking/run`
4. Для ручной проверки: `GET /api/tracking/run?secret=NOTIFY_MANUAL_SECRET`.

## Автопуш и автодеплой

- После каждого `git commit` срабатывает `post-commit` hook и делает `git push`.
- GitHub Actions workflow `.github/workflows/vercel-deploy.yml` выполняет деплой в Vercel.

## Автобэкап БД

- Workflow: `.github/workflows/db-backup.yml`
- Частота: каждые 6 часов (cron `15 */6 * * *`) + ручной запуск через `workflow_dispatch`.
- Источник: `secrets.DATABASE_URL` (в GitHub репозитории).
- Результат: SQL backup (`.sql.gz`) + checksum (`.sha256`) в GitHub Actions Artifacts (retention 30 дней).

### Восстановление из бэкапа

1. Скачать нужный artifact из вкладки `Actions` → `Database Backup`.
2. Распаковать:
   - `gunzip neon-backup_YYYY-MM-DD_HH-MM-SS.sql.gz`
3. Восстановить в нужную БД:
   - `psql "$DATABASE_URL" -f neon-backup_YYYY-MM-DD_HH-MM-SS.sql`
