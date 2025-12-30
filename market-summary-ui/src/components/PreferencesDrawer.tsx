'use client';

import { useEffect } from 'react';
import { useMarketStore } from '../store/useMarketStore';

export default function PreferencesDrawer() {
  const {
    preferencesOpen,
    setPreferencesOpen,
    preferences,
    setPreferences,
  } = useMarketStore();

  useEffect(() => {
    if (!preferencesOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreferencesOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [preferencesOpen, setPreferencesOpen]);

  if (!preferencesOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close preferences"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={() => setPreferencesOpen(false)}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col gap-6 border-l border-slate/20 bg-white/90 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="kicker">Controls</p>
            <h2 className="text-2xl font-semibold text-ink">Preferences</h2>
          </div>
          <button
            type="button"
            onClick={() => setPreferencesOpen(false)}
            className="rounded-full border border-slate/40 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-steel"
          >
            Close
          </button>
        </div>

        <div className="space-y-5">
          <label className="space-y-2 text-sm font-medium text-steel">
            Tone
            <select
              value={preferences.style}
              onChange={(event) =>
                setPreferences({
                  style: event.target.value as 'auction_pro' | 'simple',
                })
              }
              className="w-full rounded-xl border border-slate/50 bg-white px-4 py-2 text-base text-ink shadow-sm outline-none focus:border-ocean"
            >
              <option value="auction_pro">Auction pro</option>
              <option value="simple">Simple</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-steel">
            Length
            <select
              value={preferences.length}
              onChange={(event) =>
                setPreferences({
                  length: event.target.value as 'short' | 'medium' | 'long',
                })
              }
              className="w-full rounded-xl border border-slate/50 bg-white px-4 py-2 text-base text-ink shadow-sm outline-none focus:border-ocean"
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>

          <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate/40 bg-white/70 p-4 text-sm text-steel">
            <div>
              <p className="text-base font-semibold text-ink">Include levels</p>
              <p className="text-xs text-steel">
                Ask the model to include key supply, support, and rejection zones.
              </p>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-ocean"
              checked={preferences.includeLevels}
              onChange={(event) =>
                setPreferences({ includeLevels: event.target.checked })
              }
            />
          </label>

          <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate/40 bg-white/70 p-4 text-sm text-steel">
            <div>
              <p className="text-base font-semibold text-ink">Auto-run on range change</p>
              <p className="text-xs text-steel">
                Automatically call the backend after you update the time range.
              </p>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-ocean"
              checked={preferences.autoRunOnUpload}
              onChange={(event) =>
                setPreferences({ autoRunOnUpload: event.target.checked })
              }
            />
          </label>
        </div>
      </aside>
    </div>
  );
}
