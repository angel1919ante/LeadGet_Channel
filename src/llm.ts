const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

// Промпт можно разбить на статичную часть (правила, TZ — одинаковую между
// вызовами в одном цикле) и динамичную (конкретные данные). Anthropic-модели
// на OpenRouter кэшируют статичный блок через cache_control — платим за него
// один раз за 5 минут, а не при каждом вызове в цикле.
export type Prompt = string | { cached: string; dynamic: string };

export async function callLLM(prompt: Prompt): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY env var missing');

  const content = typeof prompt === 'string'
    ? prompt
    : [
        { type: 'text', text: prompt.cached, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: prompt.dynamic },
      ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/angel1919ante/LeadGet_Channel',
      'X-Title': 'LeadGet Channel Bot',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned empty content');
  return text;
}
