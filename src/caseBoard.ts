// Постоянный рендерер кейс-борда: маскот у доски с воронкой из 3 иконок.
// Flux рисует сцену (маскот + доска + иконки, без текста), заголовок/цифры/лого
// накладываются точным HTML+puppeteer рендером — с реальными шрифтами design system.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { buildCaseBoardConcept, DEFAULT_CASE_ICONS, FONTS_IMPORT_URL, FONTS, PALETTE } from './brandDesign.ts';

const CANVAS_W = 1280;
const CANVAS_H = 720;

async function generateBoardArt(icons: [string, string, string]): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var missing');

  const refDir = join(process.cwd(), 'references', 'mascot');
  const files = readdirSync(refDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).slice(0, 8);
  const input_images = files.map((f) => {
    const buf = readFileSync(join(refDir, f));
    const ext = f.split('.').pop()!.toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  });

  const prompt = buildCaseBoardConcept(icons);
  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-max/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      input: { prompt, input_images, aspect_ratio: '16:9', resolution: '1 MP', output_format: 'jpg', output_quality: 90 },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate ${createRes.status}: ${await createRes.text()}`);

  let prediction = await createRes.json() as { status: string; output?: string | string[]; urls: { get: string } };
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await (await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (prediction.status !== 'succeeded') throw new Error(`Replicate board art ${prediction.status}`);

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url) throw new Error('Replicate returned no board art URL');

  const imgRes = await fetch(url);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface CaseBoardNumber {
  value: string;
  label: string;
}

export interface CaseBoardOptions {
  title: string;
  subtitle: string;
  numbers: [CaseBoardNumber, CaseBoardNumber, CaseBoardNumber];
  icons?: [string, string, string];
}

// Координаты подобраны под то, как Flux по этому промпту обычно кладёт доску
// в кадр 16:9. Могут потребовать подстройки, если композиция сильно уедет —
// это визуальная калибровка, не логическая ошибка.
export async function renderCaseBoardCard(opts: CaseBoardOptions): Promise<Buffer> {
  const icons = opts.icons ?? DEFAULT_CASE_ICONS;
  const boardDataUri = await generateBoardArt(icons);

  const logoBuf = readFileSync(join(process.cwd(), 'assets', 'brand', 'logo_wordmark.png'));
  const logoDataUri = `data:image/png;base64,${logoBuf.toString('base64')}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('${FONTS_IMPORT_URL}');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${CANVAS_W}px; height:${CANVAS_H}px; position:relative; overflow:hidden; }
  img.bg { position:absolute; top:0; left:0; width:${CANVAS_W}px; height:${CANVAS_H}px; object-fit:cover; }

  .title { position:absolute; top:20px; left:40px; max-width:600px; }
  .title h1 { font-family:${FONTS.display}; font-size:40px; font-weight:700; color:${PALETTE.nearBlack}; line-height:1.15; text-transform:uppercase; letter-spacing:-0.02em; }
  .title .sub { margin-top:16px; font-family:${FONTS.mono}; font-size:15px; font-weight:500; letter-spacing:0.07em; text-transform:uppercase; color:#155f2e; }

  .col { position:absolute; top:408px; width:150px; text-align:center; }
  .col .n { font-family:${FONTS.display}; font-size:32px; font-weight:700; letter-spacing:-0.03em; color:${PALETTE.green}; display:block; }
  .col .l { font-family:${FONTS.mono}; font-size:13px; font-weight:500; letter-spacing:0.03em; color:${PALETTE.green}; display:inline-block; margin-top:8px; border-bottom:3px solid ${PALETTE.green}; padding-bottom:6px; }
  .col.c1 { left:579px; }
  .col.c2 { left:753px; }
  .col.c3 { left:921px; }

  .logo { position:absolute; bottom:32px; right:50px; height:48px; }
</style></head>
<body>
  <img class="bg" src="${boardDataUri}">
  <div class="title">
    <h1>${escapeHtml(opts.title)}</h1>
    <div class="sub">${escapeHtml(opts.subtitle)}</div>
  </div>
  <div class="col c1"><span class="n">${escapeHtml(opts.numbers[0].value)}</span><span class="l">${escapeHtml(opts.numbers[0].label)}</span></div>
  <div class="col c2"><span class="n">${escapeHtml(opts.numbers[1].value)}</span><span class="l">${escapeHtml(opts.numbers[1].label)}</span></div>
  <div class="col c3"><span class="n">${escapeHtml(opts.numbers[2].value)}</span><span class="l">${escapeHtml(opts.numbers[2].label)}</span></div>
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
