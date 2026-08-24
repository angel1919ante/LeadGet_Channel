import { ensureArticleSheet } from './sheets.ts';

ensureArticleSheet()
  .then(() => console.log('Articles sheet ready'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
