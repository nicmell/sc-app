#!/usr/bin/env node

// Scrape the SuperCollider Server Command Reference into a curated JSON
// catalogue at `crates/scserver-commands/src/assets/commands/*.json`.
//
// Source: https://doc.sccode.org/Reference/Server-Command-Reference.html
// The page is hand-maintained HTML with a small set of patterns:
//   <h2><a class='anchor' name='Section'>Section</a></h2>
//   <h3><a class='anchor' name='/cmd'>/cmd</a></h3>
//     <p>description ...</p>
//     <table><tr><td><strong>int</strong><td>desc ... </table>
//   <dl><dt>Asynchronous.<dd>Replies to sender with <strong>/done</strong>...</dl>
//
// Some commands use "N *" in an outer table cell to denote a repeated
// tuple group (next <table> is the repeated-group schema). Example:
//   <tr><td>N *<td><table><tr><td><strong>int</strong>...</table>
//
// Usage: node scripts/scrape_server_commands.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL =
  'https://doc.sccode.org/Reference/Server-Command-Reference.html';
const CACHE = join(ROOT, 'scripts', 'tmp', 'sc-server-command-ref.html');
const OUT_DIR = join(
  ROOT,
  'crates',
  'scserver-commands',
  'src',
  'assets',
  'commands',
);

// Map section heading → category filename (snake_case).
const CATEGORY = {
  'Top-Level Commands': 'master',
  'Synth Definition Commands': 'synthdef',
  'Node Commands': 'node',
  'Synth Commands': 'synth',
  'Group Commands': 'group',
  'Unit Generator Commands': 'unit',
  'Buffer Commands': 'buffer',
  'Control Bus Commands': 'control',
  'Non Real Time Mode Commands': 'nrt',
  'Replies to Commands': 'replies',
  'Node Notifications from Server': 'replies',
  'Trigger Notification': 'replies',
  'Buffer Fill Commands': 'buffer_fill',
};

const OSC_TYPES = {
  int: 'int32',
  integer: 'int32',
  int32: 'int32',
  float: 'float32',
  'floating-point': 'float32',
  float32: 'float32',
  double: 'float64',
  float64: 'float64',
  string: 'string',
  symbol: 'string',
  bytes: 'blob',
  blob: 'blob',
  void: 'void',
};

// ── Fetch + cache ────────────────────────────────────────────────────────

async function loadPage() {
  mkdirSync(dirname(CACHE), { recursive: true });
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8');
  const resp = await fetch(SRC_URL);
  if (!resp.ok) throw new Error(`fetch ${SRC_URL}: ${resp.status}`);
  const html = await resp.text();
  writeFileSync(CACHE, html);
  return html;
}

// ── HTML helpers ─────────────────────────────────────────────────────────

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseType(raw) {
  const key = raw.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
  return OSC_TYPES[key] || null;
}

/** Extract all <tr>…</tr> blocks within a <table> ... </table>. */
function rowsOf(table) {
  const rows = [];
  // Strip opening tag and closing tag of outermost table
  const inner = table.replace(/^<table[^>]*>/i, '').replace(/<\/table>\s*$/i, '');
  // Split on <tr>. The SC HTML writes rows as <tr>...(without closing )</tr> in most places.
  // Handle both forms.
  const pieces = inner.split(/<tr>/i);
  for (const p of pieces) {
    if (!p.trim()) continue;
    rows.push(p.replace(/<\/tr>\s*$/i, '').trim());
  }
  return rows;
}

/** Split a row on <td> / <th>. */
function cellsOf(row) {
  return row
    .split(/<t[dh]>/i)
    .slice(1)
    .map((c) => c.replace(/<\/t[dh]>\s*$/i, ''));
}

/**
 * Extract the outermost <table>…</table> starting at `start` (index into
 * html). Handles ONE level of nested table (enough for the SC docs —
 * nested tables only appear as repeated-group schemas).
 */
function extractTable(html, start) {
  // `start` points at the opening `<table`.
  const openRe = /<table\b[^>]*>/gi;
  const closeRe = /<\/table>/gi;
  let depth = 0;
  let i = start;
  const end = html.length;
  while (i < end) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (!c) return null;
    if (o && o.index < c.index) {
      depth++;
      i = o.index + o[0].length;
    } else {
      depth--;
      i = c.index + c[0].length;
      if (depth === 0) return { end: i, text: html.slice(start, i) };
    }
  }
  return null;
}

// ── Parsing ──────────────────────────────────────────────────────────────

function parseArgsTable(table) {
  const args = [];
  const rows = rowsOf(table);
  let repeatedStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = cellsOf(rows[i]);
    if (cells.length < 2) continue;
    const first = stripTags(cells[0]).trim();
    // Repeated-tuple marker like "N *" / "M *" / "N*". The outer-table
    // row-split flattens the nested schema rows into subsequent entries of
    // our `rows` array, so everything past this marker is a repeated field.
    if (/^[A-Z]\s*\*$/.test(first)) {
      repeatedStart = i + 1;
      break;
    }
    args.push({
      type: parseTypeCell(cells[0].trim()),
      doc: stripTags(cells.slice(1).join(' ')),
    });
  }
  if (repeatedStart !== -1) {
    const fields = [];
    for (let i = repeatedStart; i < rows.length; i++) {
      const cells = cellsOf(rows[i]);
      if (cells.length < 2) continue;
      fields.push({
        type: parseTypeCell(cells[0].trim()),
        doc: stripTags(cells.slice(1).join(' ')),
      });
    }
    if (fields.length > 0) args.push({ repeated: true, fields });
  }
  return args;
}

function parseTypeCell(cell) {
  // A type cell can be `<strong>int</strong>` or `<strong>int</strong> or
  // <strong>string</strong>` (polymorphic args).
  const matches = Array.from(cell.matchAll(/<strong>([^<]+)<\/strong>/gi));
  if (matches.length === 0) {
    // No <strong>: the cell may be plain text like "int" (replies table).
    const plain = stripTags(cell);
    return { alternatives: [normaliseType(plain)].filter(Boolean), raw: plain };
  }
  const alts = matches.map((m) => normaliseType(m[1])).filter(Boolean);
  return { alternatives: alts, raw: matches.map((m) => m[1]).join(' or ') };
}

/** Split the page into entries, tracking the current <h2> section. */
function iterEntries(html) {
  const entries = [];
  const h2Re = /<h2><a\s+class='anchor'\s+name='([^']+)'>[^<]*<\/a><\/h2>/g;
  const h3Re = /<h3><a\s+class='anchor'\s+name='([^']+)'>([^<]*)<\/a><\/h3>/g;
  const marks = [];
  for (const m of html.matchAll(h2Re)) {
    marks.push({ kind: 'h2', idx: m.index, end: m.index + m[0].length, name: decodeURIComponent(m[1]) });
  }
  for (const m of html.matchAll(h3Re)) {
    marks.push({ kind: 'h3', idx: m.index, end: m.index + m[0].length, name: m[2] });
  }
  marks.sort((a, b) => a.idx - b.idx);

  let currentSection = null;
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (m.kind === 'h2') {
      currentSection = m.name;
      continue;
    }
    // h3: body runs from m.end until next h2/h3 or EOF.
    const next = marks[i + 1];
    const bodyEnd = next ? next.idx : html.length;
    const body = html.slice(m.end, bodyEnd);
    entries.push({ section: currentSection, address: m.name.trim(), body });
  }
  return entries;
}

function parseEntry(entry) {
  const { address, body, section } = entry;

  // Description = concatenation of <p>…</p> blocks that come before the
  // first <table>.
  const tableStart = body.search(/<table\b/i);
  const preTable = tableStart === -1 ? body : body.slice(0, tableStart);
  const descriptions = [];
  for (const m of preTable.matchAll(/<p>([\s\S]*?)(?=<\/?(?:p|dl|div|h2|h3|table)\b|$)/gi)) {
    const d = stripTags(m[1]);
    if (d) descriptions.push(d);
  }
  const description = descriptions.join(' ').trim();

  // Args table is the first <table>.
  let args = [];
  if (tableStart !== -1) {
    const ex = extractTable(body, tableStart);
    if (ex) args = parseArgsTable(ex.text);
  }

  // Async + reply hints from <dl>…</dl>.
  const asyncMatch = body.match(/<dt>\s*Asynchronous\.\s*<dd>([\s\S]*?)<\/dl>/i);
  const asyncInfo = asyncMatch ? stripTags(asyncMatch[1]) : null;

  return {
    address,
    section,
    category: CATEGORY[section] || 'misc',
    description,
    args,
    asyncInfo,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const html = await loadPage();
  const entries = iterEntries(html).map(parseEntry);

  // Group by category.
  const byCategory = new Map();
  for (const e of entries) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category).push(e);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  for (const [category, list] of [...byCategory.entries()].sort()) {
    list.sort((a, b) => a.address.localeCompare(b.address));
    writeFileSync(
      join(OUT_DIR, `${category}.json`),
      JSON.stringify(list, null, 2) + '\n',
    );
    console.log(`  ${category}.json: ${list.length} entries`);
    total += list.length;
  }
  console.log(`\nWrote ${total} entries to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
