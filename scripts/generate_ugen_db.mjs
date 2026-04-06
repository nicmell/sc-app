#!/usr/bin/env node

// Generates src/assets/ugens/*.json from Overtone's UGen metadata.
// Source: https://github.com/overtone/overtone/tree/master/src/overtone/sc/machinery/ugen/metadata
//
// Usage: node scripts/generate_ugen_db.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'scripts', 'tmp', 'overtone-ugens');
const OUTPUT_DIR = join(ROOT, 'src', 'assets', 'ugens');

const BASE_URL = 'https://raw.githubusercontent.com/overtone/overtone/master/src/overtone/sc/machinery/ugen/metadata';

const FILES = [
  'basicops', 'beq_suite', 'buf_io', 'chaos', 'compander', 'delay',
  'demand', 'envgen', 'ff_osc', 'fft', 'fft2', 'fft_unpacking',
  'filter', 'grain', 'info', 'input', 'io', 'line',
  'machine_listening', 'misc', 'noise', 'osc', 'pan', 'random', 'trig',
];

// Client-only UGens (not sent to the server as UGen nodes)
const SKIP = new Set([
  'Oscy', 'OscN',
  'Control', 'AudioControl', 'TrigControl', 'LagControl',
]);

// UGens with 0 outputs (side-effect only)
const ZERO_OUT = new Set([
  'Out', 'ReplaceOut', 'OffsetOut', 'LocalOut', 'XOut',
  'DiskOut', 'RecordBuf', 'ScopeOut', 'ScopeOut2',
  'SendTrig', 'SendReply', 'SendPeakRMS',
  'BufWr', 'ClearBuf', 'SetBuf', 'FreeSelf', 'PauseSelf',
  'FreeSelfWhenDone', 'PauseSelfWhenDone', 'Free', 'Pause',
  'RandSeed', 'RandID',
]);

// Overtone arg names → SC convention
const ARG_RENAMES = { signals: 'channelsArray', array: 'channelsArray' };

function toCamelCase(s) {
  return s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
}

// ── Download ──────────────────────────────────────────────────────────────

async function downloadFiles() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const results = await Promise.all(
    FILES.map(async (f) => {
      const path = join(CACHE_DIR, `${f}.clj`);
      if (existsSync(path)) return { file: f, path };
      const url = `${BASE_URL}/${f}.clj`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
      writeFileSync(path, await resp.text());
      return { file: f, path };
    }),
  );
  return results;
}

// ── Parse ─────────────────────────────────────────────────────────────────

function parseBlocks(content) {
  const blocks = [];
  let i = 0;
  while (i < content.length) {
    const start = content.indexOf('{:name ', i);
    if (start === -1) break;
    let depth = 0, j = start;
    while (j < content.length) {
      if (content[j] === '{') depth++;
      else if (content[j] === '}') { depth--; if (depth === 0) break; }
      j++;
    }
    blocks.push(content.slice(start, j + 1));
    i = j + 1;
  }
  return blocks;
}

function extractString(block, key) {
  const re = new RegExp(`:${key}\\s+"((?:[^"\\\\]|\\\\.)*)"`);
  const m = block.match(re);
  return m ? m[1].replace(/\\n/g, '\n').trim() : undefined;
}

function extractMultilineString(block, key) {
  const re = new RegExp(`:${key}\\s+"([\\s\\S]*?)"\\s*(?:[}:]|$)`);
  const m = block.match(re);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, ' ').trim() || undefined;
}

function parseUGen(block) {
  const nameMatch = block.match(/^\{:name\s+"([^"]+)"/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const extendsMatch = block.match(/:extends\s+"([^"]+)"/);
  const extendsName = extendsMatch ? extendsMatch[1] : undefined;

  // Extract args
  const args = [];
  const argsIdx = block.indexOf(':args');
  if (argsIdx !== -1) {
    let bracketStart = block.indexOf('[', argsIdx);
    if (bracketStart !== -1) {
      let depth = 0, j = bracketStart;
      while (j < block.length) {
        if (block[j] === '[') depth++;
        else if (block[j] === ']') { depth--; if (depth === 0) break; }
        j++;
      }
      const argsText = block.slice(bracketStart + 1, j);
      let k = 0;
      while (k < argsText.length) {
        const s = argsText.indexOf('{', k);
        if (s === -1) break;
        let d = 0, e = s;
        while (e < argsText.length) {
          if (argsText[e] === '{') d++;
          else if (argsText[e] === '}') { d--; if (d === 0) break; }
          e++;
        }
        const argBlock = argsText.slice(s + 1, e);
        k = e + 1;
        const argName = argBlock.match(/:name\s+"([^"]+)"/);
        if (!argName) continue;
        const n = argName[1];
        if ((n === 'mul' || n === 'add') && name !== 'MulAdd') continue;
        const defMatch = argBlock.match(/:default\s+([-\d.eE]+)/);
        const def = defMatch ? parseFloat(defMatch[1]) : undefined;
        const doc = extractMultilineString(argBlock, 'doc');
        const arg = { name: toCamelCase(n), default: def ?? null };
        if (doc) arg.doc = doc;
        args.push(arg);
      }
    }
  }

  // Extract rates
  let rates = undefined;
  const ratesMatch = block.match(/:rates\s+#\{([^}]+)\}/);
  if (ratesMatch) {
    rates = ratesMatch[1].match(/:(\w+)/g)?.map(r => r.slice(1)) || undefined;
  }

  // Extract metadata fields
  let numOutputs = undefined;
  const numOutsMatch = block.match(/:num-outs\s+(\d+)/);
  if (numOutsMatch) numOutputs = parseInt(numOutsMatch[1]);

  // Extract UGen-level metadata from outside the :args block
  let blockWithoutArgs = block;
  if (argsIdx !== -1) {
    let bracketStart = block.indexOf('[', argsIdx);
    if (bracketStart !== -1) {
      let depth = 0, j = bracketStart;
      while (j < block.length) {
        if (block[j] === '[') depth++;
        else if (block[j] === ']') { depth--; if (depth === 0) break; }
        j++;
      }
      blockWithoutArgs = block.slice(0, argsIdx) + block.slice(j + 1);
    }
  }

  const summary = extractMultilineString(blockWithoutArgs, 'summary');
  const doc = extractMultilineString(blockWithoutArgs, 'doc');
  const signalRange = extractString(blockWithoutArgs, 'signal-range');

  const result = { name };
  if (extendsName) result.extends = extendsName;
  if (args.length > 0) result.args = args;
  if (rates) result.rates = rates;
  if (numOutputs != null) result.numOutputs = numOutputs;
  if (summary) result.summary = summary;
  if (doc) result.doc = doc;
  if (signalRange) result.signalRange = signalRange;

  return result;
}

// ── Resolve inheritance & generate ────────────────────────────────────────

async function main() {
  console.log('Downloading Overtone UGen metadata...');
  const downloaded = await downloadFiles();
  console.log(`Downloaded ${downloaded.length} files`);

  // Parse all raw UGens, tracking their source file
  const rawUgens = new Map();
  for (const { file, path } of downloaded) {
    const content = readFileSync(path, 'utf-8');
    for (const block of parseBlocks(content)) {
      const u = parseUGen(block);
      if (!u || SKIP.has(u.name)) continue;
      rawUgens.set(u.name, { ...u, source: file });
    }
  }

  function resolve(name) {
    const u = rawUgens.get(name);
    if (!u) return null;
    let args = u.args;
    let rates = u.rates || ['ar', 'kr'];
    let numOutputs = u.numOutputs;
    if (u.extends) {
      const parent = resolve(u.extends);
      if (parent) {
        if (!args) args = parent.args;
        if (!u.rates) rates = parent.rates;
        if (numOutputs == null) numOutputs = parent.numOutputs;
      }
    }
    if (numOutputs == null) numOutputs = 1;
    return { ...u, args: args || [], rates, numOutputs, source: u.source };
  }

  // Resolve all and group by source file
  const byFile = new Map();
  let total = 0;
  for (const name of rawUgens.keys()) {
    const u = resolve(name);
    if (!u) continue;
    if (ZERO_OUT.has(u.name)) u.numOutputs = 0;
    for (const a of u.args) {
      if (ARG_RENAMES[a.name]) a.name = ARG_RENAMES[a.name];
    }
    const file = u.source;
    if (!byFile.has(file)) byFile.set(file, []);

    // Build output entry preserving all metadata
    const entry = { name: u.name };
    if (u.extends) entry.extends = u.extends;
    entry.rates = u.rates.filter(r => r === 'ar' || r === 'kr' || r === 'ir');
    entry.defaults = u.args.map(a => [a.name, a.default ?? null]);
    if (u.numOutputs !== 1) entry.numOutputs = u.numOutputs;
    if (u.summary) entry.summary = u.summary;
    if (u.doc) entry.doc = u.doc;
    if (u.signalRange) entry.signalRange = u.signalRange;
    if (u.args.some(a => a.doc)) {
      entry.argDocs = Object.fromEntries(u.args.filter(a => a.doc).map(a => [a.name, a.doc]));
    }

    byFile.get(file).push(entry);
    total++;
  }

  // Write JSON files
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [file, ugens] of byFile) {
    ugens.sort((a, b) => a.name.localeCompare(b.name));
    const outPath = join(OUTPUT_DIR, `${file}.json`);
    writeFileSync(outPath, JSON.stringify(ugens, null, 2) + '\n');
    console.log(`  ${file}.json: ${ugens.length} UGens`);
  }

  console.log(`\nWritten ${total} UGens across ${byFile.size} files to src/assets/ugens/`);
}

main().catch(e => { console.error(e); process.exit(1); });
