/**
 * Monotonic integer allocator. One instance per namespace (node, buffer,
 * bus). Not thread-safe, but the app is single-threaded per worker.
 *
 *     const nodes = new IdAllocator(1000);
 *     nodes.next();         // 1000
 *     nodes.next();         // 1001
 *     nodes.nextBlock(2);   // 1002 (and 1003 is reserved)
 *     nodes.next();         // 1004
 */
export class IdAllocator {
  private cursor: number;

  constructor(base: number) {
    this.cursor = base;
  }

  next(): number {
    return this.cursor++;
  }

  /** Reserve `n` contiguous IDs and return the first. Use for
   *  multi-channel buses where SC's `Out.ar(bus, [a, b, …])` writes
   *  to `bus`, `bus+1`, …, `bus+n-1` and we need to ensure those
   *  next IDs aren't handed out elsewhere. */
  nextBlock(n: number): number {
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`IdAllocator.nextBlock: n must be a positive integer, got ${n}`);
    }
    const start = this.cursor;
    this.cursor += n;
    return start;
  }
}
