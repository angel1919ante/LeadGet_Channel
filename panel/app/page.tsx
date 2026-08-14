'use client';

import { useEffect, useState } from 'react';

interface NewsRow {
  rowNumber: number;
  date: string;
  source: string;
  title: string;
  summary: string;
  link: string;
  rating: number;
  status: string;
}

export default function NewsPage() {
  const [rows, setRows] = useState<NewsRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    fetch('/api/news').then((r) => r.json()).then(setRows);
  };

  useEffect(load, []);

  const decide = async (rowNumber: number, status: 'approved' | 'rejected') => {
    setBusy(rowNumber);
    await fetch('/api/news', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, status }),
    });
    setRows((prev) => (prev ?? []).filter((r) => r.rowNumber !== rowNumber));
    setBusy(null);
  };

  return (
    <>
      <h1>Очередь новостей</h1>
      <p className="sub">
        {rows ? `${rows.length} на рассмотрении` : 'Загрузка…'}
      </p>

      {rows && rows.length === 0 && (
        <div className="empty">Пусто. Новые кандидаты появятся после следующего сбора.</div>
      )}

      {rows?.map((r) => (
        <div className="card" key={r.rowNumber}>
          <div className="card-top">
            <span className="pill date">{r.date}</span>
            <span>{r.source}</span>
            <span className="pill rating">релевантность {r.rating / 10 || r.rating}</span>
          </div>
          <h3>
            <a href={r.link} target="_blank" rel="noreferrer">{r.title}</a>
          </h3>
          <p>{r.summary}</p>
          <div className="row">
            <button
              className="btn approve"
              disabled={busy === r.rowNumber}
              onClick={() => decide(r.rowNumber, 'approved')}
            >
              {busy === r.rowNumber ? <span className="spinner" /> : 'Одобрить'}
            </button>
            <button
              className="btn reject"
              disabled={busy === r.rowNumber}
              onClick={() => decide(r.rowNumber, 'rejected')}
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
