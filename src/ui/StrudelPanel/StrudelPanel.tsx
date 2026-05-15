/**
 * StrudelPanel — live-coding REPL powered by @strudel/codemirror.
 *
 * This file is lazy-loaded (React.lazy in AppShell), so the entire
 * @strudel/* runtime lands in a separate chunk and never bloats the
 * main bundle. All strudel imports are top-level here so Vite can
 * tree-shake and chunk them together.
 *
 * Pattern output is intercepted by StrudelController.defaultOutput
 * and routed through DirtClient.playAtTimetag() over the existing
 * bridge — no second WebSocket, no bridge changes.
 *
 * AGPL-3.0 notice: @strudel/* packages are AGPL-3.0 licensed.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StrudelMirror } from '@strudel/codemirror';
import { transpiler } from '@strudel/transpiler';
import { initStrudel } from '@strudel/web';
import type { MetronomeController } from '@/metronome/MetronomeController';
import type { StrudelController } from '@/strudel/StrudelController';
import './StrudelPanel.css';

/** Lazy-singleton: assigns Strudel's globals (`s`, `note`, mini-notation,
 *  etc.) to `globalThis` so user-typed REPL code can find them.
 *
 *  Strudel's `j9` evaluator uses `new Function(...)`, which has NO access
 *  to lexical scope — it can only see `globalThis`. So without this
 *  setup, every Strudel program fails with `s is not defined`.
 *
 *  `initStrudel` is the canonical entry point — it calls `evalScope`
 *  internally with the right module list. It also spins up an idle
 *  WebAudio repl as a side effect (assigned to a module-level singleton
 *  inside @strudel/web); we ignore that and use StrudelMirror's own
 *  repl with our custom defaultOutput. The duplicate stays idle since
 *  we never call `.evaluate()` on it. */
let strudelGlobalsReady: Promise<unknown> | null = null;
function ensureStrudelGlobals(): Promise<unknown> {
  if (!strudelGlobalsReady) {
    strudelGlobalsReady = initStrudel({});
  }
  return strudelGlobalsReady;
}

const DEFAULT_CODE = `// Strudel — patterns route through SuperDirt via our OSC bridge.
// Example: s("bd hh*2 sd hh")
// Press Ctrl+Enter or click Run.
`;

// Strudel's tempo is set as `cps` (cycles per second). Under the
// Tidal convention of 4 beats per cycle, BPM ↔ cps maps as
// cps = bpm / 60 / 4 = bpm / 240. So Strudel's default 0.5 cps
// = 120 BPM, matching the sequencer's default. The BPM value
// itself lives on the centralized `MetronomeController`; this
// panel subscribes to it and pushes the matching cps into the
// Cyclist scheduler.
const BEATS_PER_CYCLE = 4;

function bpmToCps(bpm: number): number {
  return bpm / 60 / BEATS_PER_CYCLE;
}

function cpsToBpm(cps: number): number {
  return cps * 60 * BEATS_PER_CYCLE;
}

/** Cap on the queue-for-next-cycle wait. At slow tempos (e.g. user
 *  types `setcps(0.05)`) a single cycle can be 20 seconds; we don't
 *  want Play to feel unresponsive. Beyond this cap, start immediately
 *  rather than waiting for the boundary. 4 sec covers the practical
 *  BPM range (≥ 60 BPM ⇒ cycleDur ≤ 4 s under the 4-beats-per-cycle
 *  convention). */
const MAX_QUEUE_WAIT_MS = 4000;

interface StrudelPanelProps {
  controller: StrudelController;
  metronome: MetronomeController;
  clockReady: boolean;
}

export function StrudelPanel({
  controller,
  metronome,
  clockReady,
}: StrudelPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<InstanceType<typeof StrudelMirror> | null>(null);
  /** Timer id for the queue-for-next-cycle delay. Non-null while we
   *  are waiting to evaluate at a cycle boundary. Cleared by Stop or
   *  on unmount so the delayed evaluate doesn't fire against a torn-
   *  down mirror. */
  const pendingStartTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const bpm = useSyncExternalStore(
    (cb) => metronome.bpm.subscribe(cb),
    () => metronome.bpm.get(),
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mirror = new StrudelMirror({
      root,
      initialCode: DEFAULT_CODE,
      defaultOutput: controller.defaultOutput,
      // Audio-clock seconds (since tick0Ms) as the time source —
      // phase-locks the Cyclist scheduler to scsynth's shared
      // clock. Cycle 0 starts at audio frame 0; cycle boundaries
      // align with tick boundaries modulo the small network
      // jitter on the first /clock/tick arrival.
      getTime: controller.getTime,
      transpiler,
      // prebake is called once in the constructor and its promise is
      // awaited before every evaluation. We use it to lazily expose
      // Strudel's globals to `globalThis` — without this, `s("bd hh")`
      // throws `s is not defined` in the Function-based evaluator.
      prebake: () => ensureStrudelGlobals().then(() => undefined),
      // Don't colour the root background — our .panel CSS handles it.
      bgFill: false,
      // Don't broadcast stop-other-repls events — we have one panel.
      solo: false,
      onToggle: (started: boolean) => setIsPlaying(started),
      onEvalError: (err: Error) => setEvalError(err.message),
      afterEval: () => setEvalError(null),
    });
    mirrorRef.current = mirror;
    // Push the current BPM into the freshly-created repl so the scheduler
    // starts at the user-selected tempo, not Strudel's default 0.5 cps.
    // Subsequent metronome changes are handled by the dedicated
    // bpm-effect below.
    mirror.repl.setCps(bpmToCps(bpm));

    // Wrap the Cyclist's setCps so that top-level `setcps(...)` calls
    // from user code propagate back to the centralized metronome.
    // This catches:
    //   - User-typed `setcps(0.8)` at the top of a pattern
    //   - Our own `mirror.repl.setCps(...)` from the bpm-effect
    //     below (round-trips harmlessly — metronome.setBpm is
    //     idempotent on equal values after rounding)
    // It does NOT catch Hap-based cps modulation (e.g.
    // `cpm("120 240")` in a pattern), because the Cyclist tick
    // handler assigns `this.cps = hap.value.cps` directly without
    // going through this method. That's the desired cut — fast
    // modulation shouldn't yank the sequencer around.
    const scheduler = mirror.repl.scheduler;
    const originalSetCps = scheduler.setCps;
    scheduler.setCps = function (cps: number) {
      const result = originalSetCps.call(this, cps);
      if (Number.isFinite(cps) && cps > 0) {
        metronome.setBpm(cpsToBpm(cps));
      }
      return result;
    };

    return () => {
      if (pendingStartTimerRef.current !== null) {
        window.clearTimeout(pendingStartTimerRef.current);
        pendingStartTimerRef.current = null;
      }
      // Restore the original setCps so a later StrudelMirror mount
      // (after disconnect/reconnect) starts from a clean slate.
      scheduler.setCps = originalSetCps;
      mirror.stop();
      // Removes the document-level event listeners StrudelMirror adds.
      mirror.clear();
      mirrorRef.current = null;
    };
    // bpm is intentionally omitted — we only need the value at mirror-
    // creation time here; the bpm-tracking effect below handles changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller]);

  // Push metronome BPM into the Cyclist whenever it changes. Pattern
  // code can still override via `setcps(x)` — those emissions win
  // because the Cyclist re-reads cps from each Hap's value.
  useEffect(() => {
    mirrorRef.current?.repl.setCps(bpmToCps(bpm));
  }, [bpm]);

  const handleRun = useCallback(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;

    // Re-eval while already playing: apply changes live (Cyclist
    // swaps the pattern in place; no need to wait for a boundary).
    if (mirror.repl.scheduler.started) {
      void mirror.evaluate();
      return;
    }

    // First start — quantize to the next beat boundary in audio
    // time so cycle 0 begins at a multiple of `1 / (cps * 4)` seconds
    // since tick0Ms (Tidal: 4 beats per cycle). The sequencer pump
    // uses the same beat grid (multiples of `beatTicks` since tick 0),
    // so both REPLs started within ~1 beat of each other land on the
    // same boundary. Max wait is one beat — ~500 ms at 120 BPM, 1 s
    // at 60 BPM — versus the ~2 s you'd get aligning to full cycles.
    const cps = mirror.repl.scheduler.cps || bpmToCps(bpm);
    const audioNow = controller.getTime();
    if (cps <= 0 || !Number.isFinite(audioNow)) {
      void mirror.evaluate();
      return;
    }
    const beatDurSecs = 1 / (cps * BEATS_PER_CYCLE);
    const nextBeatSecs =
      Math.ceil(audioNow / beatDurSecs) * beatDurSecs;
    const delayMs = Math.max(0, (nextBeatSecs - audioNow) * 1000);

    // Snap-to-now if we're effectively at the boundary, or fall
    // back to immediate start if the wait would exceed the cap
    // (e.g. user typed setcps(0.05) → 20 sec cycles).
    if (delayMs < 5 || delayMs > MAX_QUEUE_WAIT_MS) {
      void mirror.evaluate();
      return;
    }

    setIsQueued(true);
    pendingStartTimerRef.current = window.setTimeout(() => {
      pendingStartTimerRef.current = null;
      setIsQueued(false);
      void mirror.evaluate();
    }, delayMs);
  }, [controller, bpm]);

  const handleStop = useCallback(() => {
    if (pendingStartTimerRef.current !== null) {
      window.clearTimeout(pendingStartTimerRef.current);
      pendingStartTimerRef.current = null;
      setIsQueued(false);
    }
    void mirrorRef.current?.stop();
  }, []);

  return (
    <section className="panel strudel-panel">
      <header>Strudel</header>
      <div className="strudel-toolbar cluster" data-gap="sm">
        <button
          type="button"
          onClick={handleRun}
          disabled={!isPlaying && !clockReady}
          title={!isPlaying && !clockReady ? 'audio clock not running' : undefined}
        >
          Run
        </button>
        <button
          type="button"
          data-variant="ghost"
          onClick={handleStop}
          disabled={!isPlaying && !isQueued}
        >
          Stop
        </button>
        {isQueued && (
          <span className="status-pill" data-variant="warn">
            queued
          </span>
        )}
        {isPlaying && (
          <span className="status-pill" data-variant="ok">
            playing
          </span>
        )}
      </div>
      <div ref={rootRef} className="strudel-editor-root" />
      {evalError && <p className="error strudel-error">{evalError}</p>}
    </section>
  );
}
