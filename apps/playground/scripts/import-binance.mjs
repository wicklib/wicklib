#!/usr/bin/env node

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));

const symbol = args.symbol ?? "BTCUSDT";
const interval = args.interval ?? "1m";
const year = args.year ?? "2025";
const input = expandHome(args.input ?? join(homedir(), "Downloads"));
const output = resolve(
  here,
  "..",
  args.output ?? `public/data/binance-${symbol.toLowerCase()}-${interval}-${year}.json`,
);

const pattern = new RegExp(
  `^${escapeRegExp(symbol)}-${escapeRegExp(interval)}-${escapeRegExp(year)}-(\\d{2})\\.zip$`,
);
const files = readdirSync(input)
  .map((name) => ({ name, match: pattern.exec(name) }))
  .filter((entry) => entry.match !== null)
  .sort((first, second) => first.name.localeCompare(second.name));

if (files.length === 0) {
  throw new Error(
    `No ${symbol} ${interval} ${year} monthly ZIPs found in ${input}. Expected files like ${symbol}-${interval}-${year}-01.zip.`,
  );
}

const bars = [];
let previousTime = -Infinity;
let firstTime = null;
let lastTime = null;
let csvRows = 0;

for (const file of files) {
  const archive = unzipSync(new Uint8Array(readFileSync(join(input, file.name))));
  const csvName = Object.keys(archive).find((name) => name.endsWith(".csv"));
  if (!csvName) {
    throw new Error(`${file.name} does not contain a CSV file`);
  }

  const lines = strFromU8(archive[csvName]).split(/\r?\n/);
  let rowCount = 0;

  for (const line of lines) {
    if (line.length === 0 || line.startsWith("open_time,")) {
      continue;
    }

    const columns = line.split(",");
    if (columns.length < 6) {
      throw new Error(`${file.name}: malformed row: ${line}`);
    }

    const time = Number(columns[0]);
    const open = Number(columns[1]);
    const high = Number(columns[2]);
    const low = Number(columns[3]);
    const close = Number(columns[4]);
    const volume = Number(columns[5]);

    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume)
    ) {
      throw new Error(`${file.name}: non-finite value in row: ${line}`);
    }
    if (time <= previousTime) {
      throw new Error(`${file.name}: time is not strictly ascending at ${time}`);
    }
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      throw new Error(`${file.name}: invalid OHLC at ${time}`);
    }

    firstTime ??= time;
    lastTime = time;
    previousTime = time;
    csvRows += 1;
    rowCount += 1;
    bars.push([time, open, high, low, close, volume]);
  }

  console.log(`${file.name}: ${rowCount.toLocaleString("en-US")} bars`);
}

if (bars.length === 0) {
  throw new Error("The selected files contain no bars");
}

const document = {
  version: 1,
  source: "binance",
  market: "futures-um",
  symbol,
  interval,
  year,
  bars,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(document));

console.log(
  `Wrote ${bars.length.toLocaleString("en-US")} bars (${new Date(firstTime).toISOString()} → ${new Date(lastTime).toISOString()}) from ${files.length} files and ${csvRows.toLocaleString("en-US")} CSV rows to ${output}`,
);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    const key = rawKey;
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

function expandHome(value) {
  if (value === "~") {
    return homedir();
  }
  if (value.startsWith("~/")) {
    return join(homedir(), value.slice(2));
  }
  return resolve(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
