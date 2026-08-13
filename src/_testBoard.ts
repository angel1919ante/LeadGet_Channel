// ponytail: быстрый цикл теста только картинки борда, без LLM-текста. Удалить после использования.
import { renderCaseBoardCard } from './caseBoard.ts';
import { writeFileSync } from 'node:fs';

async function main() {
  const buf = await renderCaseBoardCard({
    title: 'Анкрайт v1',
    subtitle: 'Выход на аудиторию в Telegram',
    numbers: [
      { value: '279', label: 'отправок' },
      { value: '16', label: 'квал. лидов' },
      { value: '5.7%', label: 'конверсия' },
    ],
  });
  writeFileSync('board_test.png', buf);
  console.log('saved board_test.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
