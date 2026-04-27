import { useEffect, useRef, useState } from 'react';
import type OSC from 'osc-js';
import {
  dumpOsc,
  queryTree,
  status,
  type OscPacket,
} from '@sc-app/server-commands';
import type { WorkerClient } from '@/scope/WorkerClient';
import type { OscReply } from '@/scope/workerProtocol';
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

function summariseCommand(packet: OscPacket): string {
  // `OscPacket` is `OSC.Message | OSC.Bundle`. Bundles land here when
  // we start shipping scheduled commands; handle both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = packet as any;
  if (Array.isArray(any.bundleElements)) {
    return `bundle(${any.bundleElements.length} packets)`;
  }
  const args = any.args as ReadonlyArray<unknown>;
  return args.length
    ? `${any.address} ${JSON.stringify(args)}`
    : String(any.address);
}

function summariseReply(reply: OscReply): { summary: string; detail?: string } {
  const args = reply.args;
  return {
    summary: args.length
      ? `${reply.address} ${JSON.stringify(args)}`
      : reply.address,
  };
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

  const send = (msg: OSC.Message) => {
    client.sendCommand(msg);
    append({ direction: 'tx', summary: summariseCommand(msg) });
  };

  const probe = async () => {
    append({ direction: 'tx', summary: 'status (sendAndAwaitReply)' });
    try {
      const t0 = performance.now();
      const reply = await client.sendAndAwaitReply(
        status(),
        (r) => r.address === '/status.reply',
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
    <section className="panel osc-console">
      <header>OSC console</header>
      <div className="quick-actions">
        <button onClick={() => send(status())}>Status</button>
        <button onClick={() => send(dumpOsc(1))}>DumpOSC on</button>
        <button onClick={() => send(dumpOsc(0))}>DumpOSC off</button>
        <button onClick={() => send(queryTree(0))}>QueryTree(0)</button>
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
