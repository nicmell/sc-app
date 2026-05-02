# Plan: Extract Shared UI Foundation Package (`@sc-app/ui-foundation`)

## Context

Extract base styles and design tokens from the React app into a standalone, framework-agnostic CSS package. Immediate goal: clean up `src/ui/*` by centralizing tokens, base element styles, and a small set of semantic-class primitives.

Forward-looking goal (not built now): the host will eventually load runtime HTML plugins (trusted, internal/vetted) into the same document. Plugins will write plain semantic HTML and inherit styling from this package via the global cascade. The package is therefore designed so a plugin's HTML and the app's React JSX both pull from the exact same stylesheet — no plugin-specific theming, no design-system knowledge required from plugin authors. **This is what drives the "plain CSS, generous token vocabulary, raw HTML elements work without classes" constraints below.**

## Architectural decisions already made

- **Tokens layer:** Open Props as the primitive set (full vocabulary so plugins have what they need); semantic tokens on top.
- **Styling approach:** Plain CSS — no Tailwind, no Panda, no CSS-in-JS, no Sass.
- **Component variants:** `data-*` attributes (not class combinations).
- **Theming:** `data-theme` attribute on `<html>`, CSS variables throughout.
- **Plugin model (future):** light DOM by default so the global cascade reaches plugin HTML; shadow DOM is opt-in for components that need encapsulation. Trusted plugins, so no sandboxing.

---

## Deliverables

### 1. Create `@sc-app/ui-foundation` package

Framework-agnostic. Pure CSS. No JS, no React.

```
packages/ui-foundation/
├── package.json
├── README.md
├── src/
│   ├── index.css              # entry — @imports everything in order
│   ├── reset.css              # minimal reset
│   ├── tokens/
│   │   ├── primitives.css     # @import "open-props/style"
│   │   └── semantic.css       # --color-*, --space-*, --radius-* etc.
│   ├── themes/
│   │   ├── dark.css           # default theme, applied at :root
│   │   └── light.css          # applied via [data-theme="light"]
│   ├── base/
│   │   ├── elements.css       # button, input, select, textarea, label, h1-h6, a, code
│   │   └── typography.css     # font defaults, code/pre, headings
│   └── components/
│       ├── panel.css          # .panel + .panel > header + .panel .row
│       ├── modal.css          # .modal + .modal-backdrop + [data-variant]
│       ├── status-pill.css    # .status-pill[data-variant="ok|warn|error|info|muted"]
│       ├── badge.css          # .badge (the "connected" pill in dashboard header)
│       ├── range-field.css    # .range-field (label + input[range] + value layout)
│       ├── empty-state.css    # .empty
│       ├── error-alert.css    # .error
│       ├── stack.css          # .stack (vertical layout w/ gap)
│       └── cluster.css        # .cluster (horizontal flex w/ gap + wrap)
└── dist/                       # built CSS (postcss-import + autoprefixer → dist/index.css)
```

**`package.json` shape** (mirrors `@sc-app/server-commands` for workspace-no-build, but we DO build CSS for the plugin runtime):

```json
{
  "name": "@sc-app/ui-foundation",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.css",
    "./dist": "./dist/index.css",
    "./reset": "./src/reset.css",
    "./tokens": "./src/tokens/index.css",
    "./themes/dark": "./src/themes/dark.css",
    "./themes/light": "./src/themes/light.css",
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "postcss src/index.css -o dist/index.css"
  },
  "dependencies": {
    "open-props": "^1.7.x"
  },
  "devDependencies": {
    "postcss": "...",
    "postcss-cli": "...",
    "postcss-import": "...",
    "autoprefixer": "..."
  }
}
```

App-side wiring:
- `vite.config.ts`: alias `@sc-app/ui-foundation` → `packages/ui-foundation/src/index.css` (Vite handles `@import` chain natively).
- `tsconfig.json`: not strictly needed (it's CSS), but add a path entry for editor IntelliSense if we add helper TS later.
- Single import at app entry: `import '@sc-app/ui-foundation';` in `src/main.tsx`.

### 2. Token vocabulary (the public API)

The current `src/styles.scss` exposes ~35 design tokens that need to migrate to `tokens/semantic.css` and become the package's stable public contract. Group them by purpose; ALL semantic tokens point at Open Props primitives so the underlying primitive set is replaceable later.

**Spacing** (replaces ad-hoc `--row-gap`, `--panel-gap`, `--panel-padding`):
```css
--space-3xs: var(--size-1);   /* 0.125rem */
--space-2xs: var(--size-2);   /* 0.25rem  */
--space-xs:  var(--size-3);   /* 0.5rem   */
--space-sm:  var(--size-4);   /* 0.75rem  */
--space-md:  var(--size-5);   /* 1rem     */
--space-lg:  var(--size-6);   /* 1.25rem  */
--space-xl:  var(--size-7);   /* 1.5rem   */
--space-2xl: var(--size-8);   /* 2rem     */
```

**Radii**:
```css
--radius-sm:  var(--radius-1);   /* 2px  */
--radius-md:  var(--radius-2);   /* 5px  */
--radius-lg:  var(--radius-3);   /* 1rem */
--radius-pill: var(--radius-round); /* 1e5px */
```

**Colors — surface** (replaces `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--surface-input`):
```css
--color-bg:           ...;  /* page background */
--color-surface-1:    ...;  /* panel background */
--color-surface-2:    ...;  /* nested item background */
--color-surface-3:    ...;  /* hover / active */
--color-surface-input: ...; /* form control background */
```

**Colors — text** (replaces `--text`, `--text-dim`, `--text-mute`, `--text-faint`):
```css
--color-text:        ...;  /* primary */
--color-text-dim:    ...;  /* secondary, labels */
--color-text-mute:   ...;  /* tertiary */
--color-text-faint:  ...;  /* separators */
--color-text-on-primary: white;
```

**Colors — border**:
```css
--color-border:        ...;
--color-border-strong: ...;
--color-border-focus:  ...;
```

**Colors — semantic state** (replaces `--accent`, `--ok*`, `--warn*`, `--info*`, `--danger*`, `--error*`):
```css
--color-primary:        ...;   /* was --accent */
--color-primary-hover:  ...;   /* was --accent-hover */
--color-on-primary:     white;

--color-ok:        ...;
--color-ok-bg:     ...;
--color-ok-strong: ...;
--color-ok-text:   ...;

--color-warn:        ...;
--color-warn-bg:     ...;
--color-warn-border: ...;
--color-warn-text:   ...;

--color-info-bg:     ...;
--color-info-border: ...;
--color-info-text:   ...;

--color-danger:        ...;   /* was --danger */
--color-danger-hover:  ...;   /* was --danger-hover */
--color-error-bg:      ...;
--color-error-border:  ...;
--color-error-text:    ...;
```

**Typography**:
```css
--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
--font-sans: system-ui, sans-serif;

--font-size-xs:  var(--font-size-0);   /* 0.75rem  */
--font-size-sm:  var(--font-size-1);   /* 0.875rem */
--font-size-md:  var(--font-size-2);   /* 1rem     */
--font-size-lg:  var(--font-size-3);   /* 1.125rem */
```

**Layout** (replaces `--dashboard-max-width`):
```css
--layout-max-width: 1100px;
```

**Shadows** (new — Modal, Popover need this; previously hardcoded):
```css
--shadow-sm: var(--shadow-2);
--shadow-md: var(--shadow-4);
--shadow-lg: var(--shadow-6);  /* used by .modal */
```

Tokens to **drop** (replace with Open Props primitives or inline) — these were one-offs that don't earn semantic names:
- The 9 hardcoded hex escapes in OscConsole / DebugLog / ScopeView (rx/tx/log-level colors). Either promote to `--color-log-info` / `--color-log-warn` / `--color-log-error` / `--color-tx` / `--color-rx` and add to semantic.css, or inline as `var(--blue-3)` etc. **Recommend: promote** — they're a small but real semantic group ("network direction" + "log severity"); plugins authoring debug surfaces will want them.

**README documents the semantic token list as the public API.** Open Props primitives are exposed (cascade) but not documented as stable — plugins should prefer semantic names.

### 3. Base elements + minimal semantic classes

Raw HTML elements look correct without any classes. This is the load-bearing constraint for the plugin future: a plugin that emits `<button>` should match the host's buttons, no class boilerplate.

**Base elements** (in `base/elements.css`):
- `button` — default = primary. Variants via `data-variant="secondary|ghost|danger"` and `data-size="sm"`. Disabled / focus states.
- `input[type="text"]`, `input[type="number"]`, `input[type="range"]` — surface background, border, focus ring, vendor-prefix slider thumbs.
- `select` — same chrome as inputs.
- `textarea` — same.
- `label` — inline-flex, gap, dim text.
- `code`, `pre` — mono font, surface-2 background, small radius.
- `h1` … `h6` — sane defaults; the `.panel > header` rule (component layer) overrides for panel titles.
- `a` — primary color, underline on hover.
- `details` / `summary` — used by DirtPanel's "Replies" disclosure. Cursor + hover state.

**Component classes** — the concrete primitive set extracted from the existing `src/ui/*` codebase, smallest stable set:

| Class                 | HTML shape                                     | Variants (`data-*`)                          | Replaces (in current code)                                       |
| --------------------- | ---------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `.panel`              | `<section class="panel"><header>…</header>…</section>` | none                                         | global `.panel` in `src/styles.scss`                             |
| `.panel > header`     | (selector)                                     | none                                         | uppercase / dim / letter-spaced panel title                      |
| `.row` / `.cluster`   | `<div class="cluster">…</div>`                 | `data-gap="sm|md|lg"`                        | global `.row`; the per-panel `.toolbar`                          |
| `.stack`              | `<div class="stack">…</div>`                   | `data-gap="sm|md|lg"`                        | column-flex with gap (currently inlined in panels)               |
| `.status-pill`        | `<span class="status-pill" data-variant="ok"><span class="dot"/>label</span>` | `ok | warn | error | info | muted`           | ClockPanel `.pill`, DirtPanel `.status-pill`, RecordingPanel `.state-pill` |
| `.badge`              | `<span class="badge">connected</span>`         | `data-variant="ok|warn|error"`               | dashboard-shell header `.badge`                                  |
| `.range-field`        | `<label class="range-field"><span>label</span><input type="range"/><span class="range-field-value">0.80</span></label>` | none                                         | SynthsPanel `.range-field`, SequencerPanel track-defaults / step-popover slider rows |
| `.empty`              | `<p class="empty">no tracks…</p>`              | none                                         | the `.empty` placeholder in 5 panels                             |
| `.error`              | `<p class="error">…</p>`                       | none                                         | inline `.error` in DirtPanel, SynthsPanel, RecordingPanel, ScopeList |
| `.modal-backdrop`     | `<div class="modal-backdrop"><div class="modal" data-variant="danger">…</div></div>` | `data-variant="primary|danger"` on `.modal`  | `src/ui/Modal/Modal.scss` (3 React variants → 1 CSS class)       |

**Out of the foundation package, stays in `src/ui/`** (sc-app-specific UI, not reusable / no plugin value):
- `StepCell`, `BankSelector`, `BankSlot` (sequencer grid).
- `ChainEntry` (chain editor row).
- `StepPopover`, `TrackDefaults`, `TrackRow` (sequencer-specific layouts).
- `ScopeView` (canvas + overlay).
- `RecordingItem` (waveform card).
- All panel containers (`DirtPanel`, `SequencerPanel`, etc.) — they consume primitives but aren't primitives themselves.

Each of these still uses semantic tokens; they just keep their own narrow CSS file (or move to a single `src/styles.css` with scoped class prefixes).

### 4. Refactor existing React UI

For each existing component:

1. Identify which custom styles are now covered by base elements + primitive classes — delete them.
2. Replace inline class-based variants with `data-variant` / `data-size` attributes.
3. Replace hardcoded colors / spacing / radii with semantic tokens.
4. Keep React components as thin wrappers that render the right element with the right `data-*` attributes:

```tsx
// src/ui/Modal/Modal.tsx (after refactor — purely about behavior, no styling)
export function ConfirmModal({ variant = 'primary', ...props }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" data-variant={variant}>
        …
      </div>
    </div>
  );
}
```

Single import at app entry:
```ts
// src/main.tsx
import '@sc-app/ui-foundation';
```

**Panel migration order** (smallest / lowest-risk first; one commit per panel):

1. `Footer` — single class, cleanest.
2. `ConnectScreen` — form + button, validates form-element styles.
3. `ScopeList` — toolbar + items pattern.
4. `ScopeView` — canvas overlay + button group + select; flushes the hardcoded `#b4b8c0` token decision.
5. `ClockPanel` — exercises `.status-pill` variants (running / paused / stopped) and button modifiers.
6. `SynthsPanel` — exercises `.range-field` for the first time.
7. `Modal` — moves to package; React variants stay in `src/ui/Modal/` as thin wrappers calling the foundation classes.
8. `DebugLog` — flushes the log-level color tokens (`--color-log-info` / `--color-log-warn` / `--color-log-error`); fixed-position overlay.
9. `OscConsole` — flushes `--color-tx` / `--color-rx`; grid log layout.
10. `RecordingPanel` — exercises state-pill variants; canvas container.
11. `DirtPanel` — REPL row, `dirt-pulse` animation port (becomes a `@keyframes` in `base/elements.css` since it applies to a `data-state="connecting"` dot anywhere), details/summary disclosure.
12. `SequencerPanel` — biggest (BankSelector + ChainEditor + TrackRow + StepCell + StepPopover + TrackDefaults). Sub-commits per sub-component within the same migration commit, OR split into 2-3 commits if too large.

### 5. Set up theming

In `src/main.tsx` or a small `theme.ts` helper:

```ts
const stored = localStorage.getItem('sc.theme');
const system = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
document.documentElement.dataset.theme = stored ?? system;
```

Apply before React mounts (in `index.html`'s inline script, or top of `main.tsx`) to avoid flash.

The current app has only a dark theme (no light tokens defined). For Phase 28, ship `dark.css` only and apply at `:root`; `light.css` can be a stub (or filled when there's a real reason). Theme switching in the UI is **out of scope** for the extraction phase — the architecture supports it, the user-facing toggle lands later.

### 6. Future-proofing

- **All CSS is plain CSS** — no PostCSS-only features in `src/`. PostCSS during build does only `@import` inlining and autoprefixing.
- **`dist/index.css` is shippable to plugins** — single file, no `@import`, autoprefixed. Loadable via `<link rel="stylesheet">` or `adoptedStyleSheets` in a Lit context.
- **No styles tied to React class naming** — every selector is either a raw element, a semantic class, or a `data-*` attribute, all of which work for plugin-emitted HTML.
- **Token names are stable contracts** — the README enumerates them; renaming is a breaking change.

---

## Migration order (suggested phases)

This is a substantial refactor; suggest treating as **Phase 28** with sub-phases on the existing `plan.md` discipline:

- **28a — Scaffold the package, build pipeline.** `packages/ui-foundation/` with package.json, postcss config, empty src/index.css. App imports the (empty) entry; `yarn build` is green. 1 hour.
- **28b — Tokens + reset + base elements.** Port all semantic tokens from `src/styles.scss`. Style raw elements. Single demo HTML page (`packages/ui-foundation/demo.html`) renders raw `<button>` / `<input>` / `<select>` so the package is testable in isolation. ½ day.
- **28c — Reference component end-to-end.** Pick `Button` (lives as a raw `<button>` styled by `base/elements.css`). Refactor the buttons inside `Footer` + `ConnectScreen` to drop their custom CSS. Demo page renders them next to React-rendered buttons; they look identical. **This is the regression gate** — if raw HTML doesn't match React, the foundation is leaking, fix it before continuing. ½ day.
- **28d — Primitive classes.** Add `.panel`, `.row`/`.cluster`, `.stack`, `.status-pill`, `.badge`, `.range-field`, `.empty`, `.error`, `.modal*`. Demo page covers all. ½ day.
- **28e — Migrate panels** in the order listed above. Per-panel commit; delete the panel's `.scss` as part of the same commit. **2 days.**
- **28f — Cleanup.** Delete `src/styles.scss` (anything that survives moves into the foundation's `tokens/semantic.css` or `base/elements.css`). Remove `sass` from `devDependencies`. Update `CLAUDE.md` ("React in `src/ui/` only" → "Reusable primitives in `@sc-app/ui-foundation`; app-specific React in `src/ui/`"). Move Phase 28 entry to `docs/history.md`. ½ day.

**Total: ~3.5 days** of focused work.

---

## Constraints / gotchas

- **No `@apply`, no Tailwind directives, no Sass.** Plain CSS only. PostCSS is only for `@import` inlining and autoprefixing during build.
- **Token names are public API.** Renaming `--color-primary` later is a breaking change. Document in README.
- **Don't over-design components upfront.** The primitive list above is the entire scope. New patterns get added when they appear twice in feature code, not before.
- **The HTML-only demo page is non-negotiable.** If raw `<button>Click</button>` doesn't look right without React, the foundation isn't doing its job — and won't work for plugins later.
- **Vendor prefixes for slider thumbs.** `input[type="range"]::-webkit-slider-thumb` and `::-moz-range-thumb` need explicit styling. `autoprefixer` doesn't inject these — write both in `base/elements.css`.
- **`@keyframes` go in `base/`, not in component files.** The two existing animations (`dirt-pulse`, `modal-progress-slide`) become global; selectors target `[data-state="connecting"]` / `.modal[data-state="loading"]` so plugins can opt in.
- **Light DOM cascade** means a plugin's `<input>` will pick up our styles automatically. Good for the use case, but means the foundation must avoid overly-specific selectors that surprise plugin authors. Prefer single-class / single-element selectors; avoid `body .panel input` chains.

---

## Out of scope

- Plugin loader runtime, manifest format, lifecycle.
- Lit / web-component implementations.
- Shadow-DOM injection helper (`adoptedStyleSheets`).
- Editor-specific primitives (forms, dialogs, toolbars beyond the basics) — add when first needed.
- Light-theme color palette — `themes/light.css` ships as a stub; real values land when there's a UI affordance for switching.
- Visual regression tests (Playwright snapshots etc.) — manual side-by-side via the demo page is the regression gate for now.

The foundation package supports all of these but doesn't build them now.
