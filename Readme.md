# market-summary-engine

Production-grade Node.js + TypeScript service for computing deterministic market features and generating summaries.

## Requirements
- Node.js 20+
- npm

## Setup
```bash
npm install
```

## Run locally
```bash
npm run dev
```

## Build + start
```bash
npm run build
npm run start
```

## Test + lint
```bash
npm test
npm run lint
npm run format
```

## API
### POST /v1/market/summary
Request body:
```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "candles": [
    { "timestamp": 1, "open": 100, "high": 110, "low": 95, "close": 105, "volume": 10 },
    { "timestamp": 2, "open": 105, "high": 115, "low": 100, "close": 110, "volume": 20 }
  ]
}
```

Response body:
```json
{
  "requestId": "uuid",
  "summary": "Price closed up with 30.00 volume.",
  "narrative": "The BTCUSDT market moved up on the 1h timeframe...",
  "features": { "ohlcv": {}, "volume": {}, "auction": {}, "liquidity": {}, "generatedAt": "" }
}
```
