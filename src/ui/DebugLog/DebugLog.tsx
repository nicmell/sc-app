import { useEffect, useRef, useState } from 'react';
import { clearDebugLog, debugLog, type DebugEntry } from '@/scope/debugLog';
import './DebugLog.scss';

function formatEntries(entries: ReadonlyArray<DebugEntry>): string {
  const lines = entries.map(
    (e) =>
      `${(e.timestamp / 1000).toFixed(3).padStart(10)}  ${e.level.padEnd(5)}  ${e.text}`,
  );
  return lines.join('\n') + '\n';
}

function downloadEntries(entries: ReadonlyArray<DebugEntry>): void {
  if (entries.length === 0) return;
  const blob = new Blob([formatEntries(entries)], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  // Filename: sc-debug-YYYYMMDD-HHmmss.txt — sortable, easy to grep.
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `sc-debug-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DebugLog() {
  const [entries, setEntries] = useState<DebugEntry[]>(debugLog.get());
  const [open, setOpen] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return debugLog.subscribe(setEntries);
  }, []);

  useEffect(() => {
    if (open && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [entries, open]);

  return (
    <section className={`debug-log ${open ? 'open' : 'closed'}`}>
      <header>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'} debug log · {entries.length}
        </button>
        <button
          type="button"
          onClick={() => downloadEntries(entries)}
          disabled={entries.length === 0}
          title="Download the buffered log entries as a text file"
        >
          download
        </button>
        <button type="button" onClick={clearDebugLog}>
          clear
        </button>
      </header>
      {open && (
        <div className="scroller" ref={scroller}>
          {entries.map((e) => (
            <div key={e.id} className="entry" data-level={e.level}>
              <span className="t">{(e.timestamp / 1000).toFixed(3)}</span>
              <span className="l">{e.level}</span>
              <span className="m">{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
