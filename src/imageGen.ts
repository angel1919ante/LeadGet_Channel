import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callLLM } from './llm.ts';
import { buildConceptInstruction, buildAnimationPrompt, buildFinalPrompt } from './brandDesign.ts';

const REFERENCES_DIR = join(process.cwd(), 'references', 'mascot');
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_REFERENCES = 8; // лимит flux-2-max input_images

// Референсы маскота одни на все типы постов — flux-2-max держит консистентность
// персонажа лучше по нескольким референсам сразу (лицо, поза, одежда, палитра),
// поэтому передаём все файлы из папки, а не один случайный.
function findReferenceImages(): string[] {
  try {
    const files = readdirSync(REFERENCES_DIR)
      .filter((f) => IMAGE_EXT.includes(f.slice(f.lastIndexOf('.')).toLowerCase()))
      .slice(0, MAX_REFERENCES);
    return files.map((file) => {
      const buf = readFileSync(join(REFERENCES_DIR, file));
      const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return `data:image/${mime};base64,${buf.toString('base64')}`;
    });
  } catch {
    return [];
  }
}

export async function generateImageConcept(post: string, postType: string): Promise<string> {
  const prompt = `${buildConceptInstruction(postType)}

Текст поста: ${post}`;
  const concept = await callLLM(prompt);
  console.log(`image concept [${postType}]: ${concept}`);
  return concept;
}

// ponytail: raw fetch to Replicate REST API instead of the `replicate` SDK —
// this file already needs only create+poll, matches the fetch-based style of llm.ts/telegram.ts.
//
// flux-2-max держит персонажа консистентным по нескольким референсам сразу
// (лицо, поза, одежда, палитра) — передаём все файлы из references/mascot/
// как input_images. У модели нет negative_prompt, поэтому запреты уже вшиты
// в текст промпта через buildFinalPrompt.
export async function generateImage(concept: string, postType?: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var missing');

  const fullPrompt = buildFinalPrompt(concept);
  const referenceImages = findReferenceImages();
  console.log(`generateImage [${postType}]: references=${referenceImages.length}`);

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-max/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: fullPrompt,
        input_images: referenceImages,
        aspect_ratio: '1:1',
        resolution: '2 MP',
        output_format: 'jpg',
        output_quality: 90,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate ${createRes.status}: ${err}`);
  }

  let prediction = (await createRes.json()) as {
    id: string;
    status: string;
    output?: string | string[];
    urls: { get: string };
  };

  // Prefer: wait уже дожидается завершения на стороне Replicate,
  // но на случай тайм-аута всё равно поллим до финального статуса.
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`Replicate prediction ${prediction.status}`);
  }

  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error('Replicate returned no output URL');
  console.log(`generateImage done: ${url}`);
  return url;
}

// wan2.1-i2v-480p: берёт готовую картинку и анимирует её.
// Используется только для фич-постов (⚡).
export async function generateAnimation(imageUrl: string, concept: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var missing');

  const animPrompt = buildAnimationPrompt(concept);

  const createRes = await fetch('https://api.replicate.com/v1/models/wan-video/wan2.1-i2v-480p/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        image: imageUrl,
        prompt: animPrompt,
        num_frames: 81,
        frames_per_second: 16,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate wan2.1 ${createRes.status}: ${err}`);
  }

  let prediction = (await createRes.json()) as {
    id: string;
    status: string;
    output?: string | string[];
    urls: { get: string };
  };

  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    await new Promise((r) => setTimeout(r, 4000));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`Replicate wan2.1 prediction ${prediction.status}`);
  }

  const output = prediction.output;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error('Replicate wan2.1 returned no output URL');
  return url;
}
