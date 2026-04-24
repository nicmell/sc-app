import { useState } from 'react';
import type { SynthDefRegistry } from '@/scope/SynthDefRegistry';
import { compileNoopSynthDef } from '@/synth/noopSynthDef';
import './SynthDefPanel.scss';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface SynthDefPanelProps {
  registry: SynthDefRegistry;
}

export function SynthDefPanel({ registry }: SynthDefPanelProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setStatus('loading');
    setError(null);
    try {
      const t0 = performance.now();
      const bytes = compileNoopSynthDef();
      await registry.ensureLoaded('noop', bytes);
      const elapsed = (performance.now() - t0).toFixed(1);
      console.log(`[sc:synthdef] noop loaded in ${elapsed} ms`);
      setStatus('loaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[sc:synthdef] load failed', err);
      setError(message);
      setStatus('error');
    }
  };

  const label = (() => {
    switch (status) {
      case 'idle':
        return 'Load noop SynthDef';
      case 'loading':
        return 'Loading…';
      case 'loaded':
        return 'Loaded ✓';
      case 'error':
        return 'Retry';
    }
  })();

  return (
    <section className="synthdef-panel">
      <header>SynthDef</header>
      <button type="button" onClick={handleClick} disabled={status === 'loading'}>
        {label}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
