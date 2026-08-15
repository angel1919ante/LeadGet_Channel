'use client';

import { useEffect, useState } from 'react';

interface PrefRow {
  updated: string;
  source: string;
  total: number;
  approved: number;
  rejected: number;
  trust: string;
  globalThreshold: string;
}

interface PostTypeSpec {
  key: string;
  emoji: string;
  title: string;
  color: string;
  logic: string[];
  structure: string[];
  markers: Array<{ e: string; label: string }>;
  volume: string;
}

const POST_TYPES: PostTypeSpec[] = [
  {
    key: 'новость',
    emoji: '📰',
    title: 'Новость',
    color: 'spec-news',
    logic: [
      'Слой 1 — Новость: что случилось в мире/рынке',
      'Слой 2 — Экспертиза: что это значит для сферы и аудитории',
      'Слой 3 — LeadGet: почему именно с нами работать в этом контексте (не реклама, а логичный вывод из экспертизы)',
    ],
    structure: [
      '🔔 Заголовок — коротко, конкретно, без кликбейта',
      'Слой 1: 2-3 предложения — что случилось, цифры, источник',
      '📊 Слой 2: заголовок блока + 3 пункта, что изменилось конкретно',
      '⚠️ Вывод — что это значит для рынка/МСП',
      'Блок-цитата — ключевой факт отдельным абзацем',
      'ℹ️ Слой 3: позиция LeadGet, 2-4 предложения',
      'CTA — мягкий вопрос + «Напишите @LeadGet_info 📱»',
    ],
    markers: [
      { e: '✔️', label: 'плюсы, подтверждение' },
      { e: '⚠️', label: 'риски, предупреждение' },
      { e: '📊', label: 'данные, цифры' },
      { e: '🔥', label: 'срочно' },
      { e: '💸', label: 'деньги, стоимость' },
      { e: '⚡', label: 'быстрый результат' },
      { e: '💡', label: 'инсайт, вывод' },
      { e: 'ℹ️', label: 'пояснение, позиция LeadGet' },
      { e: '↗️', label: 'рост, динамика' },
    ],
    volume: '800–1500 символов',
  },
  {
    key: 'кейс',
    emoji: '💼',
    title: 'Кейс',
    color: 'spec-case',
    logic: [
      'Контекст — ниша клиента, задача, почему стандартные каналы не подходили',
      'Механика — что конкретно настроили и запустили',
      'Результат — цифры, конверсии, стоимость лида, сравнение с рынком',
    ],
    structure: [
      '📊 Заголовок — «Кейс: ниша или тип задачи»',
      'Вводный абзац: 2-3 предложения — ниша, задача, почему стандартные каналы не подходили',
      '💡 База — откуда, сколько контактов, какой сегмент (масштаб — ключевая цифра)',
      '⚙️ Что сделали — 4 пункта конкретных действий',
      '↗️ Итоги за период — цифры блоком: отправлено / прочитали / ответили / квал. диалогов / конверсия в лид / цена лида',
      'Сравнение с рынком, если есть',
      '✉️ CTA — вопрос для похожей ниши + «Напишите @LeadGet_info 📱»',
    ],
    markers: [
      { e: '📊', label: 'заголовок кейса' },
      { e: '💡', label: 'база, охват' },
      { e: '⚙️', label: 'механика, действия' },
      { e: '↗️', label: 'итоги, рост' },
      { e: '✉️', label: 'CTA' },
    ],
    volume: '800–1500 символов',
  },
  {
    key: 'фича',
    emoji: '⚡',
    title: 'Фича',
    color: 'spec-feature',
    logic: [
      'Проблема — что раньше не работало или было неудобно',
      'Решение — что сделали, как это работает на практике',
      'Польза — конкретный результат для клиента, не технология ради технологии',
    ],
    structure: [
      '⚡️ Заголовок — суть фичи в одной строке',
      'Вводный абзац: 2-3 предложения — какая была проблема',
      '⚙️ Что изменилось — 4 пункта (что делает, как работает, результат, автоматически/без настроек)',
      'Блок-цитата — «Раньше было X, теперь Y»',
      'Доп. контекст — цифры по теме, если есть',
      'CTA — мягкое предложение попробовать + ссылка на сайт',
    ],
    markers: [
      { e: '✔️', label: 'плюсы, подтверждение' },
      { e: '⭐️', label: 'качество, важное' },
      { e: '💡', label: 'инсайт, понимание' },
      { e: '🎙', label: 'голос, аудио' },
      { e: '💎', label: 'ценность' },
      { e: '⚙️', label: 'механика, настройка' },
    ],
    volume: '800–1500 символов',
  },
];

const COMMON_BANS = [
  'Длинное тире (—) — только запятая, точка или двоеточие',
  'Клише: «важно отметить», «уникальный», «инновационный», «революционный», «это не X, это Y»',
  'Размытые источники («эксперты считают») — только конкретные имена и цифры',
  'Раздутая значимость: «знаменует», «символизирует», «переломный момент»',
  'Причастные обороты на -ing (подчёркивая, отражая, демонстрируя)',
  'Правило трёх без необходимости, театральные паузы, рубленые фразы для драмы',
  'Заголовки-секции внутри поста («Что это значит», «Вывод», «Итого»)',
  'Слово «лид» в тексте к читателю — только «клиент»',
  'Повтор одного и того же эмодзи в посте',
  'Буллеты не через • — под запретом',
  'Любой эмодзи, кроме разрешённого списка ниже',
];

const ALLOWED_EMOJI = ['🔔', '📊', '⚠️', '✔️', '💸', '⚡️', '⚡', '💡', 'ℹ️', '🛍', '💎', '📌', '🎙', '⭐️', '⚙️', '📈', '✉️', '🔥', '↗️', '💰', '🚀', '📱', '📉', '🔴', '🟢', '💯'];

const RELEVANCE_LEVELS = [
  { range: '8–10', label: 'Высокая', desc: 'Конкретное обновление рекламной платформы с цифрами, новый инструмент для лидогенерации/атрибуции, исследование рынка с данными, Telegram-маркетинг' },
  { range: '5–7', label: 'Средняя', desc: 'Общие маркетинговые тренды с данными, смежные темы (e-commerce, retention)' },
  { range: '1–4', label: 'Низкая', desc: 'Корпоративные новости без данных, SEO-теория, ивент-анонсы, колонки мнений, HR, дизайн' },
];

function PromptStructure() {
  return (
    <>
      <div className="explain-title" style={{ margin: '32px 0 14px' }}>Промпты и структура постов</div>
      <p className="sub" style={{ marginBottom: 20 }}>
        То, чем бот руководствуется при написании каждого поста — logика, обязательные блоки и разрешённые эмодзи.
      </p>

      {POST_TYPES.map((t) => (
        <details className={`spec-card ${t.color}`} key={t.key}>
          <summary>
            <span className="spec-emoji">{t.emoji}</span>
            <span className="spec-title">{t.title}</span>
            <span className="spec-volume">{t.volume}</span>
          </summary>

          <div className="spec-block">
            <div className="spec-label">Логика</div>
            <ul className="spec-list">{t.logic.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>

          <div className="spec-block">
            <div className="spec-label">Структура поста</div>
            <ol className="spec-list numbered">{t.structure.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>

          <div className="spec-block">
            <div className="spec-label">Эмодзи-маркеры</div>
            <div className="spec-markers">
              {t.markers.map((m, i) => (
                <span className="spec-marker" key={i}>{m.e} <span>{m.label}</span></span>
              ))}
            </div>
          </div>
        </details>
      ))}

      <details className="spec-card spec-shared">
        <summary>
          <span className="spec-emoji">🚫</span>
          <span className="spec-title">Общие запреты</span>
          <span className="spec-volume">для всех типов постов</span>
        </summary>
        <div className="spec-block">
          <ul className="spec-list">{COMMON_BANS.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
        <div className="spec-block">
          <div className="spec-label">Разрешённые эмодзи (все остальные под запретом)</div>
          <div className="spec-emoji-row">{ALLOWED_EMOJI.join(' ')}</div>
        </div>
      </details>

      <details className="spec-card spec-shared">
        <summary>
          <span className="spec-emoji">🎯</span>
          <span className="spec-title">Оценка релевантности новостей</span>
          <span className="spec-volume">при сборе кандидатов</span>
        </summary>
        <div className="spec-block">
          {RELEVANCE_LEVELS.map((l) => (
            <p className="spec-relevance" key={l.range}>
              <strong>{l.range} — {l.label}.</strong> {l.desc}
            </p>
          ))}
        </div>
      </details>

      <details className="spec-card spec-shared">
        <summary>
          <span className="spec-emoji">💬</span>
          <span className="spec-title">Саммари новости</span>
          <span className="spec-volume">простыми словами</span>
        </summary>
        <div className="spec-block">
          <ul className="spec-list">
            <li>2-3 предложения на русском, как объяснение другу</li>
            <li>Что случилось и почему это важно для предпринимателя/маркетолога</li>
            <li>Английские источники — переводятся по смыслу</li>
            <li>Без вводных фраз, без пафоса, без длинного тире</li>
          </ul>
        </div>
      </details>
    </>
  );
}

const TRUST_INFO: Record<string, { emoji: string; label: string; color: string; explain: (r: PrefRow) => string }> = {
  high: {
    emoji: '🟢',
    label: 'Доверяем',
    color: 'trust-high',
    explain: (r) => `Отсюда ${r.approved} новостей из ${r.total} были хорошими — бот берёт их сам, без вопросов к тебе`,
  },
  low: {
    emoji: '🔴',
    label: 'Не доверяем',
    color: 'trust-low',
    explain: (r) => `Отсюда только ${r.approved} из ${r.total} были хорошими — бот теперь придирчивее к новостям отсюда`,
  },
  normal: {
    emoji: '🟡',
    label: 'Присматриваемся',
    color: 'trust-normal',
    explain: (r) => `Мало решений (${r.total}) — бот ещё не понял, доверять этому источнику или нет`,
  },
};

export default function PreferencesPage() {
  const [rows, setRows] = useState<PrefRow[] | null>(null);

  useEffect(() => {
    fetch('/api/preferences').then((r) => r.json()).then(setRows);
  }, []);

  const threshold = Number(rows?.[0]?.globalThreshold ?? 7);
  const thresholdPct = Math.min(100, Math.max(0, (threshold / 10) * 100));

  return (
    <>
      <h1>Как бот выбирает новости</h1>
      <p className="sub">Обновляется само каждое воскресенье — смотрит на то, что ты одобрял и отклонял всю неделю</p>

      {rows && rows.length === 0 && (
        <div className="empty">Бот ещё ничему не научился — реши хотя бы несколько новостей в разделе «Новости», и в воскресенье он подстроится.</div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="explain-card">
            <div className="explain-title">Насколько бот придирчив прямо сейчас</div>
            <div className="gauge">
              <div className="gauge-track">
                <div className="gauge-fill" style={{ width: `${thresholdPct}%` }} />
                <div className="gauge-marker" style={{ left: `${thresholdPct}%` }}>{threshold}</div>
              </div>
              <div className="gauge-labels">
                <span>1 — пропускает почти всё</span>
                <span>10 — пропускает только лучшее</span>
              </div>
            </div>
            <p className="explain-text">
              Каждой новости бот сам ставит оценку от 1 до 10. Если оценка выше {threshold} — новость проходит.
              Чем больше ты одобряешь новостей, тем точнее бот подбирает эту планку сам.
            </p>
          </div>

          <div className="explain-title" style={{ margin: '32px 0 14px' }}>Каким источникам бот доверяет</div>

          {rows.map((r) => {
            const info = TRUST_INFO[r.trust] ?? TRUST_INFO.normal;
            return (
              <div className={`trust-card ${info.color}`} key={r.source}>
                <div className="trust-emoji">{info.emoji}</div>
                <div className="trust-body">
                  <div className="trust-top">
                    <span className="trust-source">{r.source}</span>
                    <span className="trust-label">{info.label}</span>
                  </div>
                  <p className="trust-explain">{info.explain(r)}</p>
                </div>
              </div>
            );
          })}
        </>
      )}

      <PromptStructure />
    </>
  );
}
