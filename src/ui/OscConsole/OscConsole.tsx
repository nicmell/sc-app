import { useEffect, useRef, useState } from 'react';
import type { WorkerClient } from '@/scope/WorkerClient';
import './OscConsole.scss';

interface LogEntry {
  id: number;
  direction: 'tx' | 'rx' | 'err';
  timestamp: number;
  length: number;
  hex: string;
  message?: string;
}

interface OscConsoleProps {
  client: WorkerClient;
}

function hexOf(bytes: Uint8Array, limit = 32): string {
  const n = Math.min(bytes.length, limit);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(bytes[i].toString(16).padStart(2, '0'));
  return parts.join(' ') + (bytes.length > limit ? ' …' : '');
}

function parseHexInput(text: string): Uint8Array | Error {
  const cleaned = text.replace(/[\s,]+/g, '');
  if (cleaned.length === 0) return new Error('empty input');
  if (cleaned.length % 2 !== 0) return new Error('odd number of hex digits');
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return new Error('invalid hex characters');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function OscConsole({ client }: OscConsoleProps) {
  const [input, setInput] = useState(
    // /status as hex — zero-arg OSC message
    '2f 73 74 61 74 75 73 00 2c 00 00 00',
  );
  const [log, setLog] = useState<LogEntry[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const offRecv = client.onRecv((bytes) => {
      setLog((prev) =>
        [
          {
            id: nextId.current++,
            direction: 'rx' as const,
            timestamp: performance.now(),
            length: bytes.length,
            hex: hexOf(bytes),
          },
          ...prev,
        ].slice(0, 100),
      );
    });
    const offErr = client.onError((message) => {
      setLog((prev) =>
        [
          {
            id: nextId.current++,
            direction: 'err' as const,
            timestamp: performance.now(),
            length: 0,
            hex: '',
            message,
          },
          ...prev,
        ].slice(0, 100),
      );
    });
    return () => {
      offRecv();
      offErr();
    };
  }, [client]);

  const handleSend = () => {
    const result = parseHexInput(input);
    if (result instanceof Error) {
      setInputError(result.message);
      return;
    }
    setInputError(null);
    client.send(result);
    setLog((prev) =>
      [
        {
          id: nextId.current++,
          direction: 'tx' as const,
          timestamp: performance.now(),
          length: result.length,
          hex: hexOf(result),
        },
        ...prev,
      ].slice(0, 100),
    );
  };

  return (
    <section className="osc-console">
      <header>OSC console</header>
      <div className="input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          rows={3}
          spellCheck={false}
          aria-label="OSC bytes, hex-encoded"
          placeholder="hex bytes, e.g. 2f 73 74 61 74 75 73 00 2c 00 00 00"
        />
        <button onClick={handleSend}>Send</button>
      </div>
      {inputError && <p className="input-error">{inputError}</p>}
      <ol className="log">
        {log.map((e) => (
          <li key={e.id} data-dir={e.direction}>
            <span className="dir">{e.direction.toUpperCase()}</span>
            <span className="t">{(e.timestamp / 1000).toFixed(3)}s</span>
            {e.direction === 'err' ? (
              <span className="msg">{e.message}</span>
            ) : (
              <>
                <span className="len">{e.length}B</span>
                <code className="hex">{e.hex}</code>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
