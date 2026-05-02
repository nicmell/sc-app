# `@sc-app/ui-foundation`

Framework-agnostic CSS foundation for sc-app: tokens, base
element styles, and a small set of semantic-class primitives.
Pure CSS — no JS, no React, no Sass.

Shared between two consumers:
1. The React host (`src/ui/*`) — imports the entry once at
   `src/main.tsx`.
2. Future runtime HTML plugins (trusted, light DOM) — load
   the built `dist/index.css` via `<link>` or `adoptedStyleSheets`
   to inherit the host's look and feel without bundling their
   own design system.

## Layers, in cascade order

```
src/
  index.css              entry — @imports the layers below
  reset.css              minimal modern reset
  tokens/
    semantic.css         --color-*, --space-*, --radius-* etc. (PUBLIC API)
    index.css            tokens-only entry, importable standalone
  themes/
    dark.css             default — applied at :root
    light.css            applied under [data-theme="light"]
  base/
    elements.css         button, input, select, textarea, label, …
    typography.css       headings, code, links
  components/
    panel.css            .panel + .panel > header
    cluster.css          .cluster (horizontal flex w/ gap + wrap)
    stack.css            .stack (vertical flex w/ gap)
    status-pill.css      .status-pill[data-variant="ok|warn|…"]
    badge.css            .badge[data-variant="ok|warn|error"]
    range-field.css      .range-field (label + input[range] + value)
    empty-state.css      .empty
    error-alert.css      .error
    modal.css            .modal + .modal-backdrop[data-variant]
    toast.css            .toast-stack + .toast[data-variant=success|warn|error|info]
```

## Public API contract

The set of selectors and `data-*` attributes documented in this
README is the foundation's stable public API. **Renaming any of
them is a breaking change for plugin authors.** Add freely;
remove or rename only with a major-version bump.

### Token vocabulary (`tokens/semantic.css`)

*To be filled in Phase 28b. Will document the full --color-* /
--space-* / --radius-* / typography / shadow vocabulary.*

### Element variants

```html
<button data-variant="primary | secondary | ghost | danger"
        data-size="sm">
```

*Full element + attribute table lands with Phase 28b.*

### Component classes

*Concrete HTML shapes for each `.panel` / `.status-pill` / etc.
land with Phase 28d.*

## Build

The package ships TWO consumable forms:

- **Source** (`./src/index.css`) — used by the React host via
  Vite, which resolves the `@import` chain natively. Default
  export. Zero build step on the host side.
- **Dist** (`./dist/index.css`) — single bundled CSS file
  (autoprefixed, `@import`s inlined) for plugin runtime
  loading. Built with PostCSS via `yarn build`.

```bash
# from packages/ui-foundation/
yarn build          # one-shot
yarn build:watch    # rebuild on change (during local plugin dev)
```

## Demo page

`demo.html` renders every base element + variant against the
built `dist/index.css`. **This is the foundation's regression
gate** — if a raw `<button>` here doesn't look right, the
foundation is broken and a plugin's HTML won't look right
either.

```bash
yarn build              # populate dist/
open demo.html          # macOS; or load file:// in any browser
```

## Constraints

- **Plain CSS only.** No `@apply`, no Tailwind directives, no Sass,
  no postcss-nested. PostCSS during build does only `@import`
  inlining + autoprefixing.
- **Light DOM cascade.** Plugin HTML will live under the same root.
  Selectors stay shallow (`.panel`, `button`, `.status-pill`) —
  avoid `body .panel input`-style chains that surprise plugin
  authors.
- **`@keyframes` go in `base/elements.css`**, not in component
  files. Animations target `data-state` attributes so plugin
  HTML can opt in by writing the right attribute.
