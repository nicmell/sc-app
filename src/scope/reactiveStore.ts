/**
 * Tiny observable used throughout the app. No framework dependency —
 * plain callbacks with an unsubscribe function.
 *
 *     const s = createStore(0);
 *     const off = s.subscribe(v => console.log(v));
 *     s.set(1);      // logs 1
 *     off();
 */

export interface ReadonlyStore<T> {
  get(): T;
  subscribe(cb: (value: T) => void): () => void;
}

export interface Store<T> extends ReadonlyStore<T> {
  set(value: T): void;
  update(fn: (prev: T) => T): void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();

  return {
    get: () => value,
    set(next) {
      if (Object.is(value, next)) return;
      value = next;
      for (const cb of subs) cb(value);
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb) as unknown as void;
    },
  };
}
