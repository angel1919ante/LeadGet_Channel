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

export default function PreferencesPage() {
  const [rows, setRows] = useState<PrefRow[] | null>(null);

  useEffect(() => {
    fetch('/api/preferences').then((r) => r.json()).then(setRows);
  }, []);

  const threshold = rows?.[0]?.globalThreshold;

  return (
    <>
      <h1>Настройки автоподбора</h1>
      <p className="sub">Доверие к источникам новостей, из листа Preferences (считает learn.ts по воскресеньям)</p>

      {rows && rows.length === 0 && (
        <div className="empty">Пока пусто — learn.ts ещё не считал предпочтения.</div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="card">
            <div className="card-top">ГЛОБАЛЬНЫЙ ПОРОГ РЕЛЕВАНТНОСТИ</div>
            <h3>{threshold}</h3>
            <p>Новость проходит автоматически, если её оценка LLM выше этого порога (для доверенных источников — ниже).</p>
          </div>
          {rows.map((r) => (
            <div className="card" key={r.source}>
              <div className="card-top">
                <span>{r.source}</span>
                <span className={`status ${r.trust === 'high' ? 'approved' : r.trust === 'low' ? 'rejected' : 'draft'}`}>
                  {r.trust}
                </span>
              </div>
              <p>{r.approved} одобрено / {r.rejected} отклонено из {r.total} решённых</p>
            </div>
          ))}
        </>
      )}
    </>
  );
}
