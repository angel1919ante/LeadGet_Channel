// ponytail: одноразовый скрипт для превью-картинки кейса SeoAI в стиле "доска с воронкой", удалить после использования.
import { buildFinalPrompt, MASCOT_DESCRIPTION, STYLE_DESCRIPTORS, AVOID_LIST } from './brandDesign.ts';

const concept = `Minimalist chibi mascot (${MASCOT_DESCRIPTION}) sitting cross-legged next to a large blank whiteboard sign propped on simple legs, holding a marker pen pointing at the board. On the board: three simple flat line-art icons in a horizontal row connected by two right-pointing arrows: first icon a paper airplane (outreach message), second icon a speech bubble (dialogue), third icon a person silhouette with a small checkmark badge (qualified lead). Icons are forest green ${'#1F7A3D'} outline style, evenly spaced, each icon has empty blank space directly below it reserved for a number label (no text, no numbers, no digits anywhere on the board or image). Warm cream background, subtle grid texture, flat solid shapes, thick black outline, no gradients, no shadows, no readable text or numbers anywhere.`;

async function main() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN missing');

  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'references', 'mascot');
  const files = readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).slice(0, 8);
  const input_images = files.map((f) => {
    const buf = readFileSync(join(dir, f));
    const ext = f.split('.').pop()!.toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  });

  const fullPrompt = `${buildFinalPrompt(concept)}`;
  console.log('prompt:', fullPrompt.slice(0, 300));

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-max/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      input: {
        prompt: fullPrompt,
        input_images,
        aspect_ratio: '16:9',
        resolution: '2 MP',
        output_format: 'jpg',
        output_quality: 90,
      },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate ${createRes.status}: ${await createRes.text()}`);
  let prediction = await createRes.json();
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await (await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (prediction.status !== 'succeeded') throw new Error(`Replicate ${prediction.status}`);
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  console.log(`BOARD_URL: ${url}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
