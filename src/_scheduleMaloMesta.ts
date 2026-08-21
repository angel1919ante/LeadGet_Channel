// Кейс "Мало Места" (мебель-трансформер) на Пт 28.08, новость с этого
// слота переносим на Вс 30.08 (переиспользуем пустой слот row 17).
import { updateContentPlanRow } from './sheets.ts';

async function main() {
  // row 16: новость 28.08 -> 30.08 (сам пост уже опубликован, просто сдвигаем дату слота)
  await updateContentPlanRow(16, { date: '30.08.2026' });
  console.log('row 16 -> 30.08.2026');

  // row 17: было пустым approved-слотом на 30.08 -> становится кейсом на 28.08
  await updateContentPlanRow(17, {
    date: '28.08.2026',
    type: 'кейс',
    title: '',
    token: 'malo-mesta-manual',
    status: 'approved',
    data: JSON.stringify({
      niche: 'производитель мебели-трансформеров',
      task: 'поиск дилеров и магазинов-партнёров для расширения розничной сети в регионах',
      mechanics: 'рассылка по базе владельцев мебельных магазинов и салонов в Telegram, квалификация через диалог с ИИ-агентом',
      summaryOverride: { sent: 498, replied: 213, engaged: 171, leads: 10 },
    }),
  });
  console.log('row 17 -> кейс на 28.08.2026');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
