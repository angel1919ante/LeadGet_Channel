// ponytail: одноразовая генерация недостающей позы маскота (держит ручку), удалить после использования.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MASCOT_DESCRIPTION = `a minimalist chibi-style mascot character:
always sitting cross-legged on the ground in a compact rounded pose, stubby
simplified round body, always wearing a plain black hoodie, a long
forest-green cap with an elongated bill, glasses in a simple non-cartoonish
style (not round joke-glasses), a minimalist stylish face that is neither
childish nor overly cartoonish, a tiny green brand mark on the hoodie as a
subtle detail, no visible shadows, no gradients, clean warm cream background
around the character, thick even black outline, flat solid shapes only,
this is NOT a robot`;

const concept = `${MASCOT_DESCRIPTION}. The mascot's right hand holds a green marker pen, arm raised and extended toward the right side of the frame as if pointing at or about to write on something just off-frame to the right (the pointed object itself is NOT in the image, only the mascot and pen). The left hand (not holding the pen) rests empty and open on its own knee, holding nothing. Warm cream background #F4F1EA with subtle low-opacity square grid texture, flat solid shapes, thick black outline, no gradients, no shadows, no other objects, no board, no text, no numbers.`;

async function main() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN missing');

  const refDir = join(process.cwd(), 'references', 'mascot');
  const files = readdirSync(refDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).slice(0, 8);
  const input_images = files.map((f) => {
    const buf = readFileSync(join(refDir, f));
    const ext = f.split('.').pop()!.toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  });

  const fullPrompt = `${concept}, flat illustration, zine/sticker aesthetic, calm structured B2B editorial composition, 1:1 square composition, high quality, highly detailed flat illustration. Avoid: no robots, no photorealism, no 3D, no extra limbs, no extra arms, no extra hands, no third arm, no deformed fingers, no standing pose, exactly two arms and two hands`;

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-max/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      input: { prompt: fullPrompt, input_images, aspect_ratio: '1:1', resolution: '1 MP', output_format: 'png', output_quality: 90 },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate ${createRes.status}: ${await createRes.text()}`);

  let prediction = await createRes.json() as { status: string; output?: string | string[]; urls: { get: string } };
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    prediction = await (await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (prediction.status !== 'succeeded') throw new Error(`Replicate ${prediction.status}`);

  const outputs = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
  for (let i = 0; i < outputs.length; i++) {
    const url = outputs[i];
    if (!url) continue;
    const imgRes = await fetch(url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(`pen_pose_${i}.png`, buf);
    console.log(`saved pen_pose_${i}.png`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
