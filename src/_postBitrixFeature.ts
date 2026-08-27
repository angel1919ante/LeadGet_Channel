// Срочный пост: интеграция с Bitrix24 — формат инструкции, не стандартный
// feature-шаблон (как и amoCRM ранее). Текст собран напрямую, без LLM —
// контент уже готовый (клиентская инструкция), просто оформляем для канала.
import { updateContentPlanRow, appendContentPlanRow, getContentPlanRows } from './sheets.ts';
import { formatPost } from './formatter.ts';
import { postAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL!;

const RAW = `⚡️ Теперь LeadGet подключается к вашему Bitrix24

Когда у клиента в кампании появляется лид, LeadGet теперь может передавать его прямо в CRM Bitrix24: не нужно вручную заводить сделки.

⚙️ Как подключить:

1. В левой панели откройте «Приложения» → «Разработчикам» → «Другое» → «Входящий вебхук».

2. В настройке прав добавьте «CRM» (\`crm\`) и «Пользователи» (\`user\`), нажмите «Создать».

3. Скопируйте поле «Вебхук для вызова rest api» (например, https://b24-erf6h0.bitrix24.ru/rest/1/n5fem72g4d40p42p/) и передайте менеджеру LeadGet.

✅ Готово. Лиды будут приходить в ваш Bitrix24 автоматически, по мере квалификации.

Напишите менеджеру @LeadGet_info 📱, подключим интеграцию для вашей кампании.`;

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function main() {
  const formatted = await formatPost(RAW);
  console.log('----- TEXT -----');
  console.log(formatted.replace(/<[^>]+>/g, ''));

  const messageId = await postAsUser(channel, formatted);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${pad(today.getUTCDate())}.${pad(today.getUTCMonth() + 1)}.${today.getUTCFullYear()}`;
  await appendContentPlanRow({ date: dateStr, type: 'фича', title: 'Интеграция с Bitrix24', token: '', data: '{}' });
  const rows = await getContentPlanRows();
  const newRow = rows.find((r) => r.date === dateStr && r.type === 'фича' && r.title === 'Интеграция с Bitrix24');
  if (newRow) {
    await updateContentPlanRow(newRow.rowNumber, { status: 'posted', post: formatted, postUrl });
    console.log(`ContentPlan row ${newRow.rowNumber} -> posted`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
