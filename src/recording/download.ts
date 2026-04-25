/**
 * Browser ↔ Tauri-aware Blob download helper.
 *
 * In a serve / browser context we synthesise a `<a href download>`
 * over an object URL — this triggers the browser's standard download
 * dialog. In Tauri we open the OS-native save-as dialog (defaulted to
 * the platform Audio directory for WAVs, Documents for everything
 * else) and write the bytes via the `fs` plugin, which gets us
 * proper sidebar shortcuts, recent-locations, and predictable file
 * placement.
 *
 * The Tauri imports are dynamic so the serve build doesn't pull
 * `@tauri-apps/plugin-{dialog,fs}` into its bundle. The capability
 * config in `src-tauri/capabilities/default.json` permits writes
 * under `$DOCUMENT`, `$DOWNLOAD`, `$AUDIO`, `$DESKTOP`, `$HOME`.
 */

import { IS_TAURI } from '@/scope/runtime';

interface DownloadOptions {
  /** Filename + extension. Used as the suggested name in the save-as
   *  dialog and as the `<a download>` attribute. */
  filename: string;
  /** Tauri-only hint: 'audio' opens the dialog in `$AUDIO`,
   *  'document' (default) opens in `$DOCUMENT`. The browser path
   *  ignores this — the download lands in the user's Downloads
   *  folder regardless. */
  defaultLocation?: 'audio' | 'document';
  /** Tauri-only file-type filter, e.g. `[{ name: 'WAV', extensions:
   *  ['wav'] }]`. Browser path ignores this. */
  filters?: Array<{ name: string; extensions: string[] }>;
}

/** Download a `Blob` as `filename`. Resolves once the file has been
 *  written (Tauri) or the `<a>` click has been dispatched (browser).
 *  In Tauri the user can cancel the dialog — that resolves cleanly
 *  with no error and no file written. */
export async function downloadBlob(
  blob: Blob,
  opts: DownloadOptions,
): Promise<void> {
  if (IS_TAURI) {
    try {
      const { documentDir, audioDir, join } = await import(
        '@tauri-apps/api/path'
      );
      const baseDir =
        opts.defaultLocation === 'audio'
          ? await audioDir()
          : await documentDir();
      const defaultPath = await join(baseDir, opts.filename);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const dest = await save({
        defaultPath,
        filters: opts.filters,
      });
      if (!dest) return; // cancelled
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeFile(dest, bytes);
    } catch (err) {
      console.error('[sc:download] tauri save failed', err);
      throw err;
    }
    return;
  }

  // Browser fallback: object URL + synthetic anchor click.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to actually start the download
  // before the URL is freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
