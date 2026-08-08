import { callLLM } from './llm.ts';

const BRAND_STYLE = `industrial editorial, warm bone paper background,
forest green accent #1F7A3D, blueprint grid texture subtle,
hard letterpress offset shadows, marker highlight signature,
confident operator visual language, Russian B2B brand,
clean minimal composition, no people, no faces, no text`;

const NEGATIVE_PROMPT = `no people, no faces, no hands, no text, no watermark,
no clipart, no stock photo look, no neon colors,
no busy composition, no gradients unrelated to brand`;

export async function generateImageConcept(post: string, postType: string): Promise<string> {
  const prompt = `Ты дизайнер LeadGet. На основе поста придумай концепт картинки.
Стиль бренда: industrial editorial, тёплая бумага, зелёный акцент #1F7A3D,
blueprint grid, letterpress тени, B2B оператор. Без людей, без текста.
Тип поста: ${postType}
Текст поста: ${post}
Верни ТОЛЬКО готовый промпт для генерации картинки на английском, одной строкой.`;
  return callLLM(prompt);
}

// ponytail: raw fetch to Replicate REST API instead of the `replicate` SDK —
// this file already needs only create+poll, matches the fetch-based style of llm.ts/telegram.ts.
export async function generateImage(concept: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN env var missing');

  const fullPrompt = `${concept}, ${BRAND_STYLE}, 1:1 square composition, high quality`;

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
