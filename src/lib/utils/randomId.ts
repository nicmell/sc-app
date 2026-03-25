export function randomId(): string {
  return crypto.randomUUID();
}

export function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x9e3779b1);
    h2 = Math.imul(h2 ^ ch, 0x243f6a89);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x45d9f3b) ^ Math.imul(h2 ^ (h2 >>> 13), 0x9e3779b1);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x45d9f3b) ^ Math.imul(h1 ^ (h1 >>> 13), 0x243f6a89);
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0"));
}
