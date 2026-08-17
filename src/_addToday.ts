import { appendContentPlanRow, getContentPlanRows } from './sheets.ts';
const today = '17.08.2026';
const plans = await getContentPlanRows();
if (plans.some((p) => p.date === today)) {
  console.log('на сегодня уже есть строка, ничего не делаю');
} else {
  await appendContentPlanRow({ date: today, type: 'новость', title: '', token: '', data: '{}' });
  console.log(`добавлена строка "новость" на ${today}`);
}
