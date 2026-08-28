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

interface AvailableCase { token: string; niche: string }
interface AvailableFeature { title: string; problem: string; description: string }

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

function toDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
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

// Понедельник текущей недели (по локальному времени клиента) — граница
// "текущая + следующая неделя видны, остальное в архив".
function currentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
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

interface CaseAssets { withPhoto: boolean; boardPosted?: boolean }

function readCaseAssets(dataStr: string): CaseAssets {
  try {
    const d = dataStr ? JSON.parse(dataStr) : {};
    return { withPhoto: d.withPhoto !== false, boardPosted: d.boardPosted };
  } catch {
    return { withPhoto: true };
  }
}

interface CaseFields {
  niche: string; task: string; mechanics: string; price: string; marketComparison: string;
  boardTitle: string; boardSubtitle: string;
  overrideNumbers: boolean;
  sent: string; read: string; replied: string; engaged: string; leads: string; disqualified: string;
}

const EMPTY_CASE_FIELDS: CaseFields = {
  niche: '', task: '', mechanics: '', price: '', marketComparison: '', boardTitle: '', boardSubtitle: '',
  overrideNumbers: false, sent: '', read: '', replied: '', engaged: '', leads: '', disqualified: '',
};

function readCaseFields(dataStr: string): CaseFields {
  try {
    const d = dataStr ? JSON.parse(dataStr) : {};
    const o = d.summaryOverride ?? {};
    return {
      niche: d.niche ?? '', task: d.task ?? '', mechanics: d.mechanics ?? '', price: d.price ?? '',
      marketComparison: d.marketComparison ?? '',
      boardTitle: d.boardTitle ?? '', boardSubtitle: d.boardSubtitle ?? '',
      overrideNumbers: !!d.summaryOverride,
      sent: o.sent?.toString() ?? '', read: o.read?.toString() ?? '', replied: o.replied?.toString() ?? '',
      engaged: o.engaged?.toString() ?? '', leads: o.leads?.toString() ?? '', disqualified: o.disqualified?.toString() ?? '',
    };
  } catch {
    return EMPTY_CASE_FIELDS;
  }
}

function caseFieldsToData(f: CaseFields): Record<string, unknown> {
  const data: Record<string, unknown> = { niche: f.niche.trim() };
  if (f.task.trim()) data.task = f.task.trim();
  if (f.mechanics.trim()) data.mechanics = f.mechanics.trim();
  if (f.price.trim()) data.price = f.price.trim();
  if (f.marketComparison.trim()) data.marketComparison = f.marketComparison.trim();
  if (f.boardTitle.trim()) data.boardTitle = f.boardTitle.trim();
  if (f.boardSubtitle.trim()) data.boardSubtitle = f.boardSubtitle.trim();
  if (f.overrideNumbers) {
    data.summaryOverride = {
      sent: Number(f.sent) || 0, read: Number(f.read) || 0, replied: Number(f.replied) || 0,
      engaged: Number(f.engaged) || 0, leads: Number(f.leads) || 0, disqualified: Number(f.disqualified) || 0,
    };
  }
  return data;
}

// Алерт про превью — только для уже опубликованных кейсов. До публикации
// это просто состояние переключателя "с фото/без фото", не повод пугать.
// Диалоги переписки не генерируются вообще (нет реального транскрипта
// от LeadGet API — придумывать нечестно), поэтому их тут не проверяем.
function CaseAssetsAlert({ r }: { r: PlanRow }) {
  if (r.type !== 'кейс' || r.status !== 'posted') return null;
  const a = readCaseAssets(r.data);
  if (!a.withPhoto) {
    return <p className="plan-card-alert">⚠️ Опубликовано без превью (выбрано "без фото")</p>;
  }
  if (a.boardPosted === false) {
    return <p className="plan-card-alert">⚠️ Превью не запостилось</p>;
  }
  return null;
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
  const [availableCases, setAvailableCases] = useState<AvailableCase[]>([]);
  const [availableFeatures, setAvailableFeatures] = useState<AvailableFeature[]>([]);
  const [publishing, setPublishing] = useState<Record<number, 'busy' | 'queued'>>({});
  const [deleting, setDeleting] = useState<Record<number, 'busy' | 'queued'>>({});
  const [editingCase, setEditingCase] = useState<number | null>(null);
  const [caseFieldsByRow, setCaseFieldsByRow] = useState<Record<number, CaseFields>>({});
  const [savingCase, setSavingCase] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<'новость' | 'кейс' | 'фича'>('новость');
  const [newToken, setNewToken] = useState('');
  const [newFeatureTitle, setNewFeatureTitle] = useState('');
  const [newCaseFields, setNewCaseFields] = useState<CaseFields>(EMPTY_CASE_FIELDS);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateNote, setGenerateNote] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ date: string; type: string; title: string; post: string }>({ date: '', type: '', title: '', post: '' });
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [drafting, setDrafting] = useState<Record<number, 'busy' | 'queued'>>({});
  const [dragRow, setDragRow] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);

  const load = () => {
    fetch('/api/plan').then((r) => r.json()).then((res) => {
      setRows(res.rows);
      setAvailableCases(res.availableCases ?? []);
      setAvailableFeatures(res.availableFeatures ?? []);
    });
  };
  useEffect(load, []);

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

  const deletePost = async (rowNumber: number) => {
    if (!confirm('Удалить пост из канала? Строку плана можно будет отредактировать и опубликовать заново.')) return;
    setDeleting((p) => ({ ...p, [rowNumber]: 'busy' }));
    const res = await fetch('/api/plan/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber }),
    });
    setDeleting((p) => ({ ...p, [rowNumber]: res.ok ? 'queued' : undefined as never }));
  };

  // Дата в плане хранится DD.MM.YYYY, <input type="date"> хочет YYYY-MM-DD.
  const toISO = (dmy: string) => {
    const [d, m, y] = dmy.split('.');
    return d && m && y ? `${y}-${m}-${d}` : '';
  };

  const openEdit = (r: PlanRow) => {
    if (editingRow === r.rowNumber) {
      setEditingRow(null);
      return;
    }
    setEditDraft({ date: toISO(r.date), type: r.type, title: r.title, post: stripHtml(r.post) });
    setEditingRow(r.rowNumber);
  };

  const saveEdit = async (r: PlanRow) => {
    setSavingRow(r.rowNumber);
    const patch: Record<string, unknown> = { rowNumber: r.rowNumber };
    const newDate = editDraft.date ? toDMY(editDraft.date) : r.date;
    if (newDate !== r.date) patch.date = newDate;
    if (editDraft.type !== r.type) patch.type = editDraft.type;
    if (editDraft.title !== r.title) patch.title = editDraft.title;
    // Текст правим только если он уже есть (черновик) — иначе публиковать
    // нечего и правка бессмысленна. Пустой пост не затираем.
    if (r.post && editDraft.post.trim() && editDraft.post !== stripHtml(r.post)) {
      patch.post = editDraft.post;
      patch.status = 'draft';
    }
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSavingRow(null);
    setEditingRow(null);
    load();
  };

  const removeRow = async (r: PlanRow) => {
    if (!confirm(`Удалить строку плана на ${r.date}? Действие необратимо, строка исчезнет из таблицы.`)) return;
    setSavingRow(r.rowNumber);
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber: r.rowNumber, remove: true }),
    });
    setSavingRow(null);
    setEditingRow(null);
    load();
  };

  // Перетаскивание карточки на другую — меняем их датами местами.
  const swapRows = async (fromRow: number, toRow: number) => {
    if (fromRow === toRow) return;
    setSavingRow(fromRow);
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber: fromRow, swapWith: toRow }),
    });
    setSavingRow(null);
    load();
  };

  const makeDraft = async (rowNumber: number) => {
    setDrafting((p) => ({ ...p, [rowNumber]: 'busy' }));
    const res = await fetch('/api/plan/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber }),
    });
    setDrafting((p) => ({ ...p, [rowNumber]: res.ok ? 'queued' : undefined as never }));
  };

  const openCaseEdit = (r: PlanRow) => {
    setCaseFieldsByRow((prev) => ({ ...prev, [r.rowNumber]: prev[r.rowNumber] ?? readCaseFields(r.data) }));
    setEditingCase((cur) => (cur === r.rowNumber ? null : r.rowNumber));
  };

  const updateCaseField = (rowNumber: number, patch: Partial<CaseFields>) => {
    setCaseFieldsByRow((prev) => ({ ...prev, [rowNumber]: { ...(prev[rowNumber] ?? EMPTY_CASE_FIELDS), ...patch } }));
  };

  const saveCaseFields = async (rowNumber: number) => {
    const f = caseFieldsByRow[rowNumber];
    if (!f || !f.niche.trim()) return;
    setSavingCase(rowNumber);
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rowNumber, caseData: caseFieldsToData(f) }),
    });
    setSavingCase(null);
    setEditingCase(null);
    load();
  };

  const createRow = async () => {
    if (!newDate) return;
    let token = '';
    let title = '';
    let data = '{}';
    if (newType === 'кейс') {
      if (!newToken || !newCaseFields.niche.trim()) return;
      token = newToken;
      data = JSON.stringify(caseFieldsToData(newCaseFields));
    } else if (newType === 'фича') {
      const f = availableFeatures.find((x) => x.title === newFeatureTitle);
      if (!f) return;
      title = f.title;
      data = JSON.stringify({ problem: f.problem, description: f.description });
    }
    setCreating(true);
    await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ create: true, date: toDMY(newDate), type: newType, title, token, data }),
    });
    setCreating(false);
    setFormOpen(false);
    setNewDate('');
    setNewToken('');
    setNewFeatureTitle('');
    setNewCaseFields(EMPTY_CASE_FIELDS);
    load();
  };

  const generateWeek = async () => {
    setGenerating(true);
    setGenerateNote(null);
    const res = await fetch('/api/plan/generate-week', { method: 'POST' });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setGenerateNote('Не получилось — попробуй ещё раз.');
      return;
    }
    setGenerateNote(
      json.added.length > 0
        ? `Неделя ${json.weekStart} — добавлено ${json.added.length}: ${json.added.map((a: { type: string }) => a.type).join(', ')}.${json.note ? ' ' + json.note : ''}`
        : `Неделя ${json.weekStart} уже полностью занята.`,
    );
    load();
  };

  const canCreate = newDate && (
    newType === 'новость' ||
    (newType === 'кейс' && newToken && newCaseFields.niche.trim()) ||
    (newType === 'фича' && newFeatureTitle)
  );

  // По умолчанию видны только текущая и следующая неделя — старые посты не
  // нужны на виду каждый день, но остаются доступны через "Архив".
  const curWeekStart = currentWeekStart();
  const nextWeekStart = new Date(curWeekStart);
  nextWeekStart.setDate(curWeekStart.getDate() + 7);
  const inVisibleRange = (dateStr: string) => {
    const s = weekStart(dateStr);
    if (!s) return true;
    return s.getTime() >= curWeekStart.getTime() && s.getTime() <= nextWeekStart.getTime();
  };
  const visibleRows = rows ? (showArchive ? rows : rows.filter((r) => inVisibleRange(r.date))) : null;
  const archivedCount = rows ? rows.length - (rows.filter((r) => inVisibleRange(r.date)).length) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Контент-план</h1>
          <p className="sub">
            {rows ? `${rows.length} постов запланировано · перетащи карточку на другую, чтобы поменять местами` : 'Загрузка…'}
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {archivedCount > 0 && (
            <button className="btn ghost" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'Скрыть архив' : `Архив (${archivedCount})`}
            </button>
          )}
          <button className="btn ghost" disabled={generating} onClick={generateWeek}>
            {generating ? <span className="spinner" /> : '📅 План на след. неделю'}
          </button>
          <button className="btn approve" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? 'Отмена' : '+ Добавить в план'}
          </button>
        </div>
      </div>

      {generateNote && <p className="field-hint" style={{ marginBottom: 16 }}>{generateNote}</p>}

      {formOpen && (
        <div className="card form-card">
          <label className="field-label">Дата</label>
          <input type="date" className="field-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />

          <label className="field-label">Тип</label>
          <select className="field-input" value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)}>
            <option value="новость">Новость (бот сам выберет из одобренных)</option>
            <option value="кейс">Кейс</option>
            <option value="фича">Фича</option>
          </select>

          {newType === 'кейс' && (
            <>
              <label className="field-label">Кейс (из необработанных в разделе «Кейсы»)</label>
              <select className="field-input" value={newToken} onChange={(e) => {
                const token = e.target.value;
                setNewToken(token);
                const c = availableCases.find((x) => x.token === token);
                if (c && !newCaseFields.niche) updateNewCaseNiche(c.niche);
              }}>
                <option value="">— выбрать —</option>
                {availableCases.map((c) => (
                  <option key={c.token} value={c.token}>{c.niche || c.token.slice(0, 8)}</option>
                ))}
              </select>
              {availableCases.length === 0 && (
                <p className="field-hint">Необработанных кейсов нет — новые появятся, когда сканер найдёт кампании (или добавь токен вручную).</p>
              )}
              {!newToken && (
                <input className="field-input" placeholder="...или вставь токен кампании вручную" value={newToken} onChange={(e) => setNewToken(e.target.value)} />
              )}
              <CaseChecklist />
              <CaseFieldsForm fields={newCaseFields} onChange={(patch) => setNewCaseFields((prev) => ({ ...prev, ...patch }))} />
            </>
          )}

          {newType === 'фича' && (
            <>
              <label className="field-label">Фича (из необработанных в разделе «Фичи»)</label>
              <select className="field-input" value={newFeatureTitle} onChange={(e) => setNewFeatureTitle(e.target.value)}>
                <option value="">— выбрать —</option>
                {availableFeatures.map((f) => (
                  <option key={f.title} value={f.title}>{f.title}</option>
                ))}
              </select>
              {availableFeatures.length === 0 && (
                <p className="field-hint">Свободных фич нет — добавь новую в разделе «Фичи».</p>
              )}
            </>
          )}

          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn approve" disabled={creating || !canCreate} onClick={createRow}>
              {creating ? <span className="spinner" /> : 'Добавить в план'}
            </button>
          </div>
        </div>
      )}

      {visibleRows && visibleRows.length === 0 && (
        <div className="empty">
          {rows && rows.length > 0
            ? 'На текущую и следующую неделю ничего нет — загляни в архив выше.'
            : 'План пуст — новости добавляют себя сами, кейсы и фичи занеси через соответствующие разделы, либо жми «Добавить в план» выше.'}
        </div>
      )}

      {visibleRows?.map((r, i) => {
        const info = TYPE_INFO[r.type] ?? { emoji: '📌', label: r.type, color: '' };
        const caseClient = r.type === 'кейс' && r.detail && 'client' in r.detail ? (r.detail as CaseDetail).client : null;
        const fallbackTitle = r.title || caseClient || (r.type === 'кейс' && r.token ? `кейс по токену ${r.token.slice(0, 8)}…` : 'автовыбор — бот решит сам');

        const start = weekStart(r.date);
        const prevStart = i > 0 ? weekStart(visibleRows[i - 1].date) : null;
        const isNewWeek = start && (!prevStart || start.getTime() !== prevStart.getTime());

        const publishState = publishing[r.rowNumber];
        const canPublish = r.status !== 'posted' && publishState !== 'queued';
        const withPhoto = readWithPhoto(r.data);

        const deleteState = deleting[r.rowNumber];
        const canDelete = r.status === 'posted' && r.postUrl && deleteState !== 'queued';

        const isEditingCase = editingCase === r.rowNumber;
        const caseFields = caseFieldsByRow[r.rowNumber];
        const isEditingRow = editingRow === r.rowNumber;
        const draftState = drafting[r.rowNumber];

        return (
          <div key={r.rowNumber}>
            {isNewWeek && start && <div className="week-header">{weekLabel(start)}</div>}
            <div
              className={`plan-card ${info.color} ${dragOverRow === r.rowNumber && dragRow !== r.rowNumber ? 'drag-over' : ''} ${dragRow === r.rowNumber ? 'dragging' : ''}`}
              draggable={r.status !== 'posted'}
              onDragStart={() => setDragRow(r.rowNumber)}
              onDragEnd={() => { setDragRow(null); setDragOverRow(null); }}
              onDragOver={(e) => {
                if (dragRow === null || r.status === 'posted') return;
                e.preventDefault();
                setDragOverRow(r.rowNumber);
              }}
              onDragLeave={() => setDragOverRow((cur) => (cur === r.rowNumber ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragRow;
                setDragRow(null);
                setDragOverRow(null);
                if (from !== null && r.status !== 'posted') swapRows(from, r.rowNumber);
              }}
            >
              <div className="plan-card-date">
                {r.status !== 'posted' && <span className="plan-card-grip" title="Перетащи, чтобы поменять местами">⠿</span>}
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
                {(r.status === 'posted' || r.status === 'draft') && r.post && (() => {
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

                  {r.type === 'кейс' && r.status !== 'posted' && (
                    <button className="btn ghost" onClick={() => openCaseEdit(r)}>
                      {isEditingCase ? 'Свернуть' : 'Данные кейса'}
                    </button>
                  )}

                  {r.status !== 'posted' && (
                    <button
                      className="btn ghost"
                      disabled={draftState === 'busy'}
                      onClick={() => makeDraft(r.rowNumber)}
                    >
                      {draftState === 'busy' ? <span className="spinner" /> : (r.post ? 'Перегенерировать' : 'Черновик')}
                    </button>
                  )}
                  {draftState === 'queued' && (
                    <span className="publish-queued-note">Черновик готовится — обнови страницу через минуту</span>
                  )}

                  {r.status !== 'posted' && (
                    <button className="btn ghost" onClick={() => openEdit(r)}>
                      {isEditingRow ? 'Свернуть' : '✏️ Редактировать'}
                    </button>
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

                  {canDelete && (
                    <button
                      className="btn reject"
                      disabled={deleteState === 'busy'}
                      onClick={() => deletePost(r.rowNumber)}
                    >
                      {deleteState === 'busy' ? <span className="spinner" /> : 'Удалить пост'}
                    </button>
                  )}
                  {deleteState === 'queued' && (
                    <span className="publish-queued-note">Удаление отправлено — обновится в течение минуты</span>
                  )}
                </div>

                {isEditingRow && (
                  <div className="case-edit-card">
                    <label className="field-label">Дата</label>
                    <input
                      type="date"
                      className="field-input"
                      value={editDraft.date}
                      onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                    />

                    <label className="field-label">Тип</label>
                    <select
                      className="field-input"
                      value={editDraft.type}
                      onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                    >
                      <option value="новость">Новость</option>
                      <option value="кейс">Кейс</option>
                      <option value="фича">Фича</option>
                    </select>

                    <label className="field-label">Заголовок</label>
                    <input
                      className="field-input"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="пусто — бот подставит сам"
                    />

                    {r.post ? (
                      <>
                        <label className="field-label">Текст поста</label>
                        <textarea
                          className="field-input"
                          rows={16}
                          value={editDraft.post}
                          onChange={(e) => setEditDraft((d) => ({ ...d, post: e.target.value }))}
                        />
                        <p className="field-hint">Сохранишь — в канал уйдёт именно этот текст, без перегенерации.</p>
                      </>
                    ) : (
                      <p className="field-hint" style={{ marginTop: 12 }}>
                        Текста ещё нет — нажми «Черновик», чтобы бот его написал, потом сможешь поправить здесь.
                      </p>
                    )}

                    <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                      <button className="btn approve" disabled={savingRow === r.rowNumber} onClick={() => saveEdit(r)}>
                        {savingRow === r.rowNumber ? <span className="spinner" /> : 'Сохранить'}
                      </button>
                      <button className="btn ghost" onClick={() => setEditingRow(null)}>Отмена</button>
                      <button className="btn reject" disabled={savingRow === r.rowNumber} onClick={() => removeRow(r)}>
                        Удалить строку
                      </button>
                    </div>
                  </div>
                )}

                {isEditingCase && caseFields && (
                  <div className="case-edit-card">
                    <CaseFieldsForm fields={caseFields} onChange={(patch) => updateCaseField(r.rowNumber, patch)} />
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn approve" disabled={savingCase === r.rowNumber || !caseFields.niche.trim()} onClick={() => saveCaseFields(r.rowNumber)}>
                        {savingCase === r.rowNumber ? <span className="spinner" /> : 'Сохранить данные кейса'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );

  function updateNewCaseNiche(niche: string) {
    setNewCaseFields((prev) => ({ ...prev, niche }));
  }
}

function CaseChecklist() {
  return (
    <details className="case-checklist">
      <summary>Что нужно для кейса, чек-лист</summary>
      <ul>
        <li>Ниша клиента обезличенно — не название компании (напр. «агентство недвижимости»)</li>
        <li>Что искали — задача одной фразой (кого/что нужно было найти)</li>
        <li>Как настроили — механика: рассылка, квалификация, что делал бот</li>
        <li>Количество контактов (отправок) — если из LeadGet API неверное, включи «переопределить цифры» и впиши своё</li>
        <li>Конверсия — сколько из отправок дошло до диалога и до лида (те же ручные цифры, если API врёт)</li>
        <li>Цена лида и с чем сравнить (таргет/Директ) — только если реально знаешь цифру, не для красоты</li>
        <li>Реальная переписка с клиентом — присылай текстом отдельно, если хочешь слайды-диалог (не сочиняем)</li>
      </ul>
    </details>
  );
}

function CaseFieldsForm({ fields, onChange }: { fields: CaseFields; onChange: (patch: Partial<CaseFields>) => void }) {
  return (
    <>
      <label className="field-label">Ниша (обезличенно, обязательно — реальное имя клиента в пост не попадёт)</label>
      <input className="field-input" placeholder="транспортная компания (грузоперевозки по России)" value={fields.niche} onChange={(e) => onChange({ niche: e.target.value })} />

      <label className="field-label">Задача</label>
      <input className="field-input" placeholder="поиск клиентов с грузами под конкретные машины" value={fields.task} onChange={(e) => onChange({ task: e.target.value })} />

      <label className="field-label">Механика</label>
      <input className="field-input" placeholder="рассылка по базе, квалификация через уточняющие вопросы" value={fields.mechanics} onChange={(e) => onChange({ mechanics: e.target.value })} />

      <label className="field-label">Цена лида, ₽ (необязательно)</label>
      <input className="field-input" placeholder="850" value={fields.price} onChange={(e) => onChange({ price: e.target.value })} />

      <label className="field-label">Сравнение с рынком (необязательно — только если реально знаешь цифру, не для красоты)</label>
      <input className="field-input" placeholder="таргет и Директ в нише: от 2500 ₽ за контакт" value={fields.marketComparison} onChange={(e) => onChange({ marketComparison: e.target.value })} />

      <label className="field-label">Заголовок доски (необязательно, иначе — ниша)</label>
      <input className="field-input" placeholder="транспортная компания" value={fields.boardTitle} onChange={(e) => onChange({ boardTitle: e.target.value })} />

      <label className="field-label checkbox-label">
        <input type="checkbox" checked={fields.overrideNumbers} onChange={(e) => onChange({ overrideNumbers: e.target.checked })} />
        Переопределить цифры кампании вручную (если данные из LeadGet API неполные/устаревшие)
      </label>

      {fields.overrideNumbers && (
        <div className="case-numbers-grid">
          <div>
            <label className="field-label">Отправок</label>
            <input className="field-input" inputMode="numeric" value={fields.sent} onChange={(e) => onChange({ sent: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Прочитали</label>
            <input className="field-input" inputMode="numeric" value={fields.read} onChange={(e) => onChange({ read: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Ответили</label>
            <input className="field-input" inputMode="numeric" value={fields.replied} onChange={(e) => onChange({ replied: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Диалогов</label>
            <input className="field-input" inputMode="numeric" value={fields.engaged} onChange={(e) => onChange({ engaged: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Лидов</label>
            <input className="field-input" inputMode="numeric" value={fields.leads} onChange={(e) => onChange({ leads: e.target.value })} />
          </div>
        </div>
      )}
    </>
  );
}
