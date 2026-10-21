export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** A non-blank string, trimmed; anything else is `undefined`. */
export declare function stringValue(value: unknown): string | undefined;
/**
 * A random id for visitor ids and idempotency keys: a v4 UUID from Web Crypto,
 * or a non-cryptographic `mf_` id in restricted contexts without it, so an
 * embed keeps working instead of failing.
 */
export declare function createRandomId(): string;
