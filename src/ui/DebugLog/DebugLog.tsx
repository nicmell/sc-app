import { useEffect, useRef, useState } from 'react';
import { clearDebugLog, debugLog, type DebugEntry } from '@/util/debugLog';
import { IS_TAURI } from '@/util/runtime';
import './DebugLog.scss';

function formatEntries(entries: ReadonlyArray<DebugEntry>): string {
  const lines = entries.map(
    (e) =>
      `${(e.timestamp / 1000).toFixed(3).padStart(10)}  ${e.level.padEnd(5)}  ${e.text}`,
  );
  return lines.join('\n') + '\n';
}

/** `sc-debug-YYYYMMDD-HHmmss.txt` — sortable, easy to grep. */
function buildFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `sc-debug-${stamp}.txt`;
}

/**
 * In serve / browser mode we let the browser navigate to the
 * `<a href download>` element — the blob URL plus the `download`
 * attribute trigger the standard download dialog.
 *
 * In native (Tauri) mode we open a save-as dialog defaulted to the
 * platform Documents directory and write the text via the `fs`
 * plugin. This gets us the OS-native picker (with sidebar shortcuts,
 * recent locations, etc.) instead of a browser-y "downloads"
 * detour.
 */
async function downloadEntries(entries: ReadonlyArray<DebugEntry>): Promise<void> {
  if (entries.length === 0) return;
  const text = formatEntries(entries);
  const filename = buildFilename();

  if (IS_TAURI) {
    try {
      const { documentDir, join } = await import('@tauri-apps/api/path');
      const defaultPath = await join(await documentDir(), filename);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const dest = await save({
        defaultPath,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      });
      if (!dest) return; // user cancelled
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(dest, text);
    } catch (err) {
      console.error('[sc:debugLog] tauri save failed', err);
    }
    return;
  }

  // Browser fallback — `<a href download>` over a blob URL.
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DebugLog() {
  const [entries, setEntries] = useState<DebugEntry[]>(debugLog.get());
  const [open, setOpen] = useState(false);
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
          onClick={() => {
            void downloadEntries(entries);
          }}
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
