#!/usr/bin/env node

// Generates src/lib/ugen/ugen-db.ts from Overtone's UGen metadata.
// Source: https://github.com/overtone/overtone/tree/master/src/overtone/sc/machinery/ugen/metadata
//
// Usage: node scripts/generate_ugen_db.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'scripts', 'tmp', 'overtone-ugens');
const OUTPUT = join(ROOT, 'src', 'lib', 'ugen', 'ugen-db.ts');

const BASE_URL = 'https://raw.githubusercontent.com/overtone/overtone/master/src/overtone/sc/machinery/ugen/metadata';

const FILES = [
  'basicops', 'beq_suite', 'buf_io', 'chaos', 'compander', 'delay',
  'demand', 'envgen', 'ff_osc', 'fft', 'fft2', 'fft_unpacking',
  'filter', 'grain', 'info', 'input', 'io', 'line',
  'machine_listening', 'misc', 'noise', 'osc', 'pan', 'random', 'trig',
];

// UGens handled specially by the compiler or client-only
const SKIP = new Set([
  'BinaryOpUGen', 'UnaryOpUGen', 'MulAdd',
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

function parseUGen(block) {
  const nameMatch = block.match(/^\{:name\s+"([^"]+)"/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const extendsMatch = block.match(/:extends\s+"([^"]+)"/);
  const extendsName = extendsMatch ? extendsMatch[1] : null;

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
        if (n === 'mul' || n === 'add') continue;
        const defMatch = argBlock.match(/:default\s+([-\d.eE]+)/);
        const def = defMatch ? parseFloat(defMatch[1]) : undefined;
        args.push({ name: toCamelCase(n), default: def });
      }
    }
  }

  let rates = null;
  const ratesMatch = block.match(/:rates\s+#\{([^}]+)\}/);
  if (ratesMatch) {
    rates = ratesMatch[1].match(/:(\w+)/g)?.map(r => r.slice(1)) || null;
  }

  let numOutputs = null;
  const numOutsMatch = block.match(/:num-outs\s+(\d+)/);
  if (numOutsMatch) numOutputs = parseInt(numOutsMatch[1]);

  return { name, args: args.length > 0 ? args : null, rates, numOutputs, extendsName };
}

// ── Resolve inheritance & generate ────────────────────────────────────────

async function main() {
  console.log('Downloading Overtone UGen metadata...');
  const downloaded = await downloadFiles();
  console.log(`Downloaded ${downloaded.length} files`);

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
    let numOutputs = u.numOutputs || 1;
    if (u.extendsName) {
      const parent = resolve(u.extendsName);
      if (parent) {
        if (!args) args = parent.args;
        if (!u.rates) rates = parent.rates;
        if (!u.numOutputs) numOutputs = parent.numOutputs;
      }
    }
    return { name, args: args || [], rates, numOutputs };
  }

  const resolved = [];
  for (const name of rawUgens.keys()) {
    const u = resolve(name);
    if (u) {
      if (ZERO_OUT.has(u.name)) u.numOutputs = 0;
      for (const a of u.args) {
        if (ARG_RENAMES[a.name]) a.name = ARG_RENAMES[a.name];
      }
      resolved.push(u);
    }
  }

  resolved.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Resolved ${resolved.length} UGens`);

  const rateMap = { ar: 'Rate.Audio', kr: 'Rate.Control', ir: 'Rate.Scalar' };
  let ts = `// Auto-generated from Overtone UGen metadata
// https://github.com/overtone/overtone/tree/master/src/overtone/sc/machinery/ugen/metadata
// Do not edit manually. Regenerate with: node scripts/generate_ugen_db.mjs

import {Rate} from './ugen';
import {registerUGen} from './registry';

`;

  for (const u of resolved) {
    const rates = u.rates.filter(r => rateMap[r]).map(r => rateMap[r]).join(', ');
    const defaults = u.args.map(a => {
      const def = a.default !== undefined ? String(a.default) : 'undefined';
      return `['${a.name}', ${def}]`;
    }).join(', ');
    const numOut = u.numOutputs !== 1 ? `, numOutputs: ${u.numOutputs}` : '';
    ts += `registerUGen({name: '${u.name}', rates: [${rates}], defaults: [${defaults}]${numOut}});\n`;
  }

  // Operator UGens (special-cased in the compiler, not from Overtone)
  ts += `\n// Operator UGens (special-cased in the compiler, not from Overtone)\n`;
  ts += `registerUGen({name: 'BinaryOpUGen', rates: [Rate.Audio, Rate.Control, Rate.Scalar], defaults: [['a', undefined], ['b', undefined]]});\n`;
  ts += `registerUGen({name: 'UnaryOpUGen', rates: [Rate.Audio, Rate.Control, Rate.Scalar], defaults: [['a', undefined]]});\n`;
  ts += `registerUGen({name: 'MulAdd', rates: [Rate.Audio, Rate.Control, Rate.Scalar], defaults: [['in', undefined], ['mul', 1], ['add', 0]]});\n`;

  writeFileSync(OUTPUT, ts);
  console.log(`Written ${resolved.length + 3} entries to src/lib/ugen/ugen-db.ts`);
}

main().catch(e => { console.error(e); process.exit(1); });
