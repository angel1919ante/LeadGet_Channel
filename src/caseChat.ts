// Детерминированный рендерер слайдов переписки для кейсов.
// Спек: references/case-cards/case-chat-spec.md. Холст 1254×1254, точные
// координаты header/divider/result block из спека. Puppeteer + HTML/CSS.
import puppeteer from 'puppeteer';
import { FONTS_IMPORT_URL, FONTS, PALETTE } from './brandDesign.ts';

const CANVAS = 1254;
const GRID = '#D9D4CA';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type ChatRole = 'bot' | 'client';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export interface CaseChatSlideOptions {
  category: string; // ниша, обезличенная: SEO, ОБРАЗОВАНИЕ, E-COMMERCE...
  stageTitle: string; // "Первый контакт" и т.п.
  page: number;
  total: number;
  messages: ChatMessage[]; // 3–6 по спеку
  resultTitle: string;
  resultCopy: string;
  botLabel?: string; // по умолчанию "ИИ-АГЕНТ · LEADGET"
}

function bubble(m: ChatMessage, botLabel: string): string {
  const isBot = m.role === 'bot';
  const label = isBot ? botLabel : 'СОБЕСЕДНИК';
  const lines = escapeHtml(m.text).split('\n').join('<br>');
  return `<div class="row ${isBot ? 'bot' : 'client'}">
    <div class="bubble ${isBot ? 'bot' : 'client'}">
      <div class="role">${label}</div>
      <div class="body">${lines}</div>
    </div>
  </div>`;
}

// Уровни плотности — если сообщений много (спек допускает 3-6 на слайд) и
// контент не влезает в фиксированный канвас 1254×1254, автоматически сжимаем
// отступы/шрифт вместо того, чтобы молча обрезать блок результата снизу
// (bubble.bot/client + line-height подобраны так, чтобы текст на любом
// уровне оставался читаемым).
const DENSITY_LEVELS = [
  { gap: 28, padV: 24, font: 21, roleMb: 14, resultMt: 48 },
  { gap: 22, padV: 20, font: 20, roleMb: 12, resultMt: 36 },
  { gap: 16, padV: 16, font: 19, roleMb: 10, resultMt: 26 },
  { gap: 12, padV: 14, font: 18, roleMb: 8, resultMt: 18 },
];

export async function renderCaseChatSlide(opts: CaseChatSlideOptions): Promise<Buffer> {
  const botLabel = opts.botLabel ?? 'ИИ-АГЕНТ · LEADGET';
  const counter = `${String(opts.page).padStart(2, '0')} / ${String(opts.total).padStart(2, '0')}`;
  const pageNum = String(opts.page).padStart(2, '0');

  const messagesHtml = opts.messages.map((m) => bubble(m, botLabel)).join('');
  const d0 = DENSITY_LEVELS[0];

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('${FONTS_IMPORT_URL}');
  * { margin:0; padding:0; box-sizing:border-box; }
  :root { --gap:${d0.gap}px; --padV:${d0.padV}px; --font:${d0.font}px; --roleMb:${d0.roleMb}px; --resultMt:${d0.resultMt}px; }
  body {
    width:${CANVAS}px; height:${CANVAS}px; position:relative; overflow:hidden;
    background: ${PALETTE.cream};
    background-image:
      linear-gradient(to right, ${GRID}4d 1px, transparent 1px),
      linear-gradient(to bottom, ${GRID}4d 1px, transparent 1px);
    background-size: 42px 42px;
  }

  .badge { position:absolute; left:64px; top:58px; height:54px; padding:0 20px; border-radius:27px; background:${PALETTE.nearBlack}; display:flex; align-items:center; gap:10px; }
  .badge .dot { width:10px; height:10px; background:${PALETTE.green}; border-radius:2px; flex-shrink:0; }
  .badge .label { font-family:${FONTS.mono}; font-size:14px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:${PALETTE.cream}; white-space:nowrap; }

  .counter { position:absolute; right:64px; top:70px; font-family:${FONTS.mono}; font-size:15px; font-weight:700; color:${PALETTE.green}; }

  .stage { position:absolute; left:64px; top:132px; right:64px; font-family:${FONTS.display}; font-size:32px; font-weight:700; color:${PALETTE.nearBlack}; line-height:1.15; }

  .divider { position:absolute; left:64px; right:64px; top:218px; height:2px; background:${GRID}; }

  .thread { position:absolute; left:0; top:242px; width:${CANVAS}px; display:flex; flex-direction:column; gap:var(--gap); }

  .row { display:flex; padding-left:64px; padding-right:64px; }
  .row.bot { justify-content:flex-end; }
  .row.client { justify-content:flex-start; }

  .bubble { border-radius:28px; padding:var(--padV) 28px; }
  .bubble.bot { background:${PALETTE.nearBlack}; min-width:300px; max-width:760px; }
  .bubble.client { background:#F8F6F0; border:2px solid ${GRID}; min-width:180px; max-width:680px; }

  .role { font-family:${FONTS.mono}; font-size:12px; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:var(--roleMb); }
  .bubble.bot .role { color:${PALETTE.green}; }
  .bubble.client .role { color:${PALETTE.secondaryText}; opacity:0.75; }

  .body { font-family:${FONTS.body}; font-size:var(--font); font-weight:500; line-height:1.4; }
  .bubble.bot .body { color:${PALETTE.cream}; }
  .bubble.client .body { color:${PALETTE.nearBlack}; }

  .result { margin-top:var(--resultMt); padding-left:64px; padding-right:64px; }
  .result-line { height:2px; background:${GRID}; margin-bottom:24px; }
  .result-label { display:flex; align-items:center; gap:9px; font-family:${FONTS.mono}; font-size:13px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:${PALETTE.green}; margin-bottom:12px; }
  .result-label .dot { width:10px; height:10px; background:${PALETTE.green}; border-radius:2px; }
  .result-title { font-family:${FONTS.display}; font-size:22px; font-weight:700; color:${PALETTE.nearBlack}; margin-bottom:8px; }
  .result-copy { font-family:${FONTS.body}; font-size:17px; font-weight:500; color:${PALETTE.secondaryText}; }

  .pagenum { position:absolute; right:64px; bottom:36px; font-family:${FONTS.display}; font-size:120px; font-weight:800; color:${PALETTE.green}; opacity:0.12; line-height:1; }
</style></head>
<body>
  <div class="badge"><div class="dot"></div><div class="label">Кейс · ${escapeHtml(opts.category)}</div></div>
  <div class="counter">${counter}</div>
  <div class="stage">${escapeHtml(opts.stageTitle)}</div>
  <div class="divider"></div>

  <div class="thread">
    ${messagesHtml}
    <div class="result">
      <div class="result-line"></div>
      <div class="result-label"><div class="dot"></div>Результат этапа</div>
      <div class="result-title">${escapeHtml(opts.resultTitle)}</div>
      <div class="result-copy">${escapeHtml(opts.resultCopy)}</div>
    </div>
  </div>

  <div class="pagenum">${pageNum}</div>
</body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: CANVAS, height: CANVAS });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    for (let level = 1; level < DENSITY_LEVELS.length; level++) {
      const bottom = await page.evaluate(() => document.querySelector('.thread')?.getBoundingClientRect().bottom ?? 0);
      if (bottom <= CANVAS - 20) break;
      const d = DENSITY_LEVELS[level];
      await page.evaluate((d) => {
        const root = document.documentElement.style;
        root.setProperty('--gap', `${d.gap}px`);
        root.setProperty('--padV', `${d.padV}px`);
        root.setProperty('--font', `${d.font}px`);
        root.setProperty('--roleMb', `${d.roleMb}px`);
        root.setProperty('--resultMt', `${d.resultMt}px`);
      }, d);
    }

    const finalBottom = await page.evaluate(() => document.querySelector('.thread')?.getBoundingClientRect().bottom ?? 0);
    if (finalBottom > CANVAS - 20) {
      console.warn(`caseChat: slide "${opts.stageTitle}" всё ещё не влезает (bottom=${finalBottom}) даже на максимальной плотности — рассмотри меньше сообщений на слайде`);
    }

    const buf = await page.screenshot({ type: 'png' });
    return buf as Buffer;
  } finally {
    await browser.close();
  }
}
