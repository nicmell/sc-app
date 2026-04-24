import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GroupController, GroupState } from '@/scope/GroupController';
import type { WorkerClient } from '@/scope/WorkerClient';
import type { ServerReply } from '@/scope/workerProtocol';
import { SILENT_TEST_TRIG_ID } from '@/synth/silentTestSynthDef';
import './ClockPanel.scss';

const HEARTBEAT_WINDOW_MS = 1000;
const HEARTBEAT_TICK_MS = 200;

interface ClockPanelProps {
  client: WorkerClient;
  group: GroupController;
}

/** Rolling count of `/tr` replies with the dev heartbeat trig id over the
 *  last `HEARTBEAT_WINDOW_MS`. Re-renders every `HEARTBEAT_TICK_MS`.
 */
function useHeartbeatHz(client: WorkerClient): number {
  const timestamps = useRef<number[]>([]);
  const [hz, setHz] = useState(0);

  useEffect(() => {
    const off = client.onReply((reply: ServerReply) => {
      if (reply.tag !== 'tr') return;
      if (reply.val.triggerId !== SILENT_TEST_TRIG_ID) return;
      timestamps.current.push(performance.now());
    });

    const timer = window.setInterval(() => {
      const now = performance.now();
      const cutoff = now - HEARTBEAT_WINDOW_MS;
      const kept = timestamps.current.filter((t) => t >= cutoff);
      timestamps.current = kept;
      setHz(kept.length);
    }, HEARTBEAT_TICK_MS);

    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [client]);

  return hz;
}

function pillFor(state: GroupState): { className: string; label: string } {
  switch (state) {
    case 'running':
      return { className: 'pill running', label: '● Running' };
    case 'paused':
      return { className: 'pill paused', label: '⏸ Paused' };
    case 'stopped':
      return { className: 'pill stopped', label: '○ Stopped' };
  }
}

export function ClockPanel({ client, group }: ClockPanelProps) {
  const state = useSyncExternalStore(
    (cb) => group.state.subscribe(cb),
    () => group.state.get(),
  );
  const hz = useHeartbeatHz(client);
  const [busy, setBusy] = useState(false);

  const onToggle = useCallback(async () => {
    setBusy(true);
    try {
      if (state === 'running') await group.pause();
      else if (state === 'paused') await group.resume();
    } catch (err) {
      console.error('[sc:clock] toggle failed', err);
    } finally {
      setBusy(false);
    }
  }, [group, state]);

  const onQueryTree = useCallback(async () => {
    try {
      const reply = await group.queryTree();
      console.log('[sc:clock] queryTree →', reply);
    } catch (err) {
      console.error('[sc:clock] queryTree failed', err);
    }
  }, [group]);

  const pill = pillFor(state);
  const toggleLabel = state === 'paused' ? 'Resume' : 'Pause';

  return (
    <section className="clock-panel">
      <header>Clock</header>
      <div className="row">
        <span className={pill.className}>{pill.label}</span>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy || state === 'stopped'}
        >
          {toggleLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onQueryTree}
          disabled={state === 'stopped'}
        >
          QueryTree
        </button>
      </div>
      <div className="heartbeat">heartbeat: {hz} /s</div>
    </section>
  );
}
