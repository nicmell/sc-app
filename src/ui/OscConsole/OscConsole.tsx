import { useEffect, useRef, useState } from 'react';
import type { WorkerClient } from '@/scope/WorkerClient';
import type { ServerMessage, ServerReply } from '@/scope/workerProtocol';
import * as cmd from '@/scope/cmd';
import './OscConsole.scss';

interface LogEntry {
  id: number;
  direction: 'tx' | 'rx' | 'err';
  timestamp: number;
  summary: string;
  detail?: string;
}

interface OscConsoleProps {
  client: WorkerClient;
}

function summariseCommand(msg: ServerMessage): string {
  const val = 'val' in msg ? (msg as { val: unknown }).val : undefined;
  return val === undefined ? msg.tag : `${msg.tag} ${JSON.stringify(val)}`;
}

function summariseReply(reply: ServerReply): { summary: string; detail?: string } {
  switch (reply.tag) {
    case 'status-reply': {
      const s = reply.val;
      return {
        summary: `status-reply ugens=${s.numUgens} synths=${s.numSynths} groups=${s.numGroups}`,
        detail: `avg-cpu=${s.avgCpu.toFixed(2)}% peak=${s.peakCpu.toFixed(2)}% sr=${s.actualSampleRate.toFixed(0)}`,
      };
    }
    case 'synced':
      return { summary: `synced id=${reply.val.syncId}` };
    case 'done':
      return {
        summary: `done ${reply.val.address}`,
        detail: reply.val.extras.length ? JSON.stringify(reply.val.extras) : undefined,
      };
    case 'fail':
      return { summary: `fail ${reply.val.address}: ${reply.val.error}` };
    case 'tr':
      return {
        summary: `tr node=${reply.val.nodeId} id=${reply.val.triggerId} v=${reply.val.value.toFixed(3)}`,
      };
    case 'b-setn':
      return {
        summary: `b-setn bufnum=${reply.val.bufnum} start=${reply.val.start} n=${reply.val.samples.length}`,
      };
    case 'n-go':
    case 'n-end':
    case 'n-on':
    case 'n-off':
    case 'n-move':
    case 'n-info': {
      const n = reply.val;
      return { summary: `${reply.tag} node=${n.nodeId} parent=${n.parentId} group=${n.isGroup}` };
    }
    case 'late':
      return { summary: `late ${reply.val.lateSecs}.${reply.val.lateFracs}` };
    case 'other':
      return {
        summary: `other ${reply.val.address}`,
        detail: reply.val.args.length ? JSON.stringify(reply.val.args) : undefined,
      };
  }
}

export function OscConsole({ client }: OscConsoleProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  const append = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLog((prev) =>
      [{ id: nextId.current++, timestamp: performance.now(), ...entry }, ...prev].slice(0, 100),
    );
  };

  useEffect(() => {
    const offReply = client.onReply((reply) => {
      const { summary, detail } = summariseReply(reply);
      append({ direction: 'rx', summary, detail });
    });
    const offErr = client.onError((message) => {
      append({ direction: 'err', summary: message });
    });
    return () => {
      offReply();
      offErr();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const send = (msg: ServerMessage) => {
    client.sendCommand(msg);
    append({ direction: 'tx', summary: summariseCommand(msg) });
  };

  const probe = async () => {
    append({ direction: 'tx', summary: 'status (sendAndAwaitReply)' });
    try {
      const t0 = performance.now();
      const reply = await client.sendAndAwaitReply(
        cmd.status,
        (r) => r.tag === 'status-reply',
        1000,
      );
      const elapsed = (performance.now() - t0).toFixed(1);
      const { summary, detail } = summariseReply(reply);
      append({ direction: 'rx', summary: `[${elapsed}ms] ${summary}`, detail });
    } catch (err) {
      append({ direction: 'err', summary: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <section className="osc-console">
      <header>OSC console</header>
      <div className="quick-actions">
        <button onClick={() => send(cmd.status)}>Status</button>
        <button onClick={() => send(cmd.dumpOsc(1))}>DumpOSC on</button>
        <button onClick={() => send(cmd.dumpOsc(0))}>DumpOSC off</button>
        <button onClick={() => send(cmd.queryTree(0))}>QueryTree(0)</button>
        <button onClick={probe}>sendAndAwaitReply(Status)</button>
      </div>
      <ol className="log">
        {log.map((e) => (
          <li key={e.id} data-dir={e.direction}>
            <span className="dir">{e.direction.toUpperCase()}</span>
            <span className="t">{(e.timestamp / 1000).toFixed(3)}s</span>
            <span className="summary">{e.summary}</span>
            {e.detail && <span className="detail">{e.detail}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
