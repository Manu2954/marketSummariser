'use client';

import { useMemo, useState } from 'react';
import JsonViewer from './JsonViewer';
import { useMarketStore } from '../store/useMarketStore';

const tabs = ['Narrative', 'Structured', 'FeatureReport'] as const;

type TabKey = (typeof tabs)[number];

type FeatureReport = Record<string, unknown> & {
  meta?: { symbol?: string; timeframe?: string };
  state?: { regime?: string; confidence?: number };
  qualityFlags?: { missingExtras?: string[]; notes?: string[] };
};

type LlmSummary = Record<string, unknown> & {
  state?: { auction?: string; confidence?: number };
  levels?: { overheadSupply?: number[][]; support?: number[][] };
  summary?: { invalidate_if?: string[]; details?: string[]; one_liner?: string };
};

function copyToClipboard(value: string, onSuccess: () => void, onError: () => void) {
  if (!navigator.clipboard) {
    onError();
    return;
  }
  navigator.clipboard.writeText(value).then(onSuccess).catch(onError);
}

export default function SummaryPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('Narrative');
  const [copyState, setCopyState] = useState<string>('');
  const { featureReport, llmSummary, text, error } = useMarketStore();

  const typedFeature = featureReport as FeatureReport | null;
  const typedSummary = llmSummary as LlmSummary | null;

  const metaChips = useMemo(() => {
    const symbol = typedFeature?.meta?.symbol ?? 'n/a';
    const timeframe = typedFeature?.meta?.timeframe ?? 'n/a';
    const regime = typedFeature?.state?.regime ?? 'n/a';
    const confidence = typedFeature?.state?.confidence;
    const confidenceText =
      typeof confidence === 'number' ? confidence.toFixed(2) : 'n/a';
    return { symbol, timeframe, regime, confidenceText };
  }, [typedFeature]);

  const structuredDetails = useMemo(() => {
    const overhead = Array.isArray(typedSummary?.levels?.overheadSupply)
      ? typedSummary?.levels?.overheadSupply
      : [];
    const support = Array.isArray(typedSummary?.levels?.support)
      ? typedSummary?.levels?.support
      : [];
    return {
      auction: typedSummary?.state?.auction ?? 'n/a',
      confidence:
        typeof typedSummary?.state?.confidence === 'number'
          ? typedSummary?.state?.confidence?.toFixed(2)
          : 'n/a',
      levels: {
        overheadSupply: overhead,
        support,
      },
      invalidation: typedSummary?.summary?.invalidate_if ?? [],
      details: typedSummary?.summary?.details ?? [],
      oneLiner: typedSummary?.summary?.one_liner ?? '',
    };
  }, [typedSummary]);

  const qualityFlags = useMemo(() => {
    return {
      missingExtras: typedFeature?.qualityFlags?.missingExtras ?? [],
      notes: typedFeature?.qualityFlags?.notes ?? [],
    };
  }, [typedFeature]);

  const handleCopyText = () => {
    if (!text) {
      setCopyState('No narrative to copy.');
      return;
    }
    copyToClipboard(
      text,
      () => setCopyState('Narrative copied.'),
      () => setCopyState('Copy failed.'),
    );
  };

  const handleCopyJson = () => {
    const data = activeTab === 'FeatureReport' ? featureReport : llmSummary;
    if (!data) {
      setCopyState('No JSON to copy.');
      return;
    }
    copyToClipboard(
      JSON.stringify(data, null, 2),
      () => setCopyState('JSON copied.'),
      () => setCopyState('Copy failed.'),
    );
  };

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <span>Market Summary</span>
          {copyState ? (
            <span className="ml-3 text-xs text-steel">{copyState}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="rounded-full border border-slate/50 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-steel"
          >
            Copy text
          </button>
          <button
            type="button"
            onClick={handleCopyJson}
            className="rounded-full border border-slate/50 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-steel"
          >
            Copy JSON
          </button>
        </div>
      </div>
      {error ? (
        <div className="mx-5 mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-xs text-coral">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 px-5 py-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === tab
                ? 'bg-ink text-white'
                : 'border border-slate/50 text-steel hover:border-ink/20'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 px-5 pb-6">
        {activeTab === 'Narrative' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="stat-pill">Symbol {metaChips.symbol}</span>
              <span className="stat-pill">Timeframe {metaChips.timeframe}</span>
              <span className="stat-pill">Regime {metaChips.regime}</span>
              <span className="stat-pill">Acceptance {metaChips.confidenceText}</span>
            </div>
            <div className="rounded-2xl border border-slate/40 bg-white/70 p-5 text-sm leading-relaxed text-ink">
              {text || 'Run a summary to populate insights.'}
            </div>
          </div>
        ) : null}

        {activeTab === 'Structured' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate/40 bg-white/70 p-4 text-sm text-ink">
              <p className="kicker">Key fields</p>
              <div className="mt-2 grid gap-3 text-sm">
                <div>
                  <span className="font-semibold">Auction</span>: {structuredDetails.auction}
                </div>
                <div>
                  <span className="font-semibold">Acceptance</span>:{' '}
                  {structuredDetails.confidence}
                </div>
                <div>
                  <span className="font-semibold">Levels</span>:{' '}
                  {structuredDetails.levels.overheadSupply.length +
                    structuredDetails.levels.support.length ===
                  0
                    ? 'n/a'
                    : `Supply ${structuredDetails.levels.overheadSupply.length}, Support ${structuredDetails.levels.support.length}`}
                </div>
                <div>
                  <span className="font-semibold">Invalidation</span>:{' '}
                  {structuredDetails.invalidation.length
                    ? structuredDetails.invalidation.join(' | ')
                    : 'n/a'}
                </div>
                <div>
                  <span className="font-semibold">Details</span>:{' '}
                  {structuredDetails.details.length
                    ? structuredDetails.details.join(' | ')
                    : 'n/a'}
                </div>
                {structuredDetails.oneLiner ? (
                  <div>
                    <span className="font-semibold">One-liner</span>: {structuredDetails.oneLiner}
                  </div>
                ) : null}
              </div>
            </div>
            <JsonViewer data={llmSummary} empty="No LLM output yet." />
          </div>
        ) : null}

        {activeTab === 'FeatureReport' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate/40 bg-white/70 p-4 text-sm text-ink">
              <p className="kicker">Quality flags</p>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="font-semibold">Missing extras:</span>{' '}
                  {qualityFlags.missingExtras.length
                    ? qualityFlags.missingExtras.join(', ')
                    : 'none'}
                </div>
                <div>
                  <span className="font-semibold">Notes:</span>{' '}
                  {qualityFlags.notes.length ? qualityFlags.notes.join(' | ') : 'none'}
                </div>
              </div>
            </div>
            <JsonViewer data={featureReport} empty="No feature report yet." />
          </div>
        ) : null}
      </div>
    </section>
  );
}
