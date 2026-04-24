import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const hasTone = res.toneNodeId !== null;
  const hasScope = res.scopeNodeId !== null;
  const hasMonitor = res.monitorNodeId !== null;
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
      // Free scope + monitor first so nothing is still reading the
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
  // for hot-reload in dev).
  useEffect(() => {
    return () => {
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
          onClick={onPoke}
          disabled={busy || !hasScope}
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
      </div>
      {stats && (
        <pre className="readout">
          {`length=${stats.length}
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
