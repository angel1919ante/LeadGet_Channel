'use client';

import { useEffect, useState } from 'react';

interface ArticleRow {
  rowNumber: number;
  date: string;
  platform: string;
  sourceTitle: string;
  status: string;
  content: string;
  publishedUrl: string;
}

const PLATFORMS = [
  { key: 'habr', label: 'Хабр' },
  { key: 'vc', label: 'VC.ru' },
  { key: 'dzen', label: 'Дзен' },
  { key: 'x', label: 'X' },
];

const CHANNEL_LINK = 'https://t.me/LeadGet_reviews';

function platformLabel(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.label ?? key;
}

export default function ArticlesPage() {
  const [rows, setRows] = useState<ArticleRow[] | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [platform, setPlatform] = useState('habr');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState<number | null>(null);
  const [publishUrl, setPublishUrl] = useState('');
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genPlatform, setGenPlatform] = useState('habr');
  const [genTopic, setGenTopic] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genStatus, setGenStatus] = useState('');

  const load = () => {
    fetch('/api/articles').then((r) => r.json()).then(setRows);
  };
  useEffect(load, []);

  const generate = async () => {
    if (!genTopic.trim()) return;
    setGenBusy(true);
    setGenStatus('');
    const res = await fetch('/api/articles/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: genPlatform, topic: genTopic.trim() }),
    });
    setGenBusy(false);
    if (res.ok) {
      setGenStatus('Запущено — статья появится в списке через ~30 секунд.');
      setGenTopic('');
      setTimeout(load, 20000);
    } else {
      const data = await res.json().catch(() => ({}));
      setGenStatus(`Не вышло: ${data.error ?? 'неизвестная ошибка'}`);
    }
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    await fetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform, title, content }),
    });
    setPlatform('habr');
    setTitle('');
    setContent('');
    setFormOpen(false);
    setSaving(false);
    load();
  };

  const toggleExpand = (rowNumber: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(rowNumber) ? next.delete(rowNumber) : next.add(rowNumber);
      return next;
    });
  };

  const copy = async (rowNumber: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedRow(rowNumber);
    setTimeout(() => setCopiedRow(null), 1500);
  };

  const savePublish = async (rowNumber: number) => {
    if (!publishUrl.trim()) return;
    setBusy(rowNumber);
    await fetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, status: 'published', publishedUrl: publishUrl.trim() }),
    });
    setPublishOpen(null);
    setPublishUrl('');
    setBusy(null);
    load();
  };

  const openEdit = (r: ArticleRow) => {
    setEditOpen(r.rowNumber);
    setEditTitle(r.sourceTitle);
    setEditContent(r.content);
  };

  const saveEdit = async (rowNumber: number) => {
    setBusy(rowNumber);
    await fetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, sourceTitle: editTitle, content: editContent }),
    });
    setEditOpen(null);
    setBusy(null);
    load();
  };

  const visible = rows?.filter((r) => filter === 'all' || r.platform === filter) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Статьи</h1>
          <p className="sub">{rows ? `${rows.length} всего` : 'Загрузка…'}</p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setGenOpen((v) => !v)}>
            {genOpen ? 'Отмена' : '🤖 Сгенерировать статью'}
          </button>
          <button className="btn approve" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? 'Отмена' : '+ Добавить статью'}
          </button>
        </div>
      </div>

      {genOpen && (
        <div className="card form-card">
          <label className="field-label">Площадка</label>
          <select className="field-input" value={genPlatform} onChange={(e) => setGenPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>

          <label className="field-label">Тема статьи</label>
          <input className="field-input" value={genTopic} onChange={(e) => setGenTopic(e.target.value)} placeholder="О чём написать" />

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn approve" disabled={genBusy || !genTopic.trim()} onClick={generate}>
              {genBusy ? <span className="spinner" /> : 'Сгенерировать'}
            </button>
          </div>
          {genStatus && <p className="field-hint">{genStatus}</p>}
        </div>
      )}

      <div className="row" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`btn ${filter === 'all' ? 'approve' : 'ghost'}`} onClick={() => setFilter('all')}>Все</button>
        {PLATFORMS.map((p) => (
          <button key={p.key} className={`btn ${filter === p.key ? 'approve' : 'ghost'}`} onClick={() => setFilter(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {formOpen && (
        <div className="card form-card">
          <label className="field-label">Площадка</label>
          <select className="field-input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>

          <label className="field-label">Заголовок</label>
          <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название статьи" />

          <label className="field-label">Текст статьи</label>
          <textarea className="field-input" rows={12} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Вставь готовый текст от Павла..." />
          <p className="field-hint">Не забудь добавить ссылку на канал в статью</p>
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn ghost" onClick={() => setContent((c) => `${c}\n\nПодробнее: ${CHANNEL_LINK}`)}>
              + Ссылка на канал
            </button>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn approve" disabled={saving || !title.trim() || !content.trim()} onClick={submit}>
              {saving ? <span className="spinner" /> : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {visible && visible.length === 0 && !formOpen && (
        <div className="empty">Статей пока нет — нажми «Добавить статью» выше.</div>
      )}

      {visible?.map((r) => {
        const isExpanded = expanded.has(r.rowNumber);
        const preview = r.content.length > 200 ? `${r.content.slice(0, 200)}…` : r.content;
        return (
          <div className="card" key={r.rowNumber}>
            <div className="card-top">
              <span className="pill date">{platformLabel(r.platform)}</span>
              <span className={`status ${r.status}`}>{r.status}</span>
            </div>
            <h3>{r.sourceTitle || 'без заголовка'}</h3>

            {editOpen === r.rowNumber ? (
              <div className="case-edit-card">
                <label className="field-label">Заголовок</label>
                <input className="field-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <label className="field-label">Текст</label>
                <textarea className="field-input" rows={12} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn approve" disabled={busy === r.rowNumber} onClick={() => saveEdit(r.rowNumber)}>
                    {busy === r.rowNumber ? <span className="spinner" /> : 'Сохранить'}
                  </button>
                  <button className="btn ghost" onClick={() => setEditOpen(null)}>Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ whiteSpace: 'pre-wrap' }}>{isExpanded ? r.content : preview}</p>
                {r.content.length > 200 && (
                  <button className="btn ghost" onClick={() => toggleExpand(r.rowNumber)}>
                    {isExpanded ? 'Свернуть' : 'Показать полностью'}
                  </button>
                )}

                <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn ghost" onClick={() => copy(r.rowNumber, r.content)}>
                    {copiedRow === r.rowNumber ? 'Скопировано' : 'Копировать текст'}
                  </button>
                  <button className="btn ghost" onClick={() => openEdit(r)}>Редактировать</button>
                  {r.status !== 'published' && (
                    <button className="btn ghost" onClick={() => setPublishOpen(publishOpen === r.rowNumber ? null : r.rowNumber)}>
                      Отметить опубликованной
                    </button>
                  )}
                </div>

                {r.status === 'published' && r.publishedUrl && (
                  <p style={{ marginTop: 8 }}>
                    <a href={r.publishedUrl} target="_blank" rel="noreferrer">{r.publishedUrl}</a>
                  </p>
                )}

                {publishOpen === r.rowNumber && (
                  <div className="case-edit-card">
                    <label className="field-label">Ссылка на опубликованный материал</label>
                    <input className="field-input" value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} placeholder="https://..." />
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn approve" disabled={busy === r.rowNumber || !publishUrl.trim()} onClick={() => savePublish(r.rowNumber)}>
                        {busy === r.rowNumber ? <span className="spinner" /> : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
