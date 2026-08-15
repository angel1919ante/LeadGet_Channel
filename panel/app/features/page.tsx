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
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

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

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch('/api/features', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, problem, description }),
    });
    setTitle('');
    setProblem('');
    setDescription('');
    setFormOpen(false);
    setSaving(false);
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Фичи</h1>
          <p className="sub">{rows ? `${rows.length} идей` : 'Загрузка…'}</p>
        </div>
        <button className="btn approve" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? 'Отмена' : '+ Добавить фичу'}
        </button>
      </div>

      {formOpen && (
        <div className="card form-card">
          <label className="field-label">Название</label>
          <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Транскрибация голосовых" />

          <label className="field-label">Какая была проблема</label>
          <textarea className="field-input" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Клиенты присылали голосовые, бот их не понимал" />

          <label className="field-label">Что сделали, как работает</label>
          <textarea className="field-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Бот сам переводит голосовое в текст и отвечает по смыслу" />

          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn approve" disabled={saving || !title.trim()} onClick={submit}>
              {saving ? <span className="spinner" /> : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {rows && rows.length === 0 && !formOpen && (
        <div className="empty">Идей пока нет — нажми «Добавить фичу» выше.</div>
      )}

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
