import {useEffect, useState} from 'react';
import {IS_TAURI} from '@/lib/env';

/** Wire-level shape of `ClockService::state()` — matches the
 *  `#[serde(tag = "kind", rename_all = "lowercase")]` on the Rust
 *  `ClockState` enum. */
export type ClockStateDto =
    | {kind: 'waiting'}
    | {kind: 'running'; samples: number}
    | {kind: 'silent'};

/** Poll the Rust-side `ClockService` ~2 Hz and expose the current state.
 *  Returns `null` when we're not in Tauri mode (serve mode has no
 *  equivalent endpoint yet) or when the command errors. */
export function useClockState(): ClockStateDto | null {
    const [state, setState] = useState<ClockStateDto | null>(null);

    useEffect(() => {
        if (!IS_TAURI) return;
        let cancelled = false;

        const poll = async () => {
            try {
                const {invoke} = await import('@tauri-apps/api/core');
                const s = await invoke<ClockStateDto>('clock_state');
                if (!cancelled) setState(s);
            } catch {
                if (!cancelled) setState(null);
            }
        };

        void poll();
        const id = setInterval(poll, 500);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    return state;
}
