'use client';

import { useEffect, useState } from 'react';

interface FeatureRow {
  rowNumber: number;
  date: string;
  title: string;
  problem: string;
  description: string;
  status: string;
}

export default function FeaturesPage() {
  const [rows, setRows] = useState<FeatureRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    fetch('/api/features').then((r) => r.json()).then(setRows);
  };
  useEffect(load, []);

  const approve = async (rowNumber: number) => {
    setBusy(rowNumber);
    await fetch('/api/features', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, status: 'approved' }),
    });
    setRows((prev) => (prev ?? []).map((r) => (r.rowNumber === rowNumber ? { ...r, status: 'approved' } : r)));
    setBusy(null);
  };

  return (
    <>
      <h1>Фичи</h1>
      <p className="sub">{rows ? `${rows.length} идей` : 'Загрузка…'}</p>

      {rows && rows.length === 0 && <div className="empty">Список пуст. Добавь идеи прямо в таблицу Features.</div>}

      {rows?.map((r) => (
        <div className="card" key={r.rowNumber}>
          <div className="card-top">
            <span className="pill date">{r.date}</span>
            <span className={`status ${r.status}`}>{r.status || 'draft'}</span>
          </div>
          <h3>{r.title}</h3>
          {r.problem && <p><strong>Проблема:</strong> {r.problem}</p>}
          {r.description && <p>{r.description}</p>}
          {r.status !== 'approved' && r.status !== 'posted' && (
            <div className="row">
              <button className="btn approve" disabled={busy === r.rowNumber} onClick={() => approve(r.rowNumber)}>
                {busy === r.rowNumber ? <span className="spinner" /> : 'Одобрить для плана'}
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
