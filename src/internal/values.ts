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
 * A random id for visitor ids and idempotency keys: a v4 UUID from Web Crypto,
 * or a non-cryptographic `mf_` id in restricted contexts without it, so an
 * embed keeps working instead of failing.
 */
export function createRandomId(): string {
  try {
    const cryptoApi = globalThis.crypto;
    const generated = cryptoApi?.randomUUID?.();
    if (generated) return generated;
    if (cryptoApi?.getRandomValues) {
      return uuidFromRandomBytes(cryptoApi.getRandomValues(new Uint8Array(16)));
    }
  } catch {
    // Fall through when Web Crypto is unavailable or access is restricted.
  }
  return `mf_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
