'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMarketStore } from '../store/useMarketStore';
import RunSummaryButton from './RunSummaryButton';

function formatRange(start?: number, end?: number): string {
  if (!start || !end) {
    return 'n/a';
  }
  const startText = new Date(start).toLocaleString();
  const endText = new Date(end).toLocaleString();
  return `${startText} → ${endText}`;
}

function parseDateTimeMs(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getRangeError(startTime: string, endTime: string): string | null {
  const startText = startTime.trim();
  const endText = endTime.trim();

  if (!startText && !endText) {
    return null;
  }
  if (!startText || !endText) {
    return 'Start time and end time are required.';
  }

  const startMs = parseDateTimeMs(startText);
  const endMs = parseDateTimeMs(endText);
  if (startMs === null || endMs === null) {
    return 'Start time and end time must be valid date/time values.';
  }
  if (endMs <= startMs) {
    return 'End time must be greater than start time.';
  }
  return null;
}

export default function UploadPanel() {
  const {
    symbol,
    timeframe,
    startTime,
    endTime,
    candles,
    loading,
    preferences,
    setSymbol,
    setTimeframe,
    setStartTime,
    setEndTime,
    setCandles,
    resetResult,
    setError,
    runSummary,
  } = useMarketStore();
  const debounceRef = useRef<number | null>(null);

  const rangeError = useMemo(
    () => getRangeError(startTime, endTime),
    [startTime, endTime],
  );

  const canRun = useMemo(() => {
    return Boolean(startTime.trim() && endTime.trim() && !rangeError);
  }, [endTime, rangeError, startTime]);

  const candleStats = useMemo(() => {
    if (candles.length === 0) {
      return null;
    }
    const start = candles[0].t;
    const end = candles[candles.length - 1].t;
    const lastClose = candles[candles.length - 1].c;
    return {
      count: candles.length,
      range: formatRange(start, end),
      lastClose: lastClose.toFixed(2),
    };
  }, [candles]);

  useEffect(() => {
    if (!preferences.autoRunOnUpload) {
      return;
    }
    if (loading) {
      return;
    }
    if (!canRun) {
      return;
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      runSummary();
    }, 500);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [canRun, loading, preferences.autoRunOnUpload, runSummary, startTime, endTime]);

  const handleSymbolChange = (value: string) => {
    setSymbol(value.toUpperCase());
    setCandles([]);
    resetResult();
    setError(null);
  };

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value);
    setCandles([]);
    resetResult();
    setError(null);
  };

  const handleStartChange = (value: string) => {
    setStartTime(value);
    setCandles([]);
    resetResult();
    setError(null);
  };

  const handleEndChange = (value: string) => {
    setEndTime(value);
    setCandles([]);
    resetResult();
    setError(null);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>Ingest</span>
        <span className="text-xs">Binance candles</span>
      </div>
      <div className="space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-steel">
            Symbol
            <input
              value={symbol}
              onChange={(event) => handleSymbolChange(event.target.value)}
              className="w-full rounded-xl border border-slate/50 bg-white px-4 py-2 text-base text-ink shadow-sm outline-none focus:border-ocean"
              placeholder="BTCUSDT"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-steel">
            Timeframe
            <input
              value={timeframe}
              onChange={(event) => handleTimeframeChange(event.target.value)}
              className="w-full rounded-xl border border-slate/50 bg-white px-4 py-2 text-base text-ink shadow-sm outline-none focus:border-ocean"
              placeholder="5m"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-steel">
            Start time
            <input
              value={startTime}
              onChange={(event) => handleStartChange(event.target.value)}
              className="w-full rounded-xl border border-slate/50 bg-white px-4 py-2 text-base text-ink shadow-sm outline-none focus:border-ocean"
              placeholder="YYYY-MM-DD HH:MM"
              type="datetime-local"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-steel">
            End time
            <input
              value={endTime}
              onChange={(event) => handleEndChange(event.target.value)}
              className="w-full rounded-xl border border-slate/50 bg-white px-4 py-2 text-base text-ink shadow-sm outline-none focus:border-ocean"
              placeholder="YYYY-MM-DD HH:MM"
              type="datetime-local"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RunSummaryButton disabled={!canRun} />
          <p className="text-xs text-steel">
            Select a local date/time range. Binance requires at least 20 candles.
          </p>
        </div>

        {rangeError ? (
          <div className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-2 text-xs text-coral">
            {rangeError}
          </div>
        ) : null}

        <div className="grid gap-3 rounded-2xl border border-slate/40 bg-white/70 p-4 text-xs text-steel md:grid-cols-3">
          <div>
            <p className="kicker">Candles</p>
            <p className="text-base font-semibold text-ink">
              {candleStats ? candleStats.count : 'n/a'}
            </p>
          </div>
          <div>
            <p className="kicker">Time range</p>
            <p className="text-sm text-ink">
              {candleStats ? candleStats.range : 'n/a'}
            </p>
          </div>
          <div>
            <p className="kicker">Last close</p>
            <p className="text-base font-semibold text-ink">
              {candleStats ? candleStats.lastClose : 'n/a'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
