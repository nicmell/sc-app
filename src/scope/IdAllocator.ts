/**
 * Monotonic integer allocator. One instance per namespace (node, buffer,
 * bus). Not thread-safe, but the app is single-threaded per worker.
 *
 *     const nodes = new IdAllocator(1000);
 *     nodes.next();  // 1000
 *     nodes.next();  // 1001
 */
export class IdAllocator {
  private cursor: number;

  constructor(base: number) {
    this.cursor = base;
  }

  next(): number {
    return this.cursor++;
  }
}
