// Type shims for @strudel/* packages, which ship JS-only bundles
// without TypeScript declaration files.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module '@strudel/codemirror' {
  export class StrudelMirror {
    constructor(opts: {
      root: HTMLElement;
      id?: string;
      initialCode?: string;
      defaultOutput?: (...args: any[]) => unknown;
      getTime?: () => number;
      transpiler?: (code: string) => { output: string };
      prebake?: () => Promise<void>;
      bgFill?: boolean;
      solo?: boolean;
      onToggle?: (started: boolean) => void;
      onEvalError?: (err: Error) => void;
      afterEval?: (result: unknown) => void;
      [key: string]: unknown;
    });
    evaluate(start?: boolean): Promise<void>;
    stop(): Promise<void>;
    clear(): void;
    toggle(): Promise<void>;
    code: string;
    /** Inner repl (from @strudel/web's `repl()`). Exposes setCps,
     *  setPattern, scheduler, etc. Used by the BPM input. */
    repl: {
      setCps: (cps: number) => unknown;
      scheduler: {
        started: boolean;
        cps: number;
        setCps: (cps: number) => unknown;
      };
      [key: string]: unknown;
    };
  }
}

declare module '@strudel/transpiler' {
  export function transpiler(code: string): { output: string };
}

declare module '@strudel/web' {
  export function repl(opts: {
    defaultOutput?: (...args: any[]) => unknown;
    getTime?: () => number;
    transpiler?: (code: string) => { output: string };
    onEvalError?: (err: Error) => void;
    onToggle?: (started: boolean) => void;
    [key: string]: unknown;
  }): {
    evaluate(code: string, start?: boolean): Promise<void>;
    start(): void;
    stop(): void;
    scheduler: { started: boolean; now(): number };
  };
  /** Sets up Strudel's globals (`s`, `note`, `stack`, mini-notation,
   *  etc.) on `globalThis` via `evalScope`, so user code in the REPL
   *  can reference them. Also creates an idle WebAudio repl assigned
   *  to a module-level singleton — harmless when we use our own
   *  StrudelMirror with a custom defaultOutput. */
  export function initStrudel(opts?: Record<string, unknown>): Promise<unknown>;
}
