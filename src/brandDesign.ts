// Дизайн-система LeadGet для генерации иллюстраций.
// Источник: бренд-ТЗ (аватарки/посты/кейсы). Логотип, точный текст и сетку
// карточек кейсов сюда не тащим — это отдельный детерминированный SVG/HTML-рендерер.
// Здесь только то, что реально можно и нужно точно запромптить в text-to-image.

export const PALETTE = {
  nearBlack: '#16120D',
  green: '#1F7A3D',
  cream: '#F4F1EA',
  lightCard: '#FBF9F4',
  secondaryText: '#4A4339',
};

export const MASCOT_DESCRIPTION = `a minimalist human-like mascot character:
always wearing a plain black hoodie, a long forest-green cap with an elongated
bill, glasses in a simple non-cartoonish style (not round joke-glasses), a
minimalist stylish face that is neither childish nor overly cartoonish, a tiny
green brand mark on the hoodie as a subtle detail, no visible shadows, no
gradients, clean white or cream background around the character, thick even
black outline, flat solid shapes only, this is NOT a robot`;

// Позы/эмоции по смыслу поста — концепт должен выбирать ОДНУ, подходящую
// под тон конкретного поста, а не повторять одну и ту же от поста к посту.
export const POSE_OPTIONS = [
  {
    context: 'приветствие / позитивная новость',
    pose: 'friendly warm smile, slightly narrowed happy eyes, one hand raised in a casual wave',
  },
  {
    context: 'аналитика / кейс / разбор',
    pose: 'focused thoughtful expression, standing at a marker whiteboard, writing or looking at notes',
  },
  {
    context: 'объяснение механики / как это работает',
    pose: 'pointing at a simple diagram, funnel scheme, or metrics chart on a board',
  },
] as const;

// Реквизит — меняется от поста к посту, не повторяем чашку кофе в каждой картинке.
export const PROP_OPTIONS = [
  'a marker whiteboard with a simple abstract diagram (no readable text)',
  'a laptop on a small simple table',
  'a simple funnel-shaped diagram sketch',
  'a small stack of paper cards on a table',
  'simple minimal furniture, a small table',
  'a cat resting on a small green cushion as a secondary cozy detail',
] as const;

export const AVOID_LIST = `no robots, no drones, no digital ravens, no beacons,
no couriers, no navigators, no faceless IT structures, no 3D render, no glossy
surfaces, no photorealistic people, no cyberpunk, no purple or blue gradients,
no neon glow, no UI/interface clichés, no oversized cartoon faces, no giant
noses, no balaclavas, no weird round joke-glasses, no extra facial details,
no chaotic or busy backgrounds, no repeated identical coffee cup prop, no
random unrelated props, no repeated identical pose across images, no text,
no logos, no watermark, no readable letters or numbers anywhere in the image`;

export const STYLE_DESCRIPTORS = `flat illustration, zine/sticker aesthetic,
thick even black outline, flat solid shapes, no gradients, no textures, no
halftone dots, no 3D, no photorealism, calm structured B2B editorial
composition, warm cream background ${PALETTE.cream}, subtle low-opacity square
grid texture on the background, forest green ${PALETTE.green} used only as an
accent (arrows, dots, small marks, highlights) never as a full-image fill,
near-black ${PALETTE.nearBlack} linework`;

export function buildConceptInstruction(postType: string): string {
  const poses = POSE_OPTIONS.map((p) => `- ${p.context}: ${p.pose}`).join('\n');
  const props = PROP_OPTIONS.map((p) => `- ${p}`).join('\n');
  return `Ты дизайнер бренда LeadGet. Работай строго по дизайн-системе.

МАСКОТ (используй только если по смыслу поста уместен персонаж):
${MASCOT_DESCRIPTION}

Выбери ОДНУ позу/эмоцию, подходящую тону этого конкретного поста (не повторяй одну и ту же от поста к посту):
${poses}

Выбери подходящий реквизит из списка, не используй чашку кофе, если можно обойтись без неё:
${props}

СТИЛЬ: ${STYLE_DESCRIPTORS}

ЗАПРЕЩЕНО: ${AVOID_LIST}

Тип поста: ${postType}
Текст поста ниже. Придумай на его основе конкретный визуальный концепт: что происходит на картинке, какая поза, какой реквизит, какая композиция.
Верни ТОЛЬКО готовый промпт для генерации картинки на английском, одной строкой, максимально конкретный и детальный (что именно на картинке, поза, реквизит, композиция).`;
}

export function buildFinalPrompt(concept: string): string {
  return `${concept}, ${STYLE_DESCRIPTORS}, 1:1 square composition, high quality, highly detailed flat illustration`;
}

export const NEGATIVE_PROMPT = AVOID_LIST;
