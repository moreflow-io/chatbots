// Generated from packages/sdk-internal/src/values.ts by `bun run sync:sdk-internal`; edit that file instead.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A non-blank string, trimmed; anything else is `undefined`. */
export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function uuidFromRandomBytes(bytes: Uint8Array): string {
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/**
 * A random id for visitor ids and idempotency keys: a v4 UUID from Web Crypto.
 * Fails closed when Web Crypto is unavailable: a visitor id is the read credential
 * for its conversation, so it must never come from a non-cryptographic source.
 */
export function createRandomId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID();
    } catch {
      // randomUUID can be restricted while getRandomValues still works; fall through.
    }
  }
  if (typeof cryptoApi?.getRandomValues === 'function') {
    return uuidFromRandomBytes(cryptoApi.getRandomValues(new Uint8Array(16)));
  }
  throw new Error('Web Crypto is unavailable, so a secure random id cannot be generated.');
}
