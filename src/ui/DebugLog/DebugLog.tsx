import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ServerErrorBus, ServerErrorEntry } from '@/server/ServerErrorBus';
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

interface DebugLogProps {
  /** Phase 24 — when present, an Errors section appears at the top
   *  of the panel listing decoded `/fail` replies. `null` between
   *  sessions (no connected dashboard yet, or after disconnect). */
  errorBus: ServerErrorBus | null;
}

export function DebugLog({ errorBus }: DebugLogProps) {
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

  // Subscribe to errorBus when present. useSyncExternalStore handles
  // the no-bus case via the noopStore fallback below.
  const errors = useSyncExternalStore(
    errorBus ? (cb) => errorBus.entries.subscribe(cb) : noopSubscribe,
    errorBus ? () => errorBus.entries.get() : noopSnapshot,
  );

  return (
    <section className={`debug-log ${open ? 'open' : 'closed'}`}>
      <header>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'} debug log · {entries.length}
          {errors.length > 0 && (
            <span className="error-badge" aria-label={`${errors.length} errors`}>
              ⚠ {errors.length}
            </span>
          )}
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
        <>
          {errors.length > 0 && (
            <ErrorsSection errors={errors} onClear={() => errorBus?.clear()} />
          )}
          <div className="scroller" ref={scroller}>
            {entries.map((e) => (
              <div key={e.id} className="entry" data-level={e.level}>
                <span className="t">{(e.timestamp / 1000).toFixed(3)}</span>
                <span className="l">{e.level}</span>
                <span className="m">{e.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ErrorsSection({
  errors,
  onClear,
}: {
  errors: ReadonlyArray<ServerErrorEntry>;
  onClear: () => void;
}) {
  return (
    <div className="errors-section">
      <div className="errors-header">
        <span>scsynth /fail · {errors.length}</span>
        <button type="button" onClick={onClear} className="small">
          clear
        </button>
      </div>
      <ul>
        {errors.map((e) => (
          <li key={e.id}>
            <span className="cmd">{e.error.commandAddress || '/fail'}</span>
            <span className="msg">{e.error.errorString || '(no message)'}</span>
            {e.error.extras.length > 0 && (
              <span className="extras">{JSON.stringify(e.error.extras)}</span>
            )}
            <span className="age">{formatErrorAge(e.receivedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatErrorAge(receivedAt: number): string {
  const ms = Date.now() - receivedAt;
  if (ms < 1000) return 'just now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// Stable no-op store hooks for useSyncExternalStore when no bus is
// attached. Using literal closures would create a new function each
// render and force a re-subscribe loop.
const noopSubscribe = () => () => {};
const NOOP_EMPTY: ReadonlyArray<ServerErrorEntry> = [];
const noopSnapshot = () => NOOP_EMPTY;
