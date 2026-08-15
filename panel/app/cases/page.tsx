'use client';

import { useEffect, useState } from 'react';

interface CaseRow {
  rowNumber: number;
  date: string;
  client: string;
  niche: string;
  sent: number;
  leads: number;
  conversion: number;
  status: string;
}

export default function CasesPage() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/cases').then((r) => r.json()).then(setRows);
  }, []);

  const decide = async (rowNumber: number, status: 'approved' | 'skip') => {
    setBusy(rowNumber);
    await fetch('/api/cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, status }),
    });
    setRows((prev) => (prev ?? []).filter((r) => r.rowNumber !== rowNumber));
    setBusy(null);
  };

  return (
    <>
      <h1>Кандидаты в кейсы</h1>
      <p className="sub">{rows ? `${rows.length} на рассмотрении` : 'Загрузка…'}</p>

      {rows && rows.length === 0 && <div className="empty">Пусто. Новые кандидаты появятся после скана.</div>}

      {rows?.map((r) => (
        <div className="card" key={r.rowNumber}>
          <div className="card-top">
            <span className="pill date">{r.date}</span>
            <span>{r.niche || 'без ниши'}</span>
          </div>
          <h3>{r.client}</h3>
          <p>
            {r.sent} отправлено · {r.leads} лидов · {r.conversion.toFixed(1)}% конверсия
          </p>
          <div className="row">
            <button className="btn approve" disabled={busy === r.rowNumber} onClick={() => decide(r.rowNumber, 'approved')}>
              {busy === r.rowNumber ? <span className="spinner" /> : 'Одобрить'}
            </button>
            <button className="btn reject" disabled={busy === r.rowNumber} onClick={() => decide(r.rowNumber, 'skip')}>
              Пропустить
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
