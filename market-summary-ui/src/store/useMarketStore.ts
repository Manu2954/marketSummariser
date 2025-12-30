import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Candle, SummaryRequest } from '../lib/schema';
import { summaryRequestSchema } from '../lib/schema';
import { getSummary } from '../lib/api';

type FeatureReport = Record<string, unknown> | null;
type LlmSummary = Record<string, unknown> | null;

type Preferences = {
  style: 'auction_pro' | 'simple';
  length: 'short' | 'medium' | 'long';
  includeLevels: boolean;
  autoRunOnUpload: boolean;
};

export type MarketState = {
  symbol: string;
  timeframe: string;
  startTime: string;
  endTime: string;
  candles: Candle[];
  featureReport: FeatureReport;
  llmSummary: LlmSummary;
  text: string;
  loading: boolean;
  error: string | null;
  preferences: Preferences;
  preferencesOpen: boolean;
  setSymbol: (value: string) => void;
  setTimeframe: (value: string) => void;
  setStartTime: (value: string) => void;
  setEndTime: (value: string) => void;
  setCandles: (value: Candle[]) => void;
  setResult: (payload: {
    featureReport: FeatureReport;
    llmSummary: LlmSummary;
    text: string;
  }) => void;
  resetResult: () => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setPreferences: (value: Partial<Preferences>) => void;
  setPreferencesOpen: (value: boolean) => void;
  runSummary: () => Promise<void>;
};

const defaultPreferences: Preferences = {
  style: 'auction_pro',
  length: 'short',
  includeLevels: true,
  autoRunOnUpload: false,
};

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      symbol: 'BTCUSDT',
      timeframe: '5m',
      startTime: '',
      endTime: '',
      candles: [],
      featureReport: null,
      llmSummary: null,
      text: '',
      loading: false,
      error: null,
      preferences: defaultPreferences,
      preferencesOpen: false,
      setSymbol: (value) => set({ symbol: value }),
      setTimeframe: (value) => set({ timeframe: value }),
      setStartTime: (value) => set({ startTime: value }),
      setEndTime: (value) => set({ endTime: value }),
      setCandles: (value) => set({ candles: value }),
      setResult: (payload) =>
        set({
          featureReport: payload.featureReport,
          llmSummary: payload.llmSummary,
          text: payload.text,
        }),
      resetResult: () => set({ featureReport: null, llmSummary: null, text: '' }),
      setLoading: (value) => set({ loading: value }),
      setError: (value) => set({ error: value }),
      setPreferences: (value) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...value,
          },
        })),
      setPreferencesOpen: (value) => set({ preferencesOpen: value }),
      runSummary: async () => {
        const { symbol, timeframe, startTime, endTime, preferences } = get();
        const startText = startTime.trim();
        const endText = endTime.trim();

        if (!startText || !endText) {
          set({ error: 'Start time and end time are required.' });
          return;
        }

        const startNumber = new Date(startText).getTime();
        const endNumber = new Date(endText).getTime();
        if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber)) {
          set({ error: 'Start time and end time must be valid date/time values.' });
          return;
        }

        const payload: SummaryRequest = {
          symbol,
          timeframe,
          startTime: startNumber,
          endTime: endNumber,
          preferences: {
            style: preferences.style,
            length: preferences.length,
            includeLevels: preferences.includeLevels,
          },
        };

        const parsed = summaryRequestSchema.safeParse(payload);
        if (!parsed.success) {
          const message = parsed.error.issues
            .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join('\n');
          set({ error: message });
          return;
        }

        try {
          set({ loading: true, error: null });
          const response = await getSummary(parsed.data);
          set({
            featureReport: response.featureReport,
            llmSummary: response.llmSummary,
            text: response.text,
            candles: response.candles ?? [],
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : String(error) });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'market-summary-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preferences: state.preferences }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<MarketState>;
        return {
          ...currentState,
          preferences: {
            ...currentState.preferences,
            ...(persisted.preferences ?? {}),
          },
        };
      },
    },
  ),
);
