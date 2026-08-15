'use client';

import { useEffect, useState } from 'react';

interface PlanRow {
  rowNumber: number;
  date: string;
  type: string;
  title: string;
  token: string;
  status: string;
}

const TYPE_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  новость: { emoji: '📰', label: 'Новость', color: 'type-news' },
  кейс: { emoji: '💼', label: 'Кейс', color: 'type-case' },
  фича: { emoji: '⚡', label: 'Фича', color: 'type-feature' },
};

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function weekday(date: string): string {
  const [d, m, y] = date.split('.').map(Number);
  if (!d || !m || !y) return '';
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export default function PlanPage() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);

  useEffect(() => {
    fetch('/api/plan').then((r) => r.json()).then(setRows);
  }, []);

  return (
    <>
      <h1>Контент-план</h1>
      <p className="sub">{rows ? `${rows.length} постов запланировано` : 'Загрузка…'}</p>

      {rows && rows.length === 0 && (
        <div className="empty">План пуст — новости добавляют себя сами, кейсы и фичи занеси через соответствующие разделы.</div>
      )}

      {rows?.map((r) => {
        const info = TYPE_INFO[r.type] ?? { emoji: '📌', label: r.type, color: '' };
        return (
          <div className={`plan-card ${info.color}`} key={r.rowNumber}>
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
              <div className={`plan-card-title ${r.title ? '' : 'empty-title'}`}>
                {r.title || (r.type === 'кейс' && r.token ? `кейс по токену ${r.token.slice(0, 8)}…` : 'автовыбор — бот решит сам')}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
