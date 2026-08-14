import './globals.css';
import type { ReactNode } from 'react';
import Nav from './nav';

export const metadata = {
  title: 'LeadGet · Панель',
  description: 'Очередь новостей и контент-план LeadGet',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="shell">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
