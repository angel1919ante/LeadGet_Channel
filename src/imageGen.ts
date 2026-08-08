import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callLLM } from './llm.ts';
import { buildConceptInstruction, buildFinalPrompt, NEGATIVE_PROMPT } from './brandDesign.ts';

const REFERENCES_DIR = join(process.cwd(), 'references');
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

// Тип поста → папка с референсами. Пока используется только 'новость'.
const POST_TYPE_FOLDER: Record<string, string> = {
  'новость': 'news',
  'фича': 'feature',
  'кейс': 'case',
};

function findReferenceImage(postType: string): string | undefined {
  const folder = POST_TYPE_FOLDER[postType];
  if (!folder) return undefined;
  const dir = join(REFERENCES_DIR, folder);
  try {
    const file = readdirSync(dir).find((f) => IMAGE_EXT.includes(f.slice(f.lastIndexOf('.')).toLowerCase()));
    if (!file) return undefined;
    const buf = readFileSync(join(dir, file));
    const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function generateImageConcept(post: string, postType: string): Promise<string> {
  const prompt = `${buildConceptInstruction(postType)}

Текст поста: ${post}`;
  return callLLM(prompt);
}

// ponytail: raw fetch to Replicate REST API instead of the `replicate` SDK —
// this file already needs only create+poll, matches the fetch-based style of llm.ts/telegram.ts.
//
// Если в references/<postType>/ лежит картинка, передаём её как image_prompt
// (Flux Redux-style reference). ВАЖНО: этот параметр не проверен живым вызовом
// (нет доступа к REPLICATE_API_TOKEN отсюда) — при первом реальном запуске
// с референсом стоит свериться с логами Replicate, что параметр принят.
export async function generateImage(concept: string, postType?: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var missing');

  const fullPrompt = buildFinalPrompt(concept);
  const referenceImage = postType ? findReferenceImage(postType) : undefined;

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: fullPrompt,
        negative_prompt: NEGATIVE_PROMPT,
        width: 1024,
        height: 1024,
        output_format: 'jpg',
        output_quality: 90,
        ...(referenceImage ? { image_prompt: referenceImage } : {}),
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
  return url;
}
