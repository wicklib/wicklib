#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));

const symbol = args.symbol ?? "^GSPC";
const interval = args.interval ?? "5m";
const range = args.range ?? "1mo";
const slug = symbol
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const output = resolve(
  here,
  "..",
  args.output ?? `public/data/yahoo-${slug}-${interval}-${range}.json`,
);

const url = new URL(
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
);
url.searchParams.set("interval", interval);
url.searchParams.set("range", range);
url.searchParams.set("includePrePost", "false");

const response = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0" },
});
if (!response.ok) {
  throw new Error(`Yahoo request failed: HTTP ${response.status}`);
}

const payload = await response.json();
const result = payload?.chart?.result?.[0];
if (!result || !Array.isArray(result.timestamp)) {
  throw new Error(`No chart data for ${symbol}`);
}

const quote = result.indicators?.quote?.[0];
if (!quote) {
  throw new Error(`No quote data for ${symbol}`);
}

const bars = [];
let previousTime = Number.NEGATIVE_INFINITY;
for (let index = 0; index < result.timestamp.length; index += 1) {
  const time = Number(result.timestamp[index]) * 1_000;
  const open = Number(quote.open?.[index]);
  const high = Number(quote.high?.[index]);
  const low = Number(quote.low?.[index]);
  const close = Number(quote.close?.[index]);
  const volume = Number(quote.volume?.[index] ?? 0);

  if (
    !Number.isFinite(time) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(volume)
  ) {
    continue;
  }
  if (time <= previousTime) {
    continue;
  }
  if (high < Math.max(open, close) || low > Math.min(open, close)) {
    throw new Error(`Invalid OHLC at ${new Date(time).toISOString()}`);
  }

  bars.push([time, open, high, low, close, volume]);
  previousTime = time;
}

if (bars.length === 0) {
  throw new Error("Yahoo returned no usable bars");
}

const document = {
  version: 1,
  source: "yahoo",
  symbol,
  interval,
  range,
  timezone: result.meta?.exchangeTimezoneName ?? "UTC",
  bars,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(document));
console.log(
  `Wrote ${bars.length.toLocaleString("en-US")} ${interval} bars (${new Date(bars[0][0]).toISOString()} → ${new Date(bars.at(-1)[0]).toISOString()}) to ${output}`,
);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith("--")) {
      continue;
    }
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    if (!key) {
      continue;
    }
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      result[key] = argv[index + 1];
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}
