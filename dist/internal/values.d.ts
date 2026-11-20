export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** A non-blank string, trimmed; anything else is `undefined`. */
export declare function stringValue(value: unknown): string | undefined;
/**
 * A random id for visitor ids and idempotency keys: a v4 UUID from Web Crypto.
 * Fails closed when Web Crypto is unavailable: a visitor id is the read credential
 * for its conversation, so it must never come from a non-cryptographic source.
 */
export declare function createRandomId(): string;
