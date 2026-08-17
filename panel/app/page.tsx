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

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'pending', label: 'На рассмотрении' },
  { key: 'all', label: 'Все' },
  { key: 'approved', label: 'Одобрено' },
  { key: 'posted', label: 'Опубликовано' },
  { key: 'rejected', label: 'Отклонено' },
  { key: 'error', label: 'Ошибка' },
];

export default function NewsPage() {
  const [rows, setRows] = useState<NewsRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState('pending');

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
    setRows((prev) => (prev ?? []).map((r) => (r.rowNumber === rowNumber ? { ...r, status } : r)));
    setBusy(null);
  };

  const visible = rows?.filter((r) => filter === 'all' || r.status === filter) ?? null;
  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f.key] = f.key === 'all' ? (rows?.length ?? 0) : (rows?.filter((r) => r.status === f.key).length ?? 0);
    return acc;
  }, {});

  return (
    <>
      <h1>Новости</h1>
      <p className="sub">
        {rows ? `${visible?.length ?? 0} показано` : 'Загрузка…'}
      </p>

      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {rows && <span className="filter-count">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {visible && visible.length === 0 && (
        <div className="empty">Пусто в этом разделе.</div>
      )}

      {visible?.map((r) => (
        <div className="card" key={r.rowNumber}>
          <div className="card-top">
            <span className="pill date">{r.date}</span>
            <span>{r.source}</span>
            <span className="pill rating">релевантность {r.rating / 10 || r.rating}</span>
            {filter === 'all' && <span className={`status ${r.status}`} style={{ marginLeft: 'auto' }}>{r.status}</span>}
          </div>
          <h3>
            <a href={r.link} target="_blank" rel="noreferrer">{r.title}</a>
          </h3>
          <p>{r.summary}</p>
          {r.status === 'pending' && (
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
          )}
        </div>
      ))}
    </>
  );
}
