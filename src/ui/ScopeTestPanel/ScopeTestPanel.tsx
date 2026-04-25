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
  scopeSynthDefName,
  compileScopeSynthDef,
} from '@/synth/scopeSynthDef';
import {
  TEST_TONE_SYNTHDEF_NAME,
  TEST_TONE_STEREO_SYNTHDEF_NAME,
  compileTestToneSynthDef,
  compileTestToneStereoSynthDef,
} from '@/synth/testToneSynthDef';
import {
  MONITOR_SYNTHDEF_NAME,
  compileMonitorSynthDef,
} from '@/synth/monitorSynthDef';
import { ScopeView } from '@/ui/ScopeView';
import './ScopeTestPanel.scss';

const TONE_FREQ_MONO = 440;
const TONE_FREQ_STEREO_L = 440;
const TONE_FREQ_STEREO_R = 660;
const TONE_AMP = 0.2;
const MONITOR_AMP = 0.5;
const HARDWARE_OUT_BUS = 0;
const SCOPE_RING = DEFAULT_PARAMS.scopeChunkSize * 2;

type Channels = 1 | 2;

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
  toneChannels: Channels | null;
  scopeNodeId: number | null;
  scopeChannels: Channels | null;
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
  tickIndex: number;
  count: number;
  chunksPerSec: number;
  last: PokeStats;
}

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
    toneChannels: null,
    scopeNodeId: null,
    scopeChannels: null,
    bufnum: null,
    monitorNodeId: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PokeStats | null>(null);
  const [subStats, setSubStats] = useState<SubStats | null>(null);
  const [gain, setGain] = useState(1);
  /** User-selected channel count for the *next* tone+scope pair.
   *  Locked once anything is running; reset when Stop All clears
   *  the panel. */
  const [channels, setChannels] = useState<Channels>(1);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastChunkRef = useRef<ScopeChunk | null>(null);
  const renderChunkRef = useRef<ScopeChunk | null>(null);

  const hasTone = res.toneNodeId !== null;
  const hasScope = res.scopeNodeId !== null;
  const hasMonitor = res.monitorNodeId !== null;
  const hasSubscription = unsubscribeRef.current !== null;
  const hasAny =
    hasTone || hasScope || hasMonitor || res.bufnum !== null;
  const channelsLocked = hasAny;

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
      const ch: Channels = channels;
      if (ch === 1) {
        await registry.ensureLoaded(
          TEST_TONE_SYNTHDEF_NAME,
          compileTestToneSynthDef(),
        );
        const bus = ids.bus.next();
        const nodeId = ids.node.next();
        await client.sendAndSync(
          sNew(TEST_TONE_SYNTHDEF_NAME, nodeId, AddToTail, group.groupId, {
            outBus: bus,
            freq: TONE_FREQ_MONO,
            amp: TONE_AMP,
          }),
        );
        console.log(
          `[sc:scope-test] started mono tone node=${nodeId} bus=${bus} ` +
            `(${TONE_FREQ_MONO} Hz, amp ${TONE_AMP})`,
        );
        setRes((r) => ({
          ...r,
          toneNodeId: nodeId,
          toneBus: bus,
          toneChannels: 1,
        }));
        return;
      }
      // Stereo: allocate a contiguous 2-bus block (Out.ar(b, [L, R])
      // writes L→b, R→b+1; we need to ensure b+1 isn't reused).
      await registry.ensureLoaded(
        TEST_TONE_STEREO_SYNTHDEF_NAME,
        compileTestToneStereoSynthDef(),
      );
      const bus = ids.bus.nextBlock(2);
      const nodeId = ids.node.next();
      await client.sendAndSync(
        sNew(
          TEST_TONE_STEREO_SYNTHDEF_NAME,
          nodeId,
          AddToTail,
          group.groupId,
          {
            outBus: bus,
            freqL: TONE_FREQ_STEREO_L,
            freqR: TONE_FREQ_STEREO_R,
            amp: TONE_AMP,
          },
        ),
      );
      console.log(
        `[sc:scope-test] started stereo tone node=${nodeId} buses=${bus},${bus + 1} ` +
          `(${TONE_FREQ_STEREO_L}L / ${TONE_FREQ_STEREO_R}R Hz, amp ${TONE_AMP})`,
      );
      setRes((r) => ({
        ...r,
        toneNodeId: nodeId,
        toneBus: bus,
        toneChannels: 2,
      }));
    });
  }, [client, group, ids, registry, channels, res.toneNodeId, guard]);

  const onStartScope = useCallback(() => {
    void guard(async () => {
      if (res.scopeNodeId !== null) return;
      if (res.toneBus === null || res.toneChannels === null) {
        throw new Error('start the tone first');
      }
      const ch = res.toneChannels;
      const synthName = scopeSynthDefName(ch);
      await registry.ensureLoaded(synthName, compileScopeSynthDef(ch));
      const bufnum = ids.buffer.next();
      // bAlloc takes (bufnum, numFrames, numChannels). For multi-
      // channel scopes the buffer holds N samples × C channels
      // interleaved, so numFrames is still SCOPE_RING — scsynth
      // multiplies internally by numChannels.
      await client.sendAndSync(bAlloc(bufnum, SCOPE_RING, ch));
      const nodeId = ids.node.next();
      await client.sendAndSync(
        sNew(synthName, nodeId, AddToTail, group.groupId, {
          inBus: res.toneBus,
          bufnum,
          clockBus: clock.clockBus,
        }),
      );
      console.log(
        `[sc:scope-test] started ${ch}-ch scope node=${nodeId} bufnum=${bufnum} ` +
          `inBus=${res.toneBus} clockBus=${clock.clockBus}`,
      );
      setRes((r) => ({
        ...r,
        scopeNodeId: nodeId,
        scopeChannels: ch,
        bufnum,
      }));
    });
  }, [
    client,
    clock,
    group,
    ids,
    registry,
    res.scopeNodeId,
    res.toneBus,
    res.toneChannels,
    guard,
  ]);

  const onToggleMonitor = useCallback(() => {
    void guard(async () => {
      if (res.monitorNodeId !== null) {
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
      if (res.toneBus === null) {
        throw new Error('start the tone first');
      }
      // Mono monitor only — stereo monitoring would need a 2-channel
      // monitor SynthDef; deferred until we actually want to listen.
      if (res.toneChannels !== 1) {
        throw new Error('monitor is mono-only for now');
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
  }, [
    client,
    group,
    ids,
    registry,
    res.monitorNodeId,
    res.toneBus,
    res.toneChannels,
    guard,
  ]);

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
      if (res.bufnum === null || res.scopeChannels === null) {
        throw new Error('start the scope first');
      }
      const scopeId = freshScopeId();
      const ch = res.scopeChannels;
      const recent: number[] = [];
      let lastChunkData: Float32Array | null = null;
      let nextContinuityLogAt = 0;
      let count = 0;

      const off = client.subscribeScope(
        {
          scopeId,
          bufnum: res.bufnum,
          chunkSize: DEFAULT_PARAMS.scopeChunkSize,
          channels: ch,
        },
        (chunk) => {
          count += 1;
          const now = performance.now();
          recent.push(now);
          while (recent.length > 0 && recent[0] < now - 1000) recent.shift();

          renderChunkRef.current = chunk;
          lastChunkRef.current = chunk;

          if (lastChunkData && now >= nextContinuityLogAt) {
            // Channel-0 boundary check (other channels follow the
            // same audio time so just one is representative).
            const lastN = lastChunkData.length / chunk.channels;
            const last4: number[] = [];
            const first4: number[] = [];
            for (let i = lastN - 4; i < lastN; i++) {
              last4.push(lastChunkData[i * chunk.channels]);
            }
            for (let i = 0; i < 4; i++) {
              first4.push(chunk.data[i * chunk.channels]);
            }
            console.log(
              `[sc:scope-test] continuity tick=${chunk.tickIndex} ch=${chunk.channels} ` +
                `last4=[${last4.map((v) => v.toFixed(3)).join(', ')}] ` +
                `first4=[${first4.map((v) => v.toFixed(3)).join(', ')}]`,
            );
            if (count <= 2 && chunk.channels === 2) {
              // Spot-check interleave order on the first stereo chunk
              // (Phase 10 acceptance #3): expect [L0, R0, L1, R1, …].
              const slice = Array.from(chunk.data.slice(0, 6));
              console.log(
                `[sc:scope-test] interleave (L0,R0,L1,R1,L2,R2) = ` +
                  `[${slice.map((v) => v.toFixed(3)).join(', ')}]`,
              );
            }
            nextContinuityLogAt = now + 1000;
          }
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
        `[sc:scope-test] subscribed scopeId=${scopeId} bufnum=${res.bufnum} channels=${ch}`,
      );
    });
  }, [client, res.bufnum, res.scopeChannels, guard]);

  const onPoke = useCallback(() => {
    void guard(async () => {
      if (res.bufnum === null || res.scopeChannels === null) {
        throw new Error('no buffer allocated');
      }
      const t0 = performance.now();
      const samples = await poker.poke(
        res.bufnum,
        0,
        SCOPE_RING * res.scopeChannels,
      );
      const elapsedMs = performance.now() - t0;
      const s = summarize(samples);
      console.log(
        `[sc:scope-test] poke bufnum=${res.bufnum} ch=${res.scopeChannels} ` +
          `(${elapsedMs.toFixed(1)} ms) len=${s.length} ` +
          `min=${s.min.toFixed(4)} max=${s.max.toFixed(4)} rms=${s.rms.toFixed(4)} ` +
          `first8=[${s.first8.map((v) => v.toFixed(3)).join(', ')}]`,
      );
      setStats(s);
    });
  }, [poker, res.bufnum, res.scopeChannels, guard]);

  const onStopAll = useCallback(() => {
    void guard(async () => {
      if (unsubscribeRef.current !== null) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        lastChunkRef.current = null;
        renderChunkRef.current = null;
        setSubStats(null);
      }
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
        toneChannels: null,
        scopeNodeId: null,
        scopeChannels: null,
        bufnum: null,
        monitorNodeId: null,
      });
      setStats(null);
    });
  }, [client, res, guard]);

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
        <label className="status">
          channels&nbsp;
          <select
            value={channels}
            disabled={busy || channelsLocked}
            onChange={(e) => setChannels(Number(e.target.value) as Channels)}
            title={
              channelsLocked
                ? 'Stop all to change channel count'
                : 'Number of channels for the next tone + scope'
            }
          >
            <option value={1}>1 (mono)</option>
            <option value={2}>2 (stereo)</option>
          </select>
        </label>
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
          disabled={busy || !hasTone || res.toneChannels !== 1}
          title={
            res.toneChannels === 2
              ? 'Mono monitor only — stereo monitoring not yet implemented'
              : `Toggle hardware-out monitor on bus ${HARDWARE_OUT_BUS}`
          }
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
          ? `tone ${res.toneChannels}ch on bus ${res.toneBus}${
              res.toneChannels === 2 ? `..${(res.toneBus ?? 0) + 1}` : ''
            }`
          : 'tone idle'}
        {' · '}
        {hasScope
          ? `scope ${res.scopeChannels}ch → bufnum ${res.bufnum}`
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
          <ScopeView
            chunkRef={renderChunkRef}
            effectiveRate={clock.derived.scopeEffectiveRate}
            samplesPerChunk={DEFAULT_PARAMS.scopeChunkSize}
            gain={gain}
            defaultLayout="stacked"
          />
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
