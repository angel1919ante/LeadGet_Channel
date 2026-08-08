// Дизайн-система LeadGet для генерации иллюстраций.
// Стиль: industrial editorial, без людей и маскота.
// Логотип, точный текст и карточки кейсов — отдельный SVG/HTML рендерер.

const BASE_PROMPTS: Record<string, string> = {
  новость: `Industrial editorial news graphic, warm bone paper background,
forest green #1F7A3D accent, abstract data visualization,
blueprint grid texture, letterpress aesthetic,
minimal operator brand, no text, no people`,

  фича: `Industrial editorial graphic, warm bone paper background,
forest green #1F7A3D geometric shapes, lightning bolt element,
blueprint grid texture, letterpress offset shadow,
bold minimal composition, no text, no people`,

  кейс: `Industrial editorial illustration, warm bone paper texture background,
forest green #1F7A3D accent lines, upward growth chart,
letterpress shadow, blueprint grid overlay subtle,
marker highlight on key number, bold confident composition,
no text, no people`,
};

// Контекстные добавки по теме поста (для новостей и кейсов)
const TOPIC_CONTEXTS: Record<string, string> = {
  'реклама/рынок': 'bar chart, funnel, conversion abstract',
  'ии/технологии': 'neural network nodes, circuit minimal',
  'telegram/мессенджеры': 'chat bubble abstract, message flow',
  'регуляторика': 'shield, document abstract elements',
  // кейсы по нише
  'образование': 'education icons, graduation elements',
  'it/b2b': 'laptop, code elements, server',
  'horeca': 'restaurant, food service elements',
  'недвижимость': 'building, architecture elements',
};

export const NEGATIVE_PROMPT = `no text, no logos, no watermark, no readable letters,
no people, no faces, no mascot, no robot, no 3D render,
no photorealism, no gradients, no neon, no cyberpunk,
no purple or blue color dominance, no busy backgrounds`;

export function buildConceptInstruction(postType: string): string {
  const base = BASE_PROMPTS[postType] ?? BASE_PROMPTS['новость'];
  const contexts = Object.entries(TOPIC_CONTEXTS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `Ты арт-директор бренда LeadGet. Стиль: industrial editorial, без людей.

Базовый промпт для типа "${postType}":
${base}

Доступные контекстные добавки по теме поста:
${contexts}

Прочитай текст поста и:
1. Выбери одну подходящую контекстную добавку (или придумай похожую если ни одна не подходит)
2. Для типа "фича" — добавь краткое абстрактное описание того, что делает фича (без людей, только геометрия/схема)
3. Соедини базовый промпт + добавку в одну строку

Верни ТОЛЬКО итоговый промпт для генерации картинки на английском, одной строкой.`;
}

export function buildFinalPrompt(concept: string): string {
  return `${concept}, high quality, highly detailed flat illustration, 1:1 square composition`;
}
