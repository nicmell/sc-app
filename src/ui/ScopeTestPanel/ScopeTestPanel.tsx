import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AddToTail,
  bAlloc,
  bFree,
  nFree,
  sNew,
} from '@sc-app/server-commands';
import { BufferPoker } from '@/scope/BufferPoker';
import type { ClockController } from '@/scope/ClockController';
import type { GroupController } from '@/scope/GroupController';
import type { IdAllocator } from '@/scope/IdAllocator';
import type { SynthDefRegistry } from '@/scope/SynthDefRegistry';
import type { WorkerClient } from '@/scope/WorkerClient';
import type { ScopeChunk } from '@/scope/workerProtocol';
import { DEFAULT_PARAMS } from '@/config/clockConfig';
import {
  SCOPE_SYNTHDEF_NAME,
  compileScopeSynthDef,
} from '@/synth/scopeSynthDef';
import {
  TEST_TONE_SYNTHDEF_NAME,
  compileTestToneSynthDef,
} from '@/synth/testToneSynthDef';
import {
  MONITOR_SYNTHDEF_NAME,
  compileMonitorSynthDef,
} from '@/synth/monitorSynthDef';
import { ScopeView } from '@/ui/ScopeView';
import './ScopeTestPanel.scss';

const TONE_FREQ = 440;
const TONE_AMP = 0.2;
const MONITOR_AMP = 0.5;
const HARDWARE_OUT_BUS = 0;
const SCOPE_RING = DEFAULT_PARAMS.scopeChunkSize * 2;

interface ScopeTestPanelProps {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: {
    node: IdAllocator;
    buffer: IdAllocator;
    bus: IdAllocator;
  };
}

interface Resources {
  toneNodeId: number | null;
  toneBus: number | null;
  scopeNodeId: number | null;
  bufnum: number | null;
  monitorNodeId: number | null;
}

interface PokeStats {
  length: number;
  min: number;
  max: number;
  rms: number;
  first8: number[];
}

interface SubStats {
  /** Most recent chunk's tickIndex. */
  tickIndex: number;
  /** Number of chunks delivered since subscribe. */
  count: number;
  /** Rolling chunks-per-second (windowed over the last second). */
  chunksPerSec: number;
  /** Snapshot summary of the most recent chunk. */
  last: PokeStats;
}

/** Used to derive a stable scopeId per panel instance — survives
 *  Subscribe→Unsubscribe→Subscribe cycles in the same panel. */
function freshScopeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scope-${Math.random().toString(36).slice(2, 10)}`;
}

export function ScopeTestPanel({
  client,
  clock,
  group,
  registry,
  ids,
}: ScopeTestPanelProps) {
  const poker = useMemo(() => new BufferPoker(client), [client]);
  const [res, setRes] = useState<Resources>({
    toneNodeId: null,
    toneBus: null,
    scopeNodeId: null,
    bufnum: null,
    monitorNodeId: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PokeStats | null>(null);
  const [subStats, setSubStats] = useState<SubStats | null>(null);
  const [gain, setGain] = useState(1);
  // Subscribe state lives in refs because `unsubscribeRef` returns a
  // fresh function each subscription and we don't want to re-render
  // every time a chunk arrives just to keep the readout updated.
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastChunkRef = useRef<ScopeChunk | null>(null);
  // Mirror lastChunk into a separate ref handed to ScopeView. We
  // can't use lastChunkRef directly because that's typed as
  // `ScopeChunk | null` and useRef<X | null>() returns RefObject<X>
  // unless we explicitly initialise — splitting them keeps types
  // tidy and survives a future refactor where the panel might want
  // to reset the renderer ref independently.
  const renderChunkRef = useRef<ScopeChunk | null>(null);

  const hasTone = res.toneNodeId !== null;
  const hasScope = res.scopeNodeId !== null;
  const hasMonitor = res.monitorNodeId !== null;
  const hasSubscription = unsubscribeRef.current !== null;
  const hasAny =
    hasTone || hasScope || hasMonitor || res.bufnum !== null;

  const guard = useCallback(
    async <T,>(op: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await op();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[sc:scope-test]', msg);
        setError(msg);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onStartTone = useCallback(() => {
    void guard(async () => {
      if (res.toneNodeId !== null) return;
      await registry.ensureLoaded(
        TEST_TONE_SYNTHDEF_NAME,
        compileTestToneSynthDef(),
      );
      const bus = ids.bus.next();
      const nodeId = ids.node.next();
      await client.sendAndSync(
        sNew(TEST_TONE_SYNTHDEF_NAME, nodeId, AddToTail, group.groupId, {
          outBus: bus,
          freq: TONE_FREQ,
          amp: TONE_AMP,
        }),
      );
      console.log(
        `[sc:scope-test] started tone node=${nodeId} bus=${bus} (${TONE_FREQ} Hz, amp ${TONE_AMP})`,
      );
      setRes((r) => ({ ...r, toneNodeId: nodeId, toneBus: bus }));
    });
  }, [client, group, ids, registry, res.toneNodeId, guard]);

  const onStartScope = useCallback(() => {
    void guard(async () => {
      if (res.scopeNodeId !== null) return;
      if (res.toneBus === null) {
        throw new Error('start the tone first');
      }
      await registry.ensureLoaded(
        SCOPE_SYNTHDEF_NAME,
        compileScopeSynthDef(),
      );
      const bufnum = ids.buffer.next();
      await client.sendAndSync(bAlloc(bufnum, SCOPE_RING, 1));
      const nodeId = ids.node.next();
      await client.sendAndSync(
        sNew(SCOPE_SYNTHDEF_NAME, nodeId, AddToTail, group.groupId, {
          inBus: res.toneBus,
          bufnum,
          clockBus: clock.clockBus,
        }),
      );
      console.log(
        `[sc:scope-test] started scope node=${nodeId} bufnum=${bufnum} ` +
          `inBus=${res.toneBus} clockBus=${clock.clockBus}`,
      );
      setRes((r) => ({ ...r, scopeNodeId: nodeId, bufnum }));
    });
  }, [client, clock, group, ids, registry, res.scopeNodeId, res.toneBus, guard]);

  const onToggleMonitor = useCallback(() => {
    void guard(async () => {
      if (res.monitorNodeId !== null) {
        // Stop monitor
        try {
          await client.sendAndSync(nFree(res.monitorNodeId));
          console.log(
            `[sc:scope-test] stopped monitor node=${res.monitorNodeId}`,
          );
        } catch (err) {
          console.warn('[sc:scope-test] monitor nFree failed', err);
        }
        setRes((r) => ({ ...r, monitorNodeId: null }));
        return;
      }
      // Start monitor
      if (res.toneBus === null) {
        throw new Error('start the tone first');
      }
      await registry.ensureLoaded(
        MONITOR_SYNTHDEF_NAME,
        compileMonitorSynthDef(),
      );
      const nodeId = ids.node.next();
      await client.sendAndSync(
        sNew(MONITOR_SYNTHDEF_NAME, nodeId, AddToTail, group.groupId, {
          inBus: res.toneBus,
          outBus: HARDWARE_OUT_BUS,
          amp: MONITOR_AMP,
        }),
      );
      console.log(
        `[sc:scope-test] started monitor node=${nodeId} ` +
          `inBus=${res.toneBus} → outBus=${HARDWARE_OUT_BUS} amp=${MONITOR_AMP}`,
      );
      setRes((r) => ({ ...r, monitorNodeId: nodeId }));
    });
  }, [client, group, ids, registry, res.monitorNodeId, res.toneBus, guard]);

  const onToggleSubscribe = useCallback(() => {
    void guard(async () => {
      if (unsubscribeRef.current !== null) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        lastChunkRef.current = null;
        renderChunkRef.current = null;
        console.log('[sc:scope-test] unsubscribed');
        setSubStats(null);
        return;
      }
      if (res.bufnum === null) {
        throw new Error('start the scope first');
      }
      const scopeId = freshScopeId();
      // Per-second rolling window: timestamps of recent chunk arrivals.
      const recent: number[] = [];
      // Continuity check: log boundary samples once per second.
      let lastChunkData: Float32Array | null = null;
      let nextContinuityLogAt = 0;
      let count = 0;

      const off = client.subscribeScope(
        { scopeId, bufnum: res.bufnum, chunkSize: DEFAULT_PARAMS.scopeChunkSize, channels: 1 },
        (chunk) => {
          count += 1;
          const now = performance.now();
          recent.push(now);
          while (recent.length > 0 && recent[0] < now - 1000) recent.shift();

          // Hand the chunk to the renderer FIRST — its RAF reads
          // this ref each frame so we want it pointing at the
          // latest array as soon as possible.
          renderChunkRef.current = chunk;
          lastChunkRef.current = chunk;

          // Continuity diagnostic — log last4(N-1) and first4(N) every
          // second so misplaced parity stands out.
          if (lastChunkData && now >= nextContinuityLogAt) {
            const lastN = lastChunkData.length;
            const last4 = Array.from(lastChunkData.slice(lastN - 4, lastN));
            const first4 = Array.from(chunk.data.slice(0, 4));
            console.log(
              `[sc:scope-test] continuity tick=${chunk.tickIndex} ` +
                `last4=[${last4.map((v) => v.toFixed(3)).join(', ')}] ` +
                `first4=[${first4.map((v) => v.toFixed(3)).join(', ')}]`,
            );
            nextContinuityLogAt = now + 1000;
          }
          // Stash a defensive copy for the NEXT continuity check —
          // the original chunk.data was zero-copy-transferred from
          // the worker; reading it again next tick is fine (new
          // array each tick), but we need a stable snapshot of
          // *this* tick's data to compare against.
          lastChunkData = new Float32Array(chunk.data);

          setSubStats({
            tickIndex: chunk.tickIndex,
            count,
            chunksPerSec: recent.length,
            last: summarize(chunk.data),
          });
        },
      );
      unsubscribeRef.current = off;
      console.log(
        `[sc:scope-test] subscribed scopeId=${scopeId} bufnum=${res.bufnum}`,
      );
    });
  }, [client, res.bufnum, guard]);

  const onPoke = useCallback(() => {
    void guard(async () => {
      if (res.bufnum === null) throw new Error('no buffer allocated');
      const t0 = performance.now();
      const samples = await poker.poke(res.bufnum, 0, SCOPE_RING);
      const elapsedMs = performance.now() - t0;
      const s = summarize(samples);
      console.log(
        `[sc:scope-test] poke bufnum=${res.bufnum} (${elapsedMs.toFixed(
          1,
        )} ms) len=${s.length} min=${s.min.toFixed(4)} max=${s.max.toFixed(
          4,
        )} rms=${s.rms.toFixed(4)} first8=[${s.first8
          .map((v) => v.toFixed(3))
          .join(', ')}]`,
      );
      setStats(s);
    });
  }, [poker, res.bufnum, guard]);

  const onStopAll = useCallback(() => {
    void guard(async () => {
      // Drop any active subscription first so the worker stops
      // firing /b_getn for a buffer we're about to free.
      if (unsubscribeRef.current !== null) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        lastChunkRef.current = null;
        renderChunkRef.current = null;
        setSubStats(null);
      }
      // Free scope + monitor next so nothing is still reading the
      // tone bus / writing the buffer when those go away.
      if (res.monitorNodeId !== null) {
        try {
          await client.sendAndSync(nFree(res.monitorNodeId));
        } catch (err) {
          console.warn('[sc:scope-test] monitor nFree failed', err);
        }
      }
      if (res.scopeNodeId !== null) {
        try {
          await client.sendAndSync(nFree(res.scopeNodeId));
        } catch (err) {
          console.warn('[sc:scope-test] scope nFree failed', err);
        }
      }
      if (res.toneNodeId !== null) {
        try {
          await client.sendAndSync(nFree(res.toneNodeId));
        } catch (err) {
          console.warn('[sc:scope-test] tone nFree failed', err);
        }
      }
      if (res.bufnum !== null) {
        try {
          await client.sendAndSync(bFree(res.bufnum));
        } catch (err) {
          console.warn('[sc:scope-test] bFree failed', err);
        }
      }
      console.log('[sc:scope-test] stopped');
      setRes({
        toneNodeId: null,
        toneBus: null,
        scopeNodeId: null,
        bufnum: null,
        monitorNodeId: null,
      });
      setStats(null);
    });
  }, [client, res, guard]);

  // Automatic teardown if the panel unmounts while resources exist
  // (usually means the dashboard itself is going away; the dashboard
  // already frees the whole group, so this is just belt-and-braces
  // for hot-reload in dev). Always drop the subscription on unmount
  // so the worker doesn't keep firing /b_getn into nothing.
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current !== null) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (res.scopeNodeId !== null || res.toneNodeId !== null) {
        console.log('[sc:scope-test] panel unmount — resources still active');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="scope-test-panel">
      <header>Scope test</header>
      <div className="row">
        <button
          type="button"
          onClick={onStartTone}
          disabled={busy || hasTone}
        >
          Start tone
        </button>
        <button
          type="button"
          onClick={onStartScope}
          disabled={busy || !hasTone || hasScope}
        >
          Start scope
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onToggleMonitor}
          disabled={busy || !hasTone}
          title={`Toggle hardware-out monitor on bus ${HARDWARE_OUT_BUS}`}
        >
          {hasMonitor ? 'Stop monitor' : 'Monitor'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onToggleSubscribe}
          disabled={busy || !hasScope}
          title="Toggle worker tick-driven /b_getn loop"
        >
          {hasSubscription ? 'Unsubscribe' : 'Subscribe'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onPoke}
          // Worker intercepts /b_setn for subscribed bufnums, so a
          // BufferPoker against the same bufnum would hang.
          disabled={busy || !hasScope || hasSubscription}
          title={
            hasSubscription
              ? 'Disabled while subscribed — the worker intercepts /b_setn for this bufnum'
              : 'Manually read the entire scope ring via /b_getn'
          }
        >
          Poke
        </button>
        <button
          type="button"
          className="danger"
          onClick={onStopAll}
          disabled={busy || !hasAny}
        >
          Stop all
        </button>
      </div>
      <div className="status">
        {hasTone
          ? `tone on bus ${res.toneBus}`
          : 'tone idle'}
        {' · '}
        {hasScope
          ? `scope → bufnum ${res.bufnum}`
          : 'scope idle'}
        {' · '}
        {hasMonitor
          ? `monitor → out ${HARDWARE_OUT_BUS}`
          : 'monitor off'}
        {' · '}
        {hasSubscription
          ? `subscribed (${subStats ? `${subStats.chunksPerSec}/s` : 'no chunks yet'})`
          : 'unsubscribed'}
      </div>
      {hasSubscription && (
        <>
          <ScopeView chunkRef={renderChunkRef} gain={gain} />
          <div className="row">
            <label className="status">
              gain&nbsp;
              <input
                type="number"
                step={0.5}
                min={0}
                value={gain}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0) setGain(v);
                }}
                style={{
                  width: '4rem',
                  padding: '0.15rem 0.4rem',
                  background: '#15171b',
                  color: '#e4e6eb',
                  border: '1px solid #2c2f36',
                  borderRadius: 3,
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                }}
              />
            </label>
          </div>
        </>
      )}
      {subStats && (
        <pre className="readout">
          {`SUB tick=${subStats.tickIndex} count=${subStats.count} ${subStats.chunksPerSec}/s
last min=${subStats.last.min.toFixed(4)}  max=${subStats.last.max.toFixed(4)}  rms=${subStats.last.rms.toFixed(4)}
first8=[${subStats.last.first8.map((v) => v.toFixed(4)).join(', ')}]`}
        </pre>
      )}
      {stats && (
        <pre className="readout">
          {`POKE length=${stats.length}
min=${stats.min.toFixed(4)}  max=${stats.max.toFixed(4)}  rms=${stats.rms.toFixed(4)}
first8=[${stats.first8.map((v) => v.toFixed(4)).join(', ')}]`}
        </pre>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function summarize(samples: Float32Array): PokeStats {
  let min = Infinity;
  let max = -Infinity;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sumSq += v * v;
  }
  return {
    length: samples.length,
    min: samples.length ? min : 0,
    max: samples.length ? max : 0,
    rms: samples.length ? Math.sqrt(sumSq / samples.length) : 0,
    first8: Array.from(samples.slice(0, 8)),
  };
}
