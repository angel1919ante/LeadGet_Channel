'use client';

import { useEffect, useState } from 'react';

interface PlanRow {
  rowNumber: number;
  date: string;
  type: string;
  title: string;
  status: string;
}

export default function PlanPage() {
  const [rows, setRows] = useState<PlanRow[] | null>(null);

  useEffect(() => {
    fetch('/api/plan').then((r) => r.json()).then(setRows);
  }, []);

  return (
    <>
      <h1>Контент-план</h1>
      <p className="sub">{rows ? `${rows.length} строк` : 'Загрузка…'}</p>

      {rows && rows.length === 0 && <div className="empty">План пуст.</div>}

      {rows && rows.length > 0 && (
        <div className="card">
          {rows.map((r) => (
            <div className="plan-row" key={r.rowNumber}>
              <span className="plan-date">{r.date}</span>
              <span className="plan-type">{r.type}</span>
              <span className={`plan-title ${r.title ? '' : 'empty-title'}`}>
                {r.title || 'автовыбор'}
              </span>
              <span className={`status ${r.status}`}>{r.status || 'draft'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
