declare const moreflowErrorBrand: unique symbol;
/** Recognizes errors from any separately bundled Moreflow SDK in this runtime. */
export declare function isMoreflowError(error: unknown): error is MoreflowSdkError;
/** The operation that resolves the failure and the arguments to call it with. */
export interface MoreflowErrorRecovery {
    operation: string;
    args?: Record<string, unknown> | undefined;
    /** Input the caller still has to supply to the recovery operation. */
    requiredFields?: string[] | undefined;
}
/**
 * Codes every Moreflow SDK raises itself, without a server response that names one.
 * `ABORTED` means the caller's `AbortSignal` cancelled the request. Not retryable.
 */
export type MoreflowClientErrorCode = 'ABORTED'
/** No response arrived (offline, DNS, CORS). Retryable. */
 | 'NETWORK_ERROR'
/** The runtime has no `fetch`; pass `fetchImpl`. */
 | 'FETCH_UNAVAILABLE'
/** A required argument is missing or blank; `details.field` names it. */
 | 'VALIDATION_ERROR'
/** The server answered successfully with a body the SDK cannot read. */
 | 'INVALID_RESPONSE'
/** The server answered with an error that carries no code. */
 | 'REQUEST_FAILED';
/** A failure code: one of the package's known codes, or a newer server code. */
export type MoreflowErrorCode<Known extends string> = Known | (string & {});
export interface MoreflowErrorInit {
    message: string;
    /** Defaults to `REQUEST_FAILED`. */
    code?: string | undefined;
    status?: number | undefined;
    retryable?: boolean | undefined;
    /** Normalized to {@link MoreflowErrorRecovery}; anything else is dropped. */
    recovery?: unknown;
    /** Normalized to an object; a non-object value is kept as `{ value }`. */
    details?: unknown;
    requestId?: string | undefined;
    responseBody?: unknown;
    cause?: unknown;
}
export declare function recoveryFrom(value: unknown): MoreflowErrorRecovery | undefined;
/**
 * The error every Moreflow SDK throws. Branch on `code`, follow `recovery`
 * when present, and retry only when `retryable` is true.
 */
export declare class MoreflowSdkError<Known extends string = string> extends Error {
    readonly [moreflowErrorBrand] = true;
    readonly code: MoreflowErrorCode<Known>;
    /** The HTTP status, or `undefined` when no response was received. */
    readonly status: number | undefined;
    /** True when the same request may succeed unchanged on a later attempt. */
    readonly retryable: boolean;
    /** The operation the server suggests calling instead, with its arguments. */
    readonly recovery: MoreflowErrorRecovery | undefined;
    /** Structured context from the server (for example `missingFieldIds`); `{}` when none. */
    readonly details: Record<string, unknown>;
    /** The server's request id for support requests. */
    readonly requestId: string | undefined;
    /** The raw response body, unchanged. */
    readonly responseBody: unknown;
    constructor(init: MoreflowErrorInit);
}
/** HTTP statuses that may succeed unchanged on a later attempt. */
export declare function retryableStatus(status: number | undefined): boolean;
/** The one retry rule of every Moreflow SDK. */
export declare function isRetryableFailure(input: {
    status?: number | undefined;
    code?: string | undefined;
    recoverability?: string | undefined;
}): boolean;
export interface ServerErrorFields {
    code?: string | undefined;
    message?: string | undefined;
    recovery?: MoreflowErrorRecovery | undefined;
    details: Record<string, unknown>;
    requestId?: string | undefined;
    recoverability?: string | undefined;
}
/**
 * Reads every Moreflow error body: the public `{ error: { code, message,
 * recovery, details, requestId } }`, an operation failure
 * `{ success: false, error: { code, message, context } }`, and the flat
 * `{ code, message, error, details, recovery }` of route-level errors.
 * An operation's `context` is merged into `details`.
 */
export declare function serverErrorFields(body: unknown): ServerErrorFields;
/** The error for a failed response or an operation failure envelope. */
export declare function operationErrorInit(input: {
    responseBody: unknown;
    status?: number | undefined;
    /** Used when the body has no message, e.g. `Moreflow form submission failed`. */
    fallbackMessage: string;
    cause?: unknown;
}): MoreflowErrorInit;
/** No response was received. Retryable. */
export declare function networkErrorInit(message: string, cause: unknown): MoreflowErrorInit;
/** The caller cancelled the request. Not retryable. */
export declare function abortedErrorInit(message: string, signal: AbortSignal): MoreflowErrorInit;
/** A required argument is missing; `details.field` names it. */
export declare function validationErrorInit(field: string, message: string): MoreflowErrorInit;
/** The runtime has no fetch. */
export declare function fetchUnavailableInit(sdkName: string): MoreflowErrorInit;
export {};
