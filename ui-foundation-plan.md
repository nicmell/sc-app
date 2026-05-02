# Plan: Extract Shared UI Foundation Package

## Context

We're refactoring our React codebase to extract base component styles into a standalone, framework-agnostic package. Immediate goal: clean up the existing React UI by centralizing tokens and base styles.

**Forward-looking note:** the host will eventually load runtime HTML plugins (trusted, internal/vetted) into the same document. Plugins will write plain semantic HTML and inherit styling from this package via the global cascade. We're not building the plugin loader now, but the foundation package is designed so that a plugin's HTML and the host shell pull from the exact same stylesheet — no plugin-specific theming, no design-system knowledge required from plugin authors.

### Architectural decisions already made

- **Tokens layer:** Open Props + semantic tokens on top
- **Styling approach:** Plain CSS — no Tailwind, no Panda, no CSS-in-JS
- **Component variants:** `data-*` attributes (not class combinations)
- **Theming:** `data-theme` attribute on `<html>`, CSS variables throughout
- **Plugin model (future):** light DOM by default so the global cascade reaches plugin HTML; shadow DOM is opt-in for components that need encapsulation. Trusted plugins, so no sandboxing.

---

## Deliverables

### 1. Create `@yourorg/ui-foundation` package

A framework-agnostic package containing only CSS. No JS, no React, no Lit.

```
packages/ui-foundation/
├── package.json
├── README.md
├── src/
│   ├── index.css              # entry — imports everything in order
│   ├── reset.css              # minimal reset / normalize
│   ├── tokens/
│   │   ├── primitives.css     # Open Props or curated subset
│   │   └── semantic.css       # --color-primary, --color-surface-1, etc.
│   ├── themes/
│   │   ├── light.css
│   │   └── dark.css
│   ├── base/
│   │   ├── elements.css       # button, input, select, textarea, h1-h6, a
│   │   └── typography.css
│   └── components/
│       ├── card.css           # .card
│       ├── stack.css          # .stack (vertical layout)
│       └── cluster.css        # .cluster (horizontal layout)
└── dist/                       # built CSS, optionally minified
```

**`package.json` exports:**

```json
{
  "exports": {
    ".": "./dist/index.css",
    "./tokens": "./dist/tokens.css",
    "./themes/dark": "./dist/themes/dark.css",
    "./reset": "./dist/reset.css"
  }
}
```

### 2. Define semantic tokens

Don't expose Open Props directly to consumers. Wrap them in semantic names so we can swap the underlying primitive system later if needed.

```css
/* semantic.css */
:root {
  --color-bg: var(--gray-0);
  --color-surface-1: var(--gray-1);
  --color-surface-2: var(--gray-2);
  --color-text: var(--gray-9);
  --color-text-muted: var(--gray-7);
  --color-primary: var(--indigo-6);
  --color-on-primary: white;
  --color-border: var(--gray-3);
  --color-danger: var(--red-6);
  --color-success: var(--green-6);

  --radius-sm: var(--radius-1);
  --radius-md: var(--radius-2);
  --radius-lg: var(--radius-3);

  --space-xs: var(--size-1);
  --space-sm: var(--size-2);
  --space-md: var(--size-3);
  --space-lg: var(--size-4);
  --space-xl: var(--size-6);
}
```

Document this token list as the **public API** of the package. Anything in `primitives.css` is internal.

### 3. Style raw HTML elements + minimal semantic classes

Component styling targets elements directly with `data-*` variants rather than utility classes:

```css
button {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  font: inherit;
  cursor: pointer;
}
button[data-variant="secondary"] { /* ... */ }
button[data-variant="ghost"] { /* ... */ }
button[data-size="sm"] { /* ... */ }
button[disabled] { /* ... */ }
```

Initial scope (keep small, expand as needed): `button`, `input`, `select`, `textarea`, `label`, `.card`, `.stack`, `.cluster`, base typography.

Raw elements should look correct without any classes — that way the same stylesheet works for both React-rendered markup and future plugin HTML.

### 4. Refactor existing React UI

For each existing component:

1. Identify which custom styles are now covered by the foundation package — delete them.
2. Replace any inline class-based variants with `data-variant` / `data-size` attributes.
3. Replace hardcoded colors, spacing, radii with semantic tokens (`var(--color-primary)` etc.).
4. Keep React components as thin wrappers that render the right element with the right `data-*` attributes:

```jsx
export function Button({ variant = 'primary', size, children, ...rest }) {
  return (
    <button data-variant={variant} data-size={size} {...rest}>
      {children}
    </button>
  );
}
```

Import the foundation CSS once at the app entry point:

```js
import '@yourorg/ui-foundation';
```

### 5. Set up theming

In the React app shell, add theme switching that toggles `data-theme` on `<html>`:

```js
document.documentElement.dataset.theme = 'dark'; // or 'light'
```

Persist preference in `localStorage`, read system preference on first load, apply before paint to avoid flash.

### 6. Future-proofing

- Keep all CSS pure CSS — no PostCSS-only features that would block runtime use.
- Ship a built `dist/index.css` that can be loaded via `<link>` or fetched at runtime.
- Don't tie any styles to React-specific class naming.
- Document which elements, classes, and `data-*` attributes are stable contracts in the README — this becomes the API plugin authors rely on later.

---

## Migration order (suggested)

1. Scaffold the package, set up the build (just CSS bundling — esbuild or postcss-cli is enough).
2. Implement tokens + reset + base elements. No components yet.
3. Pick one React component (e.g., `Button`) — refactor it end-to-end as the reference implementation.
4. Add a Storybook or simple HTML demo page that renders raw HTML and the React wrapper side-by-side. They should look identical. **This is the regression test for the whole approach** — and the proof the foundation will work for plugin HTML later.
5. Migrate remaining components one at a time.
6. Add `.card`, `.stack`, `.cluster` semantic classes once patterns emerge from the migration.
7. Wire up theming.

---

## Out of scope for this work

- Plugin loader runtime, manifest format, lifecycle
- Lit / web component implementations
- Shadow DOM injection helper (`adoptedStyleSheets`)
- Editor-specific primitives (forms, dialogs, toolbars, etc.) beyond the basics — add when first needed

The foundation package is designed to support all of these, but we don't build them now.

---

## Constraints / gotchas

- **No `@apply`, no Tailwind directives, no Sass.** Plain CSS only. PostCSS is fine for `@import` inlining and autoprefixing during build.
- **Token names are a public API.** Renaming `--color-primary` later is a breaking change. Choose carefully now.
- **Don't over-design components upfront.** Start with what the existing React UI actually uses. Add new patterns only when they appear twice.
- **The HTML-only demo page is non-negotiable.** If raw `<button>Click</button>` doesn't look right without React, the foundation isn't doing its job — and won't work for plugins either.
