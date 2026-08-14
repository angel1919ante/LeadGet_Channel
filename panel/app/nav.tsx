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
        <Link href="/plan" className={`tab ${pathname === '/plan' ? 'active' : ''}`}>План</Link>
      </div>
    </div>
  );
}
