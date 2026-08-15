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

const TRUST_INFO: Record<string, { emoji: string; label: string; color: string; explain: (r: PrefRow) => string }> = {
  high: {
    emoji: '🟢',
    label: 'Доверяем',
    color: 'trust-high',
    explain: (r) => `Отсюда ${r.approved} новостей из ${r.total} были хорошими — бот берёт их сам, без вопросов к тебе`,
  },
  low: {
    emoji: '🔴',
    label: 'Не доверяем',
    color: 'trust-low',
    explain: (r) => `Отсюда только ${r.approved} из ${r.total} были хорошими — бот теперь придирчивее к новостям отсюда`,
  },
  normal: {
    emoji: '🟡',
    label: 'Присматриваемся',
    color: 'trust-normal',
    explain: (r) => `Мало решений (${r.total}) — бот ещё не понял, доверять этому источнику или нет`,
  },
};

export default function PreferencesPage() {
  const [rows, setRows] = useState<PrefRow[] | null>(null);

  useEffect(() => {
    fetch('/api/preferences').then((r) => r.json()).then(setRows);
  }, []);

  const threshold = Number(rows?.[0]?.globalThreshold ?? 7);
  const thresholdPct = Math.min(100, Math.max(0, (threshold / 10) * 100));

  return (
    <>
      <h1>Как бот выбирает новости</h1>
      <p className="sub">Обновляется само каждое воскресенье — смотрит на то, что ты одобрял и отклонял всю неделю</p>

      {rows && rows.length === 0 && (
        <div className="empty">Бот ещё ничему не научился — реши хотя бы несколько новостей в разделе «Новости», и в воскресенье он подстроится.</div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="explain-card">
            <div className="explain-title">Насколько бот придирчив прямо сейчас</div>
            <div className="gauge">
              <div className="gauge-track">
                <div className="gauge-fill" style={{ width: `${thresholdPct}%` }} />
                <div className="gauge-marker" style={{ left: `${thresholdPct}%` }}>{threshold}</div>
              </div>
              <div className="gauge-labels">
                <span>1 — пропускает почти всё</span>
                <span>10 — пропускает только лучшее</span>
              </div>
            </div>
            <p className="explain-text">
              Каждой новости бот сам ставит оценку от 1 до 10. Если оценка выше {threshold} — новость проходит.
              Чем больше ты одобряешь новостей, тем точнее бот подбирает эту планку сам.
            </p>
          </div>

          <div className="explain-title" style={{ margin: '32px 0 14px' }}>Каким источникам бот доверяет</div>

          {rows.map((r) => {
            const info = TRUST_INFO[r.trust] ?? TRUST_INFO.normal;
            return (
              <div className={`trust-card ${info.color}`} key={r.source}>
                <div className="trust-emoji">{info.emoji}</div>
                <div className="trust-body">
                  <div className="trust-top">
                    <span className="trust-source">{r.source}</span>
                    <span className="trust-label">{info.label}</span>
                  </div>
                  <p className="trust-explain">{info.explain(r)}</p>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
