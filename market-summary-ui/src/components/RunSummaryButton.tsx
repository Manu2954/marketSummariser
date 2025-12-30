'use client';

import { useMarketStore } from '../store/useMarketStore';

type RunSummaryButtonProps = {
  disabled?: boolean;
  onClick?: () => void;
};

export default function RunSummaryButton({ disabled, onClick }: RunSummaryButtonProps) {
  const { loading, runSummary } = useMarketStore();
  const handleClick = onClick ?? runSummary;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-soft transition hover:-translate-y-0.5 disabled:opacity-60"
      disabled={loading || disabled}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : null}
      {loading ? 'Generating…' : 'Generate Summary'}
    </button>
  );
}
