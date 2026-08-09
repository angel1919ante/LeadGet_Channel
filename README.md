# LeadGet Channel Bot

Контент-система для Telegram-канала [@Leadget_channel](https://t.me/Leadget_channel): новости рынка, кейсы клиентов LeadGet, посты про фичи продукта. Модерация через Google Sheets, публикация от лица пользователя через MTProto (полное HTML-форматирование: blockquote, анимированные эмодзи).

## Архитектура

Три независимых слоя данных в одной Google-таблице:

**News** — сырые новости. `collect.ts` (ежедневно 10:00 МСК) собирает кандидатов из Habr/Cossa/Reddit, LLM оценивает релевантность (порог подстраивается через `learn.ts`/`Preferences`, доверие по источнику), пишет `pending`. Человек в таблице ставит `approved`/`rejected`.

**ContentPlan** — план публикаций по дням: `Дата | Тип (новость/кейс/фича) | Токен | Данные | Статус`. Человек добавляет строку на нужную дату со статусом `approved`. `caseScanner.ts` делает это автоматически для кейсов LeadGet с хорошей статистикой.

**AutoPosts** — журнал реальных публикаций (дедуп, чтобы не постить дважды).

`autopost.ts` — часовой крон (10:00–20:00 МСК). Ищет в `ContentPlan` approved-строку на сегодня:
- **новость** — берёт самую высокорейтинговую `approved` строку из `News`, генерирует пост (с учётом tone of voice — см. ниже), после публикации ставит `posted` и в `News`, и в `ContentPlan`.
- **кейс** — тянет статистику кампании из LeadGet API (`caseGen.ts`), собирает пост с реальными цифрами.
- **фича** — пост про продуктовое улучшение из `Features`/данных плана.

Готовый пост форматируется (`formatter.ts`: `[QUOTE]`→blockquote, эмодзи→анимированные), генерируется картинка (Replicate Flux, если `SKIP_IMAGE!=true`) и публикуется в `POST_CHANNEL` через `mtproto.ts`.

## Tone of voice

`toneSamples.ts` перед каждой генерацией поста тянет последние сообщения из Telegram (через тот же MTProto-аккаунт): 5 постов из своего канала и несколько из обучающих каналов. Промпт держит 70% голоса из своих постов, адаптирует приёмы из обучающих — не копирует.

## Обучение на решениях человека

`learn.ts` (по воскресеньям) читает все решённые строки `News` (`approved`/`posted`/`rejected`), считает по каждому источнику одобряемость, находит оптимальный порог релевантности и доверие к источнику (high/normal/low). Пишет в лист `Preferences`. `collect.ts` читает эти данные и подстраивает порог на лету: доверенным источникам — снижает планку, недоверенным — повышает. Цель — к осени сократить ручную модерацию.

## Статьи и кейс-кандидаты (опционально)

- `articles.ts` (раз в 3 дня) — для новостей, у которых в колонке «Статья» выбрана площадка (habr/vc/dzen/x/все), генерирует статью под требования площадки и присылает в личку на проверку.
- `caseScanner.ts` — сканирует кампании клиентов LeadGet, кандидатов с хорошей статистикой добавляет в `Cases`, одобренные (`add to plan`) сам ставит в `ContentPlan`.

## Legacy: publish.ts

Более ранняя версия пайплайна: читает `News.approved`, шлёт готовый пост личным сообщением в Telegram (`TELEGRAM_USER_ID`) для ручной проверки — **не публикует в канал**, ставит `posted`. Автозапуска по расписанию сейчас нет (можно вызвать вручную через `workflow_dispatch -f job=publish`). Оставлен как резервный канал предпросмотра, не основной путь публикации.

## Настройка (один раз)

### 1. Google Sheets

1. Создать таблицу, первый лист переименовать в `News`.
2. Скопировать ID из URL.
3. Создать Google Service Account (Google Cloud Console → Sheets API → IAM → Service Accounts → JSON-ключ).
4. Дать доступ email из JSON (`client_email`) на таблицу как редактору.

Остальные листы (`ContentPlan`, `AutoPosts`, `Features`, `Cases`, `Preferences`, `Articles`) создаются скриптами автоматически (`npm run init-sheets`).

### 2. Telegram

Нужны ОБА механизма:
- **Bot API** (для `publish.ts`, личные уведомления): токен от @BotFather → `TELEGRAM_BOT_TOKEN`, свой user id → `TELEGRAM_USER_ID`.
- **MTProto** (для реальной публикации от своего имени): `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` с https://my.telegram.org, залогиненная `TELEGRAM_SESSION` (StringSession).

### 3. OpenRouter

Ключ с https://openrouter.ai/. Модель по умолчанию `anthropic/claude-haiku-4.5` (`OPENROUTER_MODEL`).

### 4. Прочее

- `POST_CHANNEL` — канал для реальной публикации (сейчас тестовый `@LeadGet_reviews`).
- `REPLICATE_API_TOKEN` — генерация картинок (Flux).
- `LEADGET_ADMIN_TOKEN` — доступ к LeadGet API для кейсов.

### 5. GitHub Secrets/Variables

| Secret | Назначение |
|---|---|
| `OPENROUTER_API_KEY` | LLM |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_USER_ID` | личные уведомления (legacy publish) |
| `TELEGRAM_SESSION` / `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | реальная публикация + tone samples |
| `REPLICATE_API_TOKEN` | картинки |
| `LEADGET_ADMIN_TOKEN` | скан кейсов |
| `GOOGLE_SHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_JSON` | таблица |
| `POST_CHANNEL` (Variable) | канал публикации |
| `OPENROUTER_MODEL` (Variable, опц.) | модель |

## Локальный запуск

```bash
npm install
npm run collect         # собрать новости
npm run autopost        # выполнить сегодняшний план (или TEST_CASE_TOKEN=... для теста кейса)
npm run learn           # пересчитать пороги/доверие
npm run scan-cases      # найти кандидатов на кейс-посты
npm run generate:articles
npm run publish         # legacy: ЛС-уведомление, не публикация
```

## Workflows

- `main.yml` — `collect`+`scan-cases` ежедневно 10:00 МСК, `learn` по воскресеньям 11:00 МСК, `publish` только вручную.
- `autopost.yml` — `post` ежечасно 10:00–20:00 МСК (боевая публикация), плюс ручные `init-sheets`/`scan-cases`/`test-case`/`learn`.
- `articles.yml` — раз в 3 дня.
