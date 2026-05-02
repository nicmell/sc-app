# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 27 shipped; Phase 28 in flight (28a–d shipped, 28e–f
pending).** Phases 0–27 are in [`docs/history.md`](./docs/history.md).
Phase 28 below is the active piece of work.

---

## Phase 28 — Shared UI foundation package

**Goal.** Extract base styles and design tokens from the React
app into a standalone, framework-agnostic CSS package
(`@sc-app/ui-foundation`). Same stylesheet is consumed by the
React host (today) and future runtime HTML plugins (trusted,
light DOM, inheriting via the global cascade) — plugins write
plain semantic HTML with `data-*` variants and pick up the host
palette without bundling their own design system.

### Architectural decisions (locked)

- **Tokens layer:** Open Props as the primitive set (full
  vocabulary so plugins have what they need); semantic tokens
  on top.
- **Styling approach:** Plain CSS — no Tailwind, no Panda, no
  CSS-in-JS, no Sass. PostCSS during build does only `@import`
  inlining + autoprefixing.
- **Component variants:** `data-*` attributes (not class
  combinations).
- **Theming:** `data-theme` attribute on `<html>`, CSS variables
  throughout. Phase 28 ships dark only; `themes/light.css` is a
  documented stub for the future toggle.
- **Plugin model (future):** light DOM by default so the global
  cascade reaches plugin HTML; shadow DOM is opt-in. Trusted
  plugins, no sandboxing.

### Sub-phases

- **28a — Scaffold + build pipeline.** ✅ Shipped (commit be38902).
  `packages/ui-foundation/` with package.json, postcss config,
  empty layer files. App imports `@sc-app/ui-foundation` once at
  `src/main.tsx`. PostCSS produces `dist/index.css` for plugin
  runtime loading. Open Props installed as a dependency.
- **28b — Tokens + reset + base elements.** ✅ Shipped (commit
  9ce63f7). `tokens/semantic.css` with the spacing / radius /
  typography / shadow vocabulary; `themes/dark.css` with the
  full `--color-*` palette ported from `src/styles.scss`
  (including `--color-tx`, `--color-rx`, `--color-log-*`,
  `--color-overlay` promoted from hardcoded hexes); `reset.css`
  + `base/typography.css` + `base/elements.css` styling
  `<button>` / `<input>` / `<select>` / `<textarea>` / `<label>`
  / headings / code / details. `demo.html` is the regression
  gate: raw HTML rendered against `./dist/index.css`.
- **28c — Reference component (Button via ConnectScreen).** ✅
  Shipped (commit deb9aa4). Dropped the local `button` rule
  from `src/ui/ConnectScreen/ConnectScreen.scss`; the submit
  button is now plain `<button type="submit">…</button>` and
  picks up styling from the foundation. Footer was named in
  the plan but has no buttons (pure status display) — reference
  test runs through ConnectScreen alone.
- **28d — Primitive component classes.** ✅ Shipped (commit
  dd2d696). Filled `components/{panel,cluster,stack,status-pill,
  badge,range-field,empty-state,error-alert,modal}.css` with
  the actual rules. `demo.html` extended to render each
  primitive in isolation.

#### Pending sub-phases

- **28e — Migrate panels to the foundation.** ~2 days. One
  commit per panel. For each: rewrite the React component to
  use foundation primitive classes + `data-variant` attributes,
  replace `var(--bg)` etc. with `var(--color-bg)` etc., delete
  the panel's `.scss` file. Panel order (smallest / lowest-risk
  first):

  1. **Footer** — single class, cleanest. Drops local SCSS,
     wraps content in `.panel.dashboard-footer` (or just
     uses panel chrome).
  2. **Dashboard-shell header** — Disconnect button to
     `<button data-variant="ghost">`, chunk-size picker to
     foundation `<select>`, `.badge` to foundation `.badge`.
     Removes the entire `.dashboard-shell > header` block from
     `src/styles.scss`.
  3. **ScopeList** — toolbar + items pattern; flushes
     `.empty` / `.error` use.
  4. **ScopeView** — canvas overlay + button group + select;
     `--color-overlay` in place of the hardcoded `#b4b8c0`.
  5. **ClockPanel** — exercises `.status-pill` variants
     (running / paused / stopped) and button modifiers.
  6. **SynthsPanel** — exercises `.range-field` for the
     first time in production.
  7. **Modal** — moves to thin React wrappers calling the
     foundation classes. Modal.scss drops to zero, Modal.tsx
     renders `<button data-variant="primary|danger">` for
     actions instead of `className="primary|danger"`.
  8. **DebugLog** — flushes `--color-log-{info,warn,error}`;
     fixed-position overlay survives.
  9. **OscConsole** — flushes `--color-tx` / `--color-rx`;
     grid log layout survives.
  10. **RecordingPanel** — exercises state-pill variants;
      canvas container survives.
  11. **DirtPanel** — REPL row, port `dirt-pulse` keyframe to
      `base/elements.css` (or kept in components/status-pill.css
      if it's the only consumer), details/summary disclosure.
  12. **SequencerPanel** — biggest (BankSelector + ChainEditor
      + TrackRow + StepCell + StepPopover + TrackDefaults).
      Either one large commit or 2–3 sub-commits; each
      sub-component still uses the foundation for buttons,
      status pills, range-fields.

  Acceptance per panel: visual parity (manual side-by-side at
  the dev server vs. previous behaviour); `yarn build` clean;
  the panel's `.scss` file is gone. Hardcoded hex colours
  remaining in any TSX/SCSS is a regression — all colour goes
  through `--color-*` tokens.

- **28f — Cleanup + parent-phase close.** ½ day. Delete
  `src/styles.scss` entirely (anything that survives moves into
  the foundation's `tokens/semantic.css`, `base/elements.css`,
  or `components/*.css`). Remove `sass` from `devDependencies`.
  Update CLAUDE.md ("React in `src/ui/` only" → "Reusable
  primitives in `@sc-app/ui-foundation`; app-specific React in
  `src/ui/`"). Move the consolidated Phase 28 entry from
  `plan.md` to `docs/history.md`. Trim this section out of
  `plan.md`.

### Acceptance criteria (parent phase)

- `src/styles.scss` and every `src/ui/*/*.scss` deleted.
- `yarn` workspace has no `sass` dependency.
- All colour, spacing, radius, typography references go through
  `var(--color-*)` / `var(--space-*)` / `var(--radius-*)` /
  `var(--font-*)`. No hardcoded hex outside the dark / light
  theme files.
- `packages/ui-foundation/demo.html` renders all base elements
  + primitives correctly when loaded against
  `dist/index.css`.
- The running app renders identically (or close enough that
  any visual delta is intentional and noted).
- Plugin authors (future) can `<link rel="stylesheet"
  href=".../@sc-app/ui-foundation/dist/index.css">` and write
  `<button>` / `<input>` / `<span class="status-pill"
  data-variant="ok">` and have it look right with no extra
  CSS.

### Constraints / gotchas

- **No `@apply`, no Tailwind directives, no Sass.** Plain CSS
  only. PostCSS during build does only `@import` inlining and
  autoprefixing.
- **Token names are public API.** Renaming `--color-primary`
  later is a breaking change. Document in the package README.
- **Don't over-design components upfront.** The primitive list
  in 28d is the entire scope. New patterns get added when they
  appear twice in feature code, not before.
- **The demo.html page is non-negotiable.** If a raw `<button>`
  there doesn't look right without React, the foundation isn't
  doing its job.
- **Vendor prefixes for slider thumbs.** `input[type="range"]
  ::-webkit-slider-thumb` and `::-moz-range-thumb` need explicit
  styling. `autoprefixer` doesn't inject these.
- **`@keyframes` go in `base/` or the single component that owns
  them**, not duplicated. The two existing animations
  (`dirt-pulse`, `modal-progress-slide`) are global; selectors
  target `[data-state]` attributes so plugin HTML can opt in.
- **Light DOM cascade** means a plugin's `<input>` will pick up
  our styles automatically. Avoid overly-specific selectors
  (`body .panel input` chains) that surprise plugin authors.

### Out of scope

- Plugin loader runtime, manifest format, lifecycle.
- Lit / web-component implementations.
- Shadow-DOM injection helper (`adoptedStyleSheets`).
- Editor-specific primitives (forms, dialogs, toolbars beyond
  the basics) — add when first needed.
- Light-theme color palette — `themes/light.css` ships as a
  stub; real values land when there's a UI affordance for
  switching.
- Visual regression tests (Playwright snapshots etc.) — manual
  side-by-side via the demo page is the gate.

---

## Open Points

1. **Reply correlation for `/b_getn`.** scsynth matches replies by
   bufnum, not by explicit request id. The "one read in flight per
   bufnum per offset" invariant is what makes it safe; the worker
   enforces it via `pendingByOffset`. Dev-only assertion
   recommended.
2. **Parent group ID derivation.** `clientId × 100`, falling back
   to `100` when scsynth assigns `clientId = 0`. The fallback
   warns in the debug log. Promotion to a configurable allocator
   has not been needed.
3. **Clock bus ID.** Allocated from `ids.bus` starting at 32 to
   skip hardware-reserved buses. Confirm against scsynth boot
   config if a deployment uses a non-default
   `numAudioBusChannels`.
4. **Phase boundary parity.** `completedHalf = tickIndex % 2` (see
   Phase 5 / 8 gotchas in `docs/history.md`). The original plan had
   it inverted; verified empirically.
5. **`BufWr` is zero-order-hold.** Does not anti-alias on
   decimation. After Phase 13's revert to `decimation = 1` this
   is no longer an issue — every audio frame is written. If a
   future feature reintroduces decimation, plan for a proper
   anti-aliased path.
6. **Recording memory ceiling.** Float32 stereo at 48 kHz =
   ~23 MB/min. Practical comfortable ceiling ~10–15 min before
   RAM pressure. Streaming-to-disk (Future Improvement #2)
   addresses this.
7. **WAV 4 GB header limit.** Float32 stereo at 48 kHz → ~3h45m
   max file size in the WAV header. Above the RAM ceiling, so not
   binding in practice. RF64 deferred.
8. **Reconnection.** Out of scope. App expects manual reload on
   WS loss (the runtime error modal facilitates that). Future
   Improvement #3.
9. **Ordering constraints within parent group.** Clock at head;
   everything else `AddToTail`; producers must be created before
   consumers that read their buses. Documented in `CLAUDE.md`.
10. **Parent group placement at root.** `AddToTail` of the root
    group is now load-bearing (Phase 26 deployments share scsynth
    with sclang+SuperDirt). Documented in `CLAUDE.md` gotchas
    and at the constructor of `GroupController`.

---

## Future Improvements

Follow-on phases, in rough order of value / effort ratio. None are
blocked by anything currently shipped.

### 1. Spectral scope (FFT view)

Add a `compileFFTScopeSynthDef` that runs `FFT.kr` on the input
bus into a 1024-bin buffer (one FFT every tick — natural cadence
given `samplesPerTick = 1024`). Worker reads the buffer the same
way as a time-domain scope; main thread renders log-magnitude
bars or a filled spectrogram. Post-Phase-16, this is "add a
consumer that subscribes to a `BufferController`" — no new synth
or buffer.

**Cost:** ~1 day. Most of the work is the renderer.

### 4. Tauri-managed scsynth lifecycle

Today scsynth must be running before the user connects. In Tauri
builds we could spawn it as a managed sidecar — Tauri sets the
binary path, audio device, sample rate; we read stdout for the
`SuperCollider 3 server ready` banner; we kill cleanly on exit.

**Cost:** ~½ day. Mostly Tauri-side glue (`tauri.conf.json`
sidecar config + a Rust command wrapper). Serve / browser builds
keep "bring your own scsynth" semantics.

### 5. Test coverage for `src/`

The two workspace packages have parity tests. The app itself has
zero. The pieces that absorbed real debugging cycles are the ones
worth pinning:

- `EnvelopeBuffer` — append a known signal, snapshot, verify
  min/max columns.
- `WavMemoryWriter` — append known frames, finalise, parse the
  resulting WAV header.
- Worker recording dispatch (post-buffer-refactor, on main) —
  mock the chunk stream, fire a sequence of tick events with a
  dropped reply, assert reorder + gap accounting.
- `BufferManager` — refcount semantics under interleaved
  acquire/release.
- `SequencerController` (post-Phase-27) — feed a fake clock,
  assert the schedule queue against expected `dirtClient.play`
  calls.

Vitest is already set up in workspace packages.

**Cost:** ~1 day.

### 6. Persistent UI settings

`localStorage` per-session: last-used scsynth address (already
done), preferred chunkSize, channel count, recording bus, window
size, sequencer pattern bank (lands in Phase 27c).

**Cost:** ~½ day.

### 7. Bus naming / labelling

A small label registry — "synth out", "FX return", "monitor mix"
— would let recordings + scopes show meaningful names instead of
ad-hoc memorisation. The bus number stays the source of truth;
the label is purely UI.

**Cost:** ~½ day.

### 8. Per-scope/recording independent pause

Today `/n_run 0` on the parent group freezes everything.
Sometimes you want to pause one scope while keeping the rest
running. Implementable as `/n_run 0 nodeId` on the specific
synth, with state tracked per-controller.

**Cost:** ~½ day.
