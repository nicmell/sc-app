/**
 * Extract the controls from a `synthdef()` callback's second parameter.
 *
 * The parser runs `fn.toString()` and walks the source for the second
 * parameter, pulling out each destructured key and its default
 * expression as a raw string. Defaults are evaluated later in a
 * controlled scope (see `resolveControls`).
 *
 * Accepts:
 *   - arrow functions:  `(g, { freq = 440 }) => …`
 *   - function exprs:   `function (g, { freq = 440 }) { … }`
 *   - named functions:  `function foo(g, { freq = 440 }) { … }`
 *   - async arrow:      `async (g, { freq = 440 }) => …`
 *
 * Not supported (throws):
 *   - nested destructuring: `{ a: { b = 1 } }`
 *   - rest elements:        `{ a = 1, ...rest }`
 *   - aliasing:             `{ a: b = 1 }`  (the TS/sclang-style user
 *     writes `{ a = 1 }`, so we don't need aliasing)
 */

export interface ParsedControl {
  name: string;
  /** Raw JS expression text from the default. Empty string if no default. */
  defaultExpr: string;
}

export interface ParsedCallback {
  /** Whether the callback declared a second destructured parameter at all. */
  hasControlsParam: boolean;
  controls: ParsedControl[];
}

/** Main entry point. */
export function parseCallback(fn: Function): ParsedCallback {
  const src = fn.toString();
  const paramList = extractParamList(src);
  const params = splitTopLevelCommas(paramList);
  if (params.length < 2) {
    return { hasControlsParam: false, controls: [] };
  }
  const second = stripTypeAnnotation(params[1]).trim();
  // Remove a trailing default of `= {}` — common defensive pattern so the
  // callback doesn't crash when invoked with no second arg.
  const withoutOuterDefault = second.replace(/\s*=\s*\{\s*\}\s*$/, '');
  if (!withoutOuterDefault.startsWith('{') || !withoutOuterDefault.endsWith('}')) {
    throw new Error(
      `synthdef: expected second parameter to be a destructuring pattern ` +
        `(\`{ foo = 1 }\`), got: ${second}`,
    );
  }
  const body = withoutOuterDefault.slice(1, -1);
  const fields = splitTopLevelCommas(body)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const controls: ParsedControl[] = [];
  for (const f of fields) {
    controls.push(parseField(f));
  }
  return { hasControlsParam: true, controls };
}

// ─── Parsers ───────────────────────────────────────────────────────────

/** Extract the source text inside the top-level parameter list. */
function extractParamList(src: string): string {
  // The first `(` in a function's source text is always the opening of
  // its parameter list — function / arrow forms all start with
  // `function name?(` or `(...) =>` / `async (...) =>`. No strings can
  // appear before it.
  const open = src.indexOf('(');
  if (open < 0) {
    throw new Error(`synthdef: callback has no parameter list: ${src.slice(0, 80)}`);
  }
  let depth = 0;
  let i = open;
  while (i < src.length) {
    const c = src[i];
    if (isStringQuote(c)) {
      i = skipString(src, i);
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
    i++;
  }
  throw new Error(`synthdef: unterminated parameter list: ${src.slice(0, 80)}`);
}

/**
 * Parse a single field from the destructuring body. Accepts:
 *   - `name`                 — shorthand, no default
 *   - `name = expr`          — shorthand with default
 *   - `key: alias`           — aliased (only the key becomes the control name)
 *   - `key: alias = expr`    — aliased with default
 *
 * The aliased forms arise from SSR/bundler transforms (e.g. Vite rewrites
 * shadowed destructured names as `bus: bus2` to disambiguate from an
 * outer-scope `bus`). The control is always named by the property key.
 */
function parseField(field: string): ParsedControl {
  if (field.startsWith('...')) {
    throw new Error(`synthdef: rest elements are not supported: ${field}`);
  }
  // Split on the first top-level `:` (aliased form) and `=` (default).
  const colon = findTopLevelChar(field, ':');
  const eq = findTopLevelChar(field, '=');
  let name: string;
  let defaultExpr: string;
  if (colon >= 0 && (eq < 0 || colon < eq)) {
    name = field.slice(0, colon).trim();
    // The slice after the `:` is `alias` or `alias = expr`. We only need
    // the default — the alias is the local binding inside the callback
    // and has no API-visible role.
    const afterColon = field.slice(colon + 1);
    const eq2 = findTopLevelChar(afterColon, '=');
    defaultExpr = eq2 >= 0 ? afterColon.slice(eq2 + 1).trim() : '';
  } else if (eq >= 0) {
    name = field.slice(0, eq).trim();
    defaultExpr = field.slice(eq + 1).trim();
  } else {
    name = field.trim();
    defaultExpr = '';
  }
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    throw new Error(`synthdef: invalid control name: ${name}`);
  }
  return { name, defaultExpr };
}

/**
 * Remove a trailing `: SomeType` annotation from a parameter. tsx/vitest
 * occasionally preserves type annotations in the emitted JS for arrow
 * functions; this strips them before destructuring-pattern parsing.
 * Only removes the annotation at the top level (after the outermost `}`).
 */
function stripTypeAnnotation(param: string): string {
  // Find the outermost `{...}` — if present, the type annotation follows.
  const p = param.trim();
  if (!p.startsWith('{')) return p;
  let depth = 0;
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (isStringQuote(c)) {
      i = skipString(p, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const rest = p.slice(i + 1).trim();
        if (rest.startsWith(':')) {
          // Drop ": ...[= ...]" — preserve `= defaultValue` if any by
          // finding the `=` at top level of the annotation.
          const annotation = rest.slice(1);
          const eq = findTopLevelChar(annotation, '=');
          if (eq < 0) return p.slice(0, i + 1);
          return p.slice(0, i + 1) + ' ' + annotation.slice(eq).trim();
        }
        return p;
      }
    }
    i++;
  }
  return p;
}

// ─── Low-level scanners ─────────────────────────────────────────────────

export function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (isStringQuote(c)) {
      i = skipString(s, i);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  out.push(s.slice(start));
  return out;
}

function findTopLevelChar(s: string, target: string): number {
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (isStringQuote(c)) {
      i = skipString(s, i);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === target && depth === 0) return i;
    i++;
  }
  return -1;
}

function isStringQuote(c: string): boolean {
  return c === '"' || c === "'" || c === '`';
}

/**
 * Given `s[i]` is a string-opening quote, return the index one past the
 * matching close. Handles `\\` escapes. Template literals consume nested
 * `${…}` expressions at the top level for the purposes of this scanner
 * (we don't need perfect fidelity — just balanced brackets outside
 * strings).
 */
function skipString(s: string, i: number): number {
  const quote = s[i];
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (quote === '`' && c === '$' && s[j + 1] === '{') {
      // Skip a `${…}` template hole — recursively handle nested braces.
      let depth = 1;
      j += 2;
      while (j < s.length && depth > 0) {
        const cc = s[j];
        if (isStringQuote(cc)) {
          j = skipString(s, j);
          continue;
        }
        if (cc === '{') depth++;
        else if (cc === '}') depth--;
        j++;
      }
      continue;
    }
    if (c === quote) return j + 1;
    j++;
  }
  return s.length;
}
