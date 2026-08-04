# LeadGet Channel Bot

Автопостинг новостей из ниши AI/ML с Хабра и Reddit r/MachineLearning в Telegram-канал [@Leadget_channel](https://t.me/Leadget_channel) с ручной модерацией через Google Sheets.

## Флоу

- **08:00 МСК** — GitHub Actions собирает новых кандидатов (Хабр рейтинг ≥50, Reddit ≥500 upvotes), генерирует краткое саммари через OpenRouter (Claude Haiku), записывает в Google Sheets со статусом `pending`.
- **В течение дня** — вы читаете таблицу, ставите `approved` или `rejected` в столбце «Статус».
- **18:00 МСК** — GitHub Actions берёт строки с `approved`, генерирует полноценный пост по ТЗ LeadGet и публикует в канал, статус меняется на `posted`.

## Настройка (один раз)

### 1. Google Sheets

1. Создать таблицу в Google Sheets. Первый лист переименовать в `News`.
2. Скопировать её ID из URL (`https://docs.google.com/spreadsheets/d/ЭТОТ_ID/edit`).
3. Создать Google Service Account:
   - Console: https://console.cloud.google.com/ → создать проект → включить `Google Sheets API`.
   - IAM & Admin → Service Accounts → Create → Keys → Add key → JSON. Скачать файл.
4. Открыть таблицу → «Настройки доступа» → добавить email из service account JSON (поле `client_email`) с правами редактора.

Скрипт сам создаст заголовки при первом запуске.

### 2. Telegram

1. Бот уже создан у вас через @BotFather. Токен вида `123456:ABC...`.
2. Добавить бота в канал администратором с правом публикации.
3. `TELEGRAM_CHANNEL_ID` — либо `@Leadget_channel`, либо числовой ID канала (`-100...`).

### 3. OpenRouter

Ключ с https://openrouter.ai/. Модель по умолчанию: `anthropic/claude-haiku-4.5` (можно поменять через переменную окружения `OPENROUTER_MODEL`).

### 4. GitHub Secrets

В настройках репозитория → Settings → Secrets and variables → Actions → New repository secret. Добавить:

| Secret | Значение |
|---|---|
| `OPENROUTER_API_KEY` | ключ OpenRouter |
| `TELEGRAM_BOT_TOKEN` | токен бота от BotFather |
| `TELEGRAM_CHANNEL_ID` | `@Leadget_channel` или `-100...` |
| `GOOGLE_SHEET_ID` | ID таблицы |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | всё содержимое JSON-файла целиком |

Опционально (Variables, не Secrets):

| Variable | По умолчанию |
|---|---|
| `OPENROUTER_MODEL` | `anthropic/claude-haiku-4.5` |

### 5. Первый запуск

Actions → LeadGet Channel Bot → Run workflow → выбрать `collect`. Проверить, что в таблице появились строки.

## Локальный запуск (для отладки)

```bash
npm install
export OPENROUTER_API_KEY=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHANNEL_ID=...
export GOOGLE_SHEET_ID=...
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"

npm run collect   # собрать кандидатов
npm run publish   # опубликовать approved
```

## Структура таблицы

| Дата | Источник | Заголовок | Саммари | Пост | Ссылка | Рейтинг | Статус |
|---|---|---|---|---|---|---|---|

Статусы: `pending` → вы ставите `approved` / `rejected` → скрипт публикует и ставит `posted` (или `error` при сбое).

## Настройки фильтрации

В `src/sources.ts`:
- `HABR_MIN_RATING = 50`
- `REDDIT_MIN_UPS = 500`
- `HABR_HUBS = [...]` — список хабов Хабра

Меняются одной цифрой, если потока слишком много или слишком мало.
