'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useMarketStore } from '../store/useMarketStore';

const UP_COLOR = '#2bbf98';
const DOWN_COLOR = '#f26b4f';

type CandlePoint = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function mapCandles(candles: { t: number; o: number; h: number; l: number; c: number; v: number }[]) {
  return candles.map((candle) => ({
    time: Math.floor(candle.t / 1000) as UTCTimestamp,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
    volume: candle.v,
  }));
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

export default function ChartPanel() {
  const candles = useMarketStore((state) => state.candles);
  const featureReport = useMarketStore((state) => state.featureReport);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const eventMapRef = useRef<Map<number, { type: string; severity: number; context: string }[]>>(
    new Map(),
  );

  const chartData = useMemo(
    () => mapCandles(candles).sort((a, b) => Number(a.time) - Number(b.time)),
    [candles],
  );

  const eventMarkers = useMemo(() => {
    if (!featureReport || typeof featureReport !== 'object') {
      eventMapRef.current = new Map();
      return [];
    }
    const events = (featureReport as Record<string, unknown>).events;
    if (!Array.isArray(events)) {
      eventMapRef.current = new Map();
      return [];
    }

    const parsedEvents = events
      .map((event) => {
        if (!event || typeof event !== 'object') {
          return null;
        }
        const raw = event as Record<string, unknown>;
        const type = typeof raw.type === 'string' ? raw.type : 'event';
        const timeMs = typeof raw.t === 'number' ? raw.t : 0;
        const severity = typeof raw.severity === 'number' ? raw.severity : 0;
        const contextValue = raw.context;
        const context =
          typeof contextValue === 'string'
            ? contextValue
            : contextValue && typeof contextValue === 'object'
              ? JSON.stringify(contextValue)
              : '';
        return { type, timeMs, severity, context };
      })
      .filter(Boolean) as { type: string; timeMs: number; severity: number; context: string }[];

    const trimmedEvents =
      parsedEvents.length > 40
        ? [...parsedEvents].sort((a, b) => b.severity - a.severity).slice(0, 40)
        : parsedEvents;

    const candleMap = new Map<number, CandlePoint>();
    chartData.forEach((point) => {
      candleMap.set(point.time, point);
    });

    const nextMap = new Map<number, { type: string; severity: number; context: string }[]>();

    const markers = trimmedEvents
      .map((event) => {
        const type = event.type;
        const timeMs = event.timeMs;
        const severity = event.severity;
        const context = event.context;
        const time = Math.floor(timeMs / 1000) as UTCTimestamp;
        const candle = candleMap.get(time);

        if (!candle) {
          return null;
        }

        const isSell =
          type.includes('sell') || type.includes('down') || type.includes('rejection');
        const isBuy = type.includes('buy') || type.includes('up');
        const isAbsorption = type.includes('absorption');
        const isSweep = type.includes('sweep');

        const markerShape = isAbsorption
          ? 'circle'
          : isSweep
            ? 'square'
            : isSell
              ? 'arrowDown'
              : 'arrowUp';

        const position = isAbsorption ? 'inBar' : isSell ? 'aboveBar' : 'belowBar';
        const color = isSell ? DOWN_COLOR : UP_COLOR;
        const titleContext = context.length > 120 ? `${context.slice(0, 120)}…` : context;

        if (!nextMap.has(time)) {
          nextMap.set(time, []);
        }
        nextMap.get(time)?.push({ type, severity, context: titleContext });

        return {
          time,
          position,
          color,
          shape: markerShape,
          text: '',
        };
      })
      .filter(Boolean) as {
      time: UTCTimestamp;
      position: 'aboveBar' | 'belowBar' | 'inBar';
      color: string;
      shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
      text: string;
    }[];

    eventMapRef.current = nextMap;
    return markers.sort((a, b) => Number(a.time) - Number(b.time));
  }, [chartData, featureReport]);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }

    const container = containerRef.current;
    const initialWidth = Math.max(container.clientWidth, 320);
    const initialHeight = Math.max(container.clientHeight, 260);
    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#4a5363',
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(196, 204, 217, 0.3)' },
        horzLines: { color: 'rgba(196, 204, 217, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        scaleMargins: { top: 0.15, bottom: 0.35 },
        borderColor: 'rgba(196, 204, 217, 0.4)',
      },
      timeScale: {
        borderColor: 'rgba(196, 204, 217, 0.4)',
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderDownColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && chartRef.current) {
          const nextWidth = Math.max(entry.contentRect.width, 320);
          const nextHeight = Math.max(entry.contentRect.height, 260);
          chartRef.current.applyOptions({
            width: nextWidth,
            height: nextHeight,
          });
          chartRef.current.timeScale().fitContent();
        }
      }
    });
    resizeObserver.observe(container);

    chart.subscribeCrosshairMove((param) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) {
        return;
      }
      if (!param.time || !param.seriesData.size) {
        tooltip.style.opacity = '0';
        return;
      }

      const candle = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      const volumePoint = param.seriesData.get(volumeSeries) as { value: number } | undefined;
      const events = eventMapRef.current.get(param.time as number) ?? [];

      if (!candle) {
        tooltip.style.opacity = '0';
        return;
      }

      const date = new Date((param.time as number) * 1000);
      tooltip.style.opacity = '1';
      const lines = [
        `Time: ${date.toLocaleString()}`,
        `O: ${formatNumber(candle.open)} H: ${formatNumber(candle.high)}`,
        `L: ${formatNumber(candle.low)} C: ${formatNumber(candle.close)}`,
        `Vol: ${formatNumber(volumePoint?.value ?? 0)}`,
      ];
      if (events.length) {
        lines.push('Events:');
        events.forEach((event) => {
          const contextText = event.context ? ` — ${event.context}` : '';
          lines.push(`${event.type} (${event.severity.toFixed(2)})${contextText}`);
        });
      }
      tooltip.innerText = lines.join('\n');
    });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    const candleData = chartData.map((point) => ({
      time: point.time,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
    }));

    const volumeData = chartData.map((point) => ({
      time: point.time,
      value: point.volume,
      color: point.close >= point.open ? 'rgba(43, 191, 152, 0.6)' : 'rgba(242, 107, 79, 0.6)',
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    candleSeries.setMarkers(eventMarkers);
    chartRef.current?.timeScale().fitContent();
  }, [chartData, eventMarkers]);

  const summary = useMemo(() => {
    if (chartData.length === 0) {
      return null;
    }
    const last = chartData[chartData.length - 1];
    const highs = chartData.map((point) => point.high);
    const lows = chartData.map((point) => point.low);
    return {
      lastClose: last.close,
      high: Math.max(...highs),
      low: Math.min(...lows),
    };
  }, [chartData]);

  const zones = useMemo(() => {
    if (!featureReport || typeof featureReport !== 'object') {
      return [];
    }
    const levels = (featureReport as Record<string, unknown>).levels as
      | {
          overheadSupply?: number[][];
          supportZones?: number[][];
          rejectionZones?: number[][];
        }
      | undefined;

    if (!levels) {
      return [];
    }

    const lastClose = chartData.length ? chartData[chartData.length - 1].close : null;
    const limit = 4;

    const toZones = (items: number[][] | undefined, type: string) =>
      (items ?? [])
        .filter((zone) => Array.isArray(zone) && zone.length === 2)
        .map((zone) => ({ type, low: zone[0], high: zone[1] }))
        .sort((a, b) => {
          if (lastClose === null) {
            return 0;
          }
          const midA = (a.low + a.high) / 2;
          const midB = (b.low + b.high) / 2;
          return Math.abs(midA - lastClose) - Math.abs(midB - lastClose);
        })
        .slice(0, limit);

    return [
      ...toZones(levels.overheadSupply, 'Supply'),
      ...toZones(levels.supportZones, 'Support'),
      ...toZones(levels.rejectionZones, 'Rejection'),
    ];
  }, [chartData, featureReport]);

  useEffect(() => {
    if (!candleSeriesRef.current) {
      return;
    }

    priceLinesRef.current.forEach((line) => {
      candleSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = [];

    const colors: Record<string, string> = {
      Supply: 'rgba(242, 107, 79, 0.5)',
      Support: 'rgba(43, 191, 152, 0.5)',
      Rejection: 'rgba(74, 83, 99, 0.45)',
    };

    zones.forEach((zone) => {
      const low = Number(zone.low);
      const high = Number(zone.high);
      if (!Number.isFinite(low) || !Number.isFinite(high)) {
        return;
      }

      const color = colors[zone.type] ?? 'rgba(74, 83, 99, 0.7)';
      const lowLine = candleSeriesRef.current?.createPriceLine({
        price: Math.min(low, high),
        color,
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        axisLabelVisible: false,
        title: '',
      });
      const highLine = candleSeriesRef.current?.createPriceLine({
        price: Math.max(low, high),
        color,
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        axisLabelVisible: false,
        title: '',
      });

      if (lowLine) {
        priceLinesRef.current.push(lowLine);
      }
      if (highLine) {
        priceLinesRef.current.push(highLine);
      }
    });
  }, [zones]);

  return (
    <section className="panel h-full">
      <div className="panel-header">
        <span>Chart</span>
        <span className="text-xs">OHLCV Overview</span>
      </div>
      <div className="grid gap-6 p-6">
        <div>
          <p className="kicker">Price canvas</p>
          <h2 className="text-2xl font-semibold">
            {summary ? `Last close ${summary.lastClose.toFixed(2)}` : 'Awaiting data'}
          </h2>
          {summary ? (
            <p className="mt-2 text-sm text-steel">
              Range {summary.low.toFixed(2)} → {summary.high.toFixed(2)}
            </p>
          ) : null}
        </div>
        <div className="relative w-full h-[clamp(240px,45vh,520px)] rounded-2xl border border-dashed border-slate/60 bg-white/60">
          <div ref={containerRef} className="h-full w-full" />
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute left-3 top-3 whitespace-pre-line rounded-xl border border-slate/40 bg-white/90 px-3 py-2 text-xs text-steel shadow-soft"
            style={{ opacity: 0 }}
          />
          {chartData.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-steel">
              Chart placeholder
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 text-xs text-steel md:grid-cols-3">
          <div>
            <p className="kicker">Supply zones</p>
            <p>
              {zones.filter((zone) => zone.type === 'Supply').length
                ? zones
                    .filter((zone) => zone.type === 'Supply')
                    .map((zone) => `${zone.low.toFixed(2)}–${zone.high.toFixed(2)}`)
                    .join(', ')
                : 'n/a'}
            </p>
          </div>
          <div>
            <p className="kicker">Support zones</p>
            <p>
              {zones.filter((zone) => zone.type === 'Support').length
                ? zones
                    .filter((zone) => zone.type === 'Support')
                    .map((zone) => `${zone.low.toFixed(2)}–${zone.high.toFixed(2)}`)
                    .join(', ')
                : 'n/a'}
            </p>
          </div>
          <div>
            <p className="kicker">Rejection zones</p>
            <p>
              {zones.filter((zone) => zone.type === 'Rejection').length
                ? zones
                    .filter((zone) => zone.type === 'Rejection')
                    .map((zone) => `${zone.low.toFixed(2)}–${zone.high.toFixed(2)}`)
                    .join(', ')
                : 'n/a'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
