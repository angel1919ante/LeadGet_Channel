// Детерминированный рендерер кейс-борда: статичный маскот (references/mascot)
// + доска/иконки/стрелки/цифры/лого, всё нарисовано SVG/HTML — без Flux.
// Одинаковый результат при каждом запуске, только заголовок/цифры/иконки меняются.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { FONTS_IMPORT_URL, FONTS, PALETTE } from './brandDesign.ts';

const CANVAS_W = 1280;
const CANVAS_H = 720;

// Маскот держит "табличку" — статичный, уже одобренный референс, обрезан
// и с прозрачным фоном (assets/brand/mascot_board_transparent.png). Не Flux.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Небольшая библиотека иконок для доски. Набор по умолчанию — воронка
// "отправка → бот → лид", подходит для большинства кейсов. Под конкретную
// нишу можно передать другой набор ключей (см. CaseBoardOptions.icons).
const ICONS: Record<string, string> = {
  // Чёрная заливка (не зелёный контур) — как в эталонном референсе: магазин/бизнес.
  shop: `<path d="M4 32 L12 10 H88 L96 32 Z" fill="${PALETTE.nearBlack}"/><rect x="10" y="32" width="80" height="58" fill="${PALETTE.nearBlack}"/><rect x="20" y="42" width="20" height="20" fill="${PALETTE.cream}"/><rect x="60" y="42" width="20" height="20" fill="${PALETTE.cream}"/><rect x="42" y="68" width="16" height="22" fill="${PALETTE.cream}"/>`,
  // Толстая зелёная рамка-квадрат вокруг мордочки бота.
  bot: `<rect x="12" y="12" width="76" height="76" rx="24" fill="none" stroke="${PALETTE.green}" stroke-width="9"/><circle cx="38" cy="52" r="7" fill="${PALETTE.green}"/><circle cx="62" cy="52" r="7" fill="${PALETTE.green}"/><path d="M38 68 Q50 76 62 68" fill="none" stroke="${PALETTE.green}" stroke-width="7" stroke-linecap="round"/><line x1="50" y1="12" x2="50" y2="2" stroke="${PALETTE.green}" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="2" r="5" fill="${PALETTE.green}"/>`,
  lead: `<circle cx="38" cy="24" r="17" fill="none" stroke="${PALETTE.green}" stroke-width="8"/><path d="M10 90 Q10 50 38 50 Q66 50 66 90" fill="none" stroke="${PALETTE.green}" stroke-width="8" stroke-linecap="round"/><circle cx="78" cy="64" r="19" fill="${PALETTE.green}"/><path d="M68 64 L75 71 L89 55" fill="none" stroke="${PALETTE.cream}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  target: `<circle cx="50" cy="50" r="38" fill="none" stroke="${PALETTE.green}" stroke-width="8"/><circle cx="50" cy="50" r="21" fill="none" stroke="${PALETTE.green}" stroke-width="8"/><circle cx="50" cy="50" r="7" fill="${PALETTE.green}"/>`,
  document: `<path d="M24 4 H62 L80 22 V96 H24 Z" fill="none" stroke="${PALETTE.green}" stroke-width="8" stroke-linejoin="round"/><path d="M62 4 V22 H80" fill="none" stroke="${PALETTE.green}" stroke-width="8" stroke-linejoin="round"/><line x1="35" y1="45" x2="69" y2="45" stroke="${PALETTE.green}" stroke-width="6" stroke-linecap="round"/><line x1="35" y1="62" x2="69" y2="62" stroke="${PALETTE.green}" stroke-width="6" stroke-linecap="round"/><line x1="35" y1="79" x2="55" y2="79" stroke="${PALETTE.green}" stroke-width="6" stroke-linecap="round"/>`,
  chart: `<path d="M14 92 L14 8" stroke="${PALETTE.green}" stroke-width="8" stroke-linecap="round"/><path d="M14 92 L92 92" stroke="${PALETTE.green}" stroke-width="8" stroke-linecap="round"/><path d="M24 66 L46 44 L62 56 L88 18" fill="none" stroke="${PALETTE.green}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M68 18 H88 V38" fill="none" stroke="${PALETTE.green}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export const DEFAULT_ICON_KEYS: [string, string, string] = ['shop', 'bot', 'lead'];

export interface CaseBoardNumber {
  value: string;
  label: string;
}

export interface CaseBoardOptions {
  title: string;
  subtitle: string;
  numbers: [CaseBoardNumber, CaseBoardNumber, CaseBoardNumber];
  icons?: [string, string, string]; // ключи из ICONS, по умолчанию DEFAULT_ICON_KEYS
}

function iconSvg(key: string): string {
  const paths = ICONS[key] ?? ICONS.outreach;
  return `<svg viewBox="0 0 100 100" width="92" height="92">${paths}</svg>`;
}

export async function renderCaseBoardCard(opts: CaseBoardOptions): Promise<Buffer> {
  const icons = opts.icons ?? DEFAULT_ICON_KEYS;

  const mascotBuf = readFileSync(join(process.cwd(), 'assets', 'brand', 'mascot_board_transparent.png'));
  const mascotDataUri = `data:image/png;base64,${mascotBuf.toString('base64')}`;

  const logoBuf = readFileSync(join(process.cwd(), 'assets', 'brand', 'logo_wordmark.png'));
  const logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('${FONTS_IMPORT_URL}');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${CANVAS_W}px; height:${CANVAS_H}px; position:relative; overflow:hidden;
    background: ${PALETTE.cream};
    background-image:
      linear-gradient(to right, rgba(22,18,13,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(22,18,13,0.05) 1px, transparent 1px);
    background-size: 44px 44px;
  }

  .title { position:absolute; top:20px; left:40px; max-width:520px; }
  .title h1 { font-family:${FONTS.display}; font-size:38px; font-weight:700; color:${PALETTE.nearBlack}; line-height:1.15; text-transform:uppercase; letter-spacing:-0.02em; }
  .title .sub { margin-top:14px; font-family:${FONTS.mono}; font-size:14px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:#155f2e; }

  .mascot { position:absolute; left:70px; bottom:0px; width:380px; height:470px; object-fit:contain; }

  .board { position:absolute; left:520px; top:210px; width:680px; height:400px; background:${PALETTE.lightCard}; border:5px solid ${PALETTE.nearBlack}; border-radius:22px; }
  .leg { position:absolute; width:16px; height:70px; background:${PALETTE.nearBlack}; border-radius:4px; top:600px; }
  .leg.l1 { left:590px; }
  .leg.l2 { left:1150px; }

  .icons { position:absolute; top:250px; left:520px; width:680px; display:flex; align-items:center; justify-content:center; gap:56px; }
  .arrow { font-family:${FONTS.display}; font-size:36px; color:${PALETTE.green}; }

  .nums { position:absolute; top:466px; left:520px; width:680px; display:flex; justify-content:center; gap:64px; }
  .col { width:170px; text-align:center; }
  .col .n { font-family:${FONTS.display}; font-size:32px; font-weight:700; letter-spacing:-0.03em; color:${PALETTE.green}; display:block; }
  .col .l { font-family:${FONTS.mono}; font-size:13px; font-weight:500; letter-spacing:0.03em; color:${PALETTE.green}; display:inline-block; margin-top:8px; border-bottom:3px solid ${PALETTE.green}; padding-bottom:6px; }

  .logo { position:absolute; bottom:32px; right:50px; height:44px; }
</style></head>
<body>
  <img class="mascot" src="${mascotDataUri}">

  <div class="title">
    <h1>${escapeHtml(opts.title)}</h1>
    <div class="sub">${escapeHtml(opts.subtitle)}</div>
  </div>

  <div class="board"></div>
  <div class="leg l1"></div>
  <div class="leg l2"></div>

  <div class="icons">
    ${iconSvg(icons[0])}
    <span class="arrow">→</span>
    ${iconSvg(icons[1])}
    <span class="arrow">→</span>
    ${iconSvg(icons[2])}
  </div>

  <div class="nums">
    <div class="col"><span class="n">${escapeHtml(opts.numbers[0].value)}</span><span class="l">${escapeHtml(opts.numbers[0].label)}</span></div>
    <div class="col"><span class="n">${escapeHtml(opts.numbers[1].value)}</span><span class="l">${escapeHtml(opts.numbers[1].label)}</span></div>
    <div class="col"><span class="n">${escapeHtml(opts.numbers[2].value)}</span><span class="l">${escapeHtml(opts.numbers[2].label)}</span></div>
  </div>

  <img class="logo" src="${logoDataUri}">
</body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: CANVAS_W, height: CANVAS_H });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.screenshot({ type: 'png' });
    return buf as Buffer;
  } finally {
    await browser.close();
  }
}
