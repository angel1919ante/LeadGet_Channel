'use client';

import { useEffect, useState } from 'react';

interface CaseDetail { client: string; niche: string; sent: number; leads: number; conversion: number }
interface FeatureDetail { problem: string; description: string }
interface NewsDetail { approvedCount: number }

interface PlanRow {
  rowNumber: number;
  date: string;
  type: string;
  title: string;
  token: string;
  data: string;
  post: string;
  postUrl: string;
  status: string;
  detail?: CaseDetail | FeatureDetail | NewsDetail;
}

const TYPE_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  новость: { emoji: '📰', label: 'Новость', color: 'type-news' },
  кейс: { emoji: '💼', label: 'Кейс', color: 'type-case' },
  фича: { emoji: '⚡', label: 'Фича', color: 'type-feature' },
};

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function parseDMY(date: string): Date | null {
  const [d, m, y] = date.split('.').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function weekday(date: string): string {
  const dt = parseDMY(date);
  return dt ? WEEKDAYS[dt.getDay()] : '';
}

// Понедельник той недели, куда попадает дата — ключ для группировки.
function weekStart(date: string): Date | null {
  const dt = parseDMY(date);
  if (!dt) return null;
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(dt);
  start.setDate(dt.getDate() + diff);
  return start;
}

function weekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} — ${end.getDate()} ${MONTHS[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} — ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

function readWithPhoto(dataStr: string): boolean {
  try {
    const d = dataStr ? JSON.parse(dataStr) : {};
    return d.withPhoto !== false;
  } catch {
    return true;
  }
}

interface CaseAssets { withPhoto: boolean; boardPosted?: boolean; chatPosted?: boolean }

function readCaseAssets(dataStr: string): CaseAssets {
  try {
    const d = dataStr ? JSON.parse(dataStr) : {};
    return { withPhoto: d.withPhoto !== false, boardPosted: d.boardPosted, chatPosted: d.chatPosted };
  } catch {
    return { withPhoto: true };
  }
}

// Алерт про превью/диалоги — только для уже опубликованных кейсов.
// До публикации это просто состояние переключателя "с фото/без фото",
// не повод пугать.
function CaseAssetsAlert({ r }: { r: PlanRow }) {
  if (r.type !== 'кейс' || r.status !== 'posted') return null;
  const a = readCaseAssets(r.data);
  if (!a.withPhoto) {
    return <p className="plan-card-alert">⚠️ Опубликовано без превью и диалогов (выбрано "без фото")</p>;
  }
  const missing: string[] = [];
  if (a.boardPosted === false) missing.push('превью');
  if (a.chatPosted === false) missing.push('диалоги');
  if (missing.length === 0) return null;
  return <p className="plan-card-alert">⚠️ Не запостились: {missing.join(', ')}</p>;
}

function Detail({ r }: { r: PlanRow }) {
  if (r.type === 'кейс' && r.detail && 'client' in r.detail) {
    const d = r.detail as CaseDetail;
    return (
      <p className="plan-card-detail">
        {d.niche && d.niche !== d.client ? `${d.niche} · ` : ''}
        {d.sent} отправлено · {d.leads} лидов · {d.conversion.toFixed(1)}% конверсия
      </p>
    );
  }
  if (r.type === 'фича' && r.detail && 'problem' in r.detail) {
    const d = r.detail as FeatureDetail;
    return (
      <p className="plan-card-detail">
        {d.problem && <>Проблема: {d.problem}<br /></>}
        {d.description}
      </p>
    );
  }
  if (r.type === 'новость' && r.detail && 'approvedCount' in r.detail) {
    const d = r.detail as NewsDetail;
    return (
      <p className="plan-card-detail">
        Бот выберет одну из {d.approvedCount} одобренных новостей в момент публикации
      </p>
    );
  }
  return null;
}

export default function PlanPage() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [publishing, setPublishing] = useState<Record<number, 'busy' | 'queued'>>({});

  useEffect(() => {
    fetch('/api/plan').then((r) => r.json()).then(setRows);
  }, []);

  const setWithPhoto = async (rowNumber: number, withPhoto: boolean) => {
    setRows((prev) => (prev ?? []).map((r) => {
      if (r.rowNumber !== rowNumber) return r;
      let data: Record<string, unknown> = {};
      try { data = r.data ? JSON.parse(r.data) : {}; } catch { /* пусто */ }
      data.withPhoto = withPhoto;
      return { ...r, data: JSON.stringify(data) };
    }));
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, withPhoto }),
    });
  };

  const publishNow = async (rowNumber: number) => {
    setPublishing((p) => ({ ...p, [rowNumber]: 'busy' }));
    const res = await fetch('/api/plan/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber }),
    });
    setPublishing((p) => ({ ...p, [rowNumber]: res.ok ? 'queued' : undefined as never }));
  };

  return (
    <>
      <h1>Контент-план</h1>
      <p className="sub">{rows ? `${rows.length} постов запланировано` : 'Загрузка…'}</p>

      {rows && rows.length === 0 && (
        <div className="empty">План пуст — новости добавляют себя сами, кейсы и фичи занеси через соответствующие разделы.</div>
      )}

      {rows?.map((r, i) => {
        const info = TYPE_INFO[r.type] ?? { emoji: '📌', label: r.type, color: '' };
        const caseClient = r.type === 'кейс' && r.detail && 'client' in r.detail ? (r.detail as CaseDetail).client : null;
        const fallbackTitle = r.title || caseClient || (r.type === 'кейс' && r.token ? `кейс по токену ${r.token.slice(0, 8)}…` : 'автовыбор — бот решит сам');

        const start = weekStart(r.date);
        const prevStart = i > 0 ? weekStart(rows[i - 1].date) : null;
        const isNewWeek = start && (!prevStart || start.getTime() !== prevStart.getTime());

        const publishState = publishing[r.rowNumber];
        const canPublish = r.status !== 'posted' && publishState !== 'queued';
        const withPhoto = readWithPhoto(r.data);

        return (
          <div key={r.rowNumber}>
            {isNewWeek && start && <div className="week-header">{weekLabel(start)}</div>}
            <div className={`plan-card ${info.color}`}>
              <div className="plan-card-date">
                <span className="plan-card-weekday">{weekday(r.date)}</span>
                <span className="plan-card-daynum">{r.date.slice(0, 2)}</span>
                <span className="plan-card-month">{r.date.slice(3, 5)}</span>
              </div>
              <div className="plan-card-emoji">{info.emoji}</div>
              <div className="plan-card-body">
                <div className="plan-card-top">
                  <span className="plan-card-type">{info.label}</span>
                  <span className={`status ${r.status || 'draft'}`}>{r.status || 'draft'}</span>
                </div>
                <div className="plan-card-title-row">
                  <div className={`plan-card-title ${r.title ? '' : 'empty-title'}`}>{fallbackTitle}</div>
                  {r.postUrl && (
                    <a className="btn ghost open-link" href={r.postUrl} target="_blank" rel="noreferrer">
                      Открыть
                    </a>
                  )}
                </div>
                <Detail r={r} />
                <CaseAssetsAlert r={r} />
                {r.status === 'posted' && r.post && (() => {
                  const clean = stripHtml(r.post).replace(/\s+/g, ' ').trim();
                  return <p className="plan-card-post">{clean.slice(0, 220)}{clean.length > 220 ? '…' : ''}</p>;
                })()}
                {r.status === 'error' && r.post && (
                  <p className="plan-card-post plan-card-error">{r.post}</p>
                )}

                <div className="plan-card-actions">
                  {r.type === 'кейс' && r.status !== 'posted' && (
                    <div className="photo-toggle">
                      <button
                        className={`photo-toggle-btn ${withPhoto ? 'active' : ''}`}
                        onClick={() => setWithPhoto(r.rowNumber, true)}
                      >
                        С фото
                      </button>
                      <button
                        className={`photo-toggle-btn ${!withPhoto ? 'active' : ''}`}
                        onClick={() => setWithPhoto(r.rowNumber, false)}
                      >
                        Без фото
                      </button>
                    </div>
                  )}

                  {canPublish && (
                    <button
                      className="btn approve publish-now"
                      disabled={publishState === 'busy'}
                      onClick={() => publishNow(r.rowNumber)}
                    >
                      {publishState === 'busy' ? <span className="spinner" /> : 'Опубликовать сейчас'}
                    </button>
                  )}
                  {publishState === 'queued' && (
                    <span className="publish-queued-note">Отправлено — появится в канале в течение минуты</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
