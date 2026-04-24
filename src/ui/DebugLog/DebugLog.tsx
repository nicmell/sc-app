import { useEffect, useRef, useState } from 'react';
import { clearDebugLog, debugLog, type DebugEntry } from '@/scope/debugLog';
import './DebugLog.scss';

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
