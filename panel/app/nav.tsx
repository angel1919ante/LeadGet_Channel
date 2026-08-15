'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="nav">
      <div className="brand">LeadGet<span className="dot">.</span> Панель</div>
      <div className="tabs">
        <Link href="/" className={`tab ${pathname === '/' ? 'active' : ''}`}>Новости</Link>
        <Link href="/cases" className={`tab ${pathname === '/cases' ? 'active' : ''}`}>Кейсы</Link>
        <Link href="/features" className={`tab ${pathname === '/features' ? 'active' : ''}`}>Фичи</Link>
        <Link href="/plan" className={`tab ${pathname === '/plan' ? 'active' : ''}`}>План</Link>
        <Link href="/preferences" className={`tab ${pathname === '/preferences' ? 'active' : ''}`}>Настройки</Link>
      </div>
    </div>
  );
}
