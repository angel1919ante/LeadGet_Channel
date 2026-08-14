// Детерминированный рендерер кейс-борда по спеку references/case-cards/case-preview-spec.md.
// Холст 1672×941, все координаты — точные значения из спека. Маскот статичный
// (references/mascot), доска/иконки/стрелки/цифры/лого — SVG/HTML. Без Flux.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { FONTS, PALETTE } from './brandDesign.ts';

const CANVAS_W = 1672;
const CANVAS_H = 941;
const GRID = '#D9D4CA';
const HAND_FONT = "'Caveat', cursive";
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700;800&family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Caveat:wght@600;700&display=swap&subset=cyrillic,cyrillic-ext,latin';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Библиотека иконок доски. По спеку: источник — чёрная заливка, действие и
// результат — зелёный контур. Набор по умолчанию: магазин → бот → лид.
const ICONS: Record<string, string> = {
  shop: `<path d="M4 32 L12 10 H88 L96 32 Z" fill="${PALETTE.nearBlack}"/><rect x="10" y="32" width="80" height="58" fill="${PALETTE.nearBlack}"/><rect x="20" y="42" width="20" height="20" fill="${PALETTE.cream}"/><rect x="60" y="42" width="20" height="20" fill="${PALETTE.cream}"/><rect x="42" y="68" width="16" height="22" fill="${PALETTE.cream}"/>`,
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
  const paths = ICONS[key] ?? ICONS.shop;
  return `<svg viewBox="0 0 100 100" width="130" height="130">${paths}</svg>`;
}

function arrowSvg(): string {
  return `<svg width="60" height="24" viewBox="0 0 60 24"><line x1="2" y1="12" x2="44" y2="12" stroke="${PALETTE.nearBlack}" stroke-width="8" stroke-linecap="round"/><path d="M38 1 L59 12 L38 23 Z" fill="${PALETTE.nearBlack}"/></svg>`;
}

// Центры трёх иконок/колонок метрик — точные значения из спека (п.7.1).
const COL_X = [810, 1080, 1340];

export async function renderCaseBoardCard(opts: CaseBoardOptions): Promise<Buffer> {
  const icons = opts.icons ?? DEFAULT_ICON_KEYS;

  const mascotBuf = readFileSync(join(process.cwd(), 'assets', 'brand', 'mascot_board_transparent.png'));
  const mascotDataUri = `data:image/png;base64,${mascotBuf.toString('base64')}`;

  const logoBuf = readFileSync(join(process.cwd(), 'assets', 'brand', 'logo_wordmark.png'));
  const logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;

  const cols = [0, 1, 2].map((i) => `
    <div class="metric" style="left:${COL_X[i]}px">
      <span class="n">${escapeHtml(opts.numbers[i].value)}</span>
      <span class="l">${escapeHtml(opts.numbers[i].label)}</span>
      <span class="underline"></span>
    </div>`).join('');

  const iconsRow = `
    <div class="icons">
      <div class="icon-cell" style="left:${COL_X[0]}px">${iconSvg(icons[0])}</div>
      <div class="arrow-cell" style="left:${(COL_X[0] + COL_X[1]) / 2}px">${arrowSvg()}</div>
      <div class="icon-cell" style="left:${COL_X[1]}px">${iconSvg(icons[1])}</div>
      <div class="arrow-cell" style="left:${(COL_X[1] + COL_X[2]) / 2}px">${arrowSvg()}</div>
      <div class="icon-cell" style="left:${COL_X[2]}px">${iconSvg(icons[2])}</div>
    </div>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('${FONTS_URL}');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${CANVAS_W}px; height:${CANVAS_H}px; position:relative; overflow:hidden;
    background: ${PALETTE.cream};
    background-image:
      linear-gradient(to right, ${GRID}4d 1px, transparent 1px),
      linear-gradient(to bottom, ${GRID}4d 1px, transparent 1px);
    background-size: 56px 56px;
  }

  .title { position:absolute; left:64px; top:54px; width:900px; }
  .title h1 { font-family:${FONTS.display}; font-size:80px; font-weight:700; color:${PALETTE.nearBlack}; line-height:0.95; letter-spacing:-0.01em; }
  .sub { position:absolute; left:68px; top:279px; font-family:${FONTS.mono}; font-size:27px; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; color:${PALETTE.green}; }

  .mascot { position:absolute; left:145px; top:345px; width:520px; height:513px; object-fit:contain; object-position:bottom center; }

  .board { position:absolute; left:665px; top:318px; width:853px; height:444px; background:${PALETTE.lightCard}; border:7px solid ${PALETTE.nearBlack}; border-radius:18px; }
  .leg { position:absolute; top:756px; width:18px; height:38px; background:${PALETTE.nearBlack}; border-radius:3px; }
  .leg::after { content:''; position:absolute; left:-9px; bottom:-7px; width:36px; height:9px; background:${PALETTE.nearBlack}; border-radius:3px; }
  .leg.l1 { left:${COL_X[0] - 9}px; }
  .leg.l2 { left:${COL_X[2] - 9}px; }

  .icons { position:absolute; top:415px; left:0; }
  .icon-cell { position:absolute; top:0; transform:translateX(-50%); }
  .arrow-cell { position:absolute; top:53px; transform:translateX(-50%); }

  .metric { position:absolute; top:565px; width:220px; margin-left:-110px; text-align:center; }
  .metric .n { display:block; font-family:${FONTS.display}; font-size:54px; font-weight:700; letter-spacing:-0.02em; color:${PALETTE.green}; }
  .metric .l { display:block; font-family:${HAND_FONT}; font-size:31px; font-weight:700; color:${PALETTE.green}; margin-top:2px; }
  .metric .underline { display:block; width:110px; height:3px; background:${PALETTE.green}; margin:6px auto 0; }

  .logo { position:absolute; right:64px; bottom:41px; width:385px; }
</style></head>
<body>
  <img class="mascot" src="${mascotDataUri}">

  <div class="title"><h1>Кейс:<br>${escapeHtml(opts.title)}</h1></div>
  <div class="sub">${escapeHtml(opts.subtitle)}</div>

  <div class="board"></div>
  <div class="leg l1"></div>
  <div class="leg l2"></div>

  ${iconsRow}

  ${cols}

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
