'use client';

import { useEffect, useState } from 'react';
import { useMarketStore } from '../store/useMarketStore';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

type StatusState = 'online' | 'offline' | 'checking';

export default function Header() {
  const [status, setStatus] = useState<StatusState>('checking');
  const setPreferencesOpen = useMarketStore((state) => state.setPreferencesOpen);

  useEffect(() => {
    let active = true;
    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (!active) {
          return;
        }
        setStatus(response.ok ? 'online' : 'offline');
      } catch {
        if (active) {
          setStatus('offline');
        }
      }
    }
    checkHealth();
    const timer = setInterval(checkHealth, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const statusColor =
    status === 'online'
      ? 'bg-mint'
      : status === 'offline'
        ? 'bg-coral'
        : 'bg-slate';

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="kicker">Market summary</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">market-summary-ui</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="stat-pill">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="capitalize">Backend {status}</span>
        </div>
        <button
          type="button"
          onClick={() => setPreferencesOpen(true)}
          className="rounded-full border border-ink/10 bg-ink px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:-translate-y-0.5"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
