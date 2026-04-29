/**
 * Parse a `host:port` connection string into typed components.
 *
 * Accepts:
 *   - `127.0.0.1:57120`
 *   - `dirt.local:57120`
 *   - `[::1]:57120`     (IPv6, brackets required to disambiguate from
 *                        the colons inside the address itself)
 *
 * Throws `DirtParseError` with a human-readable message on bad input;
 * `DirtPanel` catches and surfaces inline below the input field.
 */

export class DirtParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirtParseError';
  }
}

export interface HostPort {
  host: string;
  port: number;
}

export function parseHostPort(input: string): HostPort {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new DirtParseError('empty input');
  }

  let host: string;
  let portStr: string;

  if (trimmed.startsWith('[')) {
    // IPv6 form: [host]:port. The brackets are mandatory because
    // raw `::1:57120` is ambiguous (which colon separates host from
    // port?). Splitting on the last `:` outside the brackets does
    // the right thing.
    const closeIdx = trimmed.indexOf(']');
    if (closeIdx < 0) {
      throw new DirtParseError('IPv6 host missing closing `]`');
    }
    host = trimmed.slice(1, closeIdx);
    const tail = trimmed.slice(closeIdx + 1);
    if (!tail.startsWith(':')) {
      throw new DirtParseError('expected `:port` after IPv6 `[…]`');
    }
    portStr = tail.slice(1);
  } else {
    // host:port. host may not contain `:` (any `:` in the input
    // means IPv6 + brackets above; we don't accept ambiguous forms).
    const lastColon = trimmed.lastIndexOf(':');
    if (lastColon < 0) {
      throw new DirtParseError('missing `:port`');
    }
    host = trimmed.slice(0, lastColon);
    portStr = trimmed.slice(lastColon + 1);
    if (host.includes(':')) {
      throw new DirtParseError(
        'IPv6 host must be wrapped in brackets, e.g. `[::1]:57120`',
      );
    }
  }

  if (host.length === 0) {
    throw new DirtParseError('empty host');
  }

  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new DirtParseError(
      `invalid port ${JSON.stringify(portStr)} (must be an integer 1–65535)`,
    );
  }

  return { host, port };
}
