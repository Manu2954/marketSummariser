import { ReactNode } from 'react';

type JsonViewerProps = {
  data: Record<string, unknown> | null;
  empty?: ReactNode;
};

export default function JsonViewer({ data, empty }: JsonViewerProps) {
  if (!data) {
    return <div className="text-sm text-steel">{empty ?? 'No data yet.'}</div>;
  }

  return (
    <pre className="whitespace-pre-wrap rounded-2xl border border-slate/40 bg-white/70 p-4 font-mono text-xs text-ink">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
