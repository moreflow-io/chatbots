// Generated from packages/sdk-internal/src/errors.ts by `bun run sync:sdk-internal`; edit that file instead.
import { isRecord, stringValue } from './values';

const moreflowErrorBrand = Symbol.for('moreflow.error');

/** Recognizes errors from any separately bundled Moreflow SDK in this runtime. */
export function isMoreflowError(error: unknown): error is MoreflowSdkError {
  return typeof error === 'object' && error !== null &&
    moreflowErrorBrand in error && error[moreflowErrorBrand] === true;
}

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

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function recoveryFrom(value: unknown): MoreflowErrorRecovery | undefined {
  if (!isRecord(value)) return undefined;
  const operation = stringValue(value.operation);
  if (!operation) return undefined;
  const args = recordValue(value.args);
  const requiredFields = Array.isArray(value.requiredFields)
    ? value.requiredFields.filter((field): field is string => typeof field === 'string')
    : undefined;
  return {
    operation,
    ...(args ? { args } : {}),
    ...(requiredFields ? { requiredFields } : {})
  };
}

function detailsFrom(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  return isRecord(value) ? value : { value };
}

/**
 * The error every Moreflow SDK throws. Branch on `code`, follow `recovery`
 * when present, and retry only when `retryable` is true.
 */
export class MoreflowSdkError<Known extends string = string> extends Error {
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

  constructor(init: MoreflowErrorInit) {
    super(init.message, { cause: init.cause });
    this.name = 'MoreflowSdkError';
    this.code = init.code ?? 'REQUEST_FAILED';
    this.status = init.status;
    this.retryable = init.retryable ?? false;
    this.recovery = recoveryFrom(init.recovery);
    this.details = detailsFrom(init.details);
    this.requestId = init.requestId;
    this.responseBody = init.responseBody;
  }
}

/** HTTP statuses that may succeed unchanged on a later attempt. */
export function retryableStatus(status: number | undefined): boolean {
  return (
    status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500)
  );
}

const transientCodes: ReadonlySet<string> = new Set(['NETWORK_ERROR', 'IDEMPOTENCY_IN_PROGRESS']);

/** The one retry rule of every Moreflow SDK. */
export function isRetryableFailure(input: {
  status?: number | undefined;
  code?: string | undefined;
  recoverability?: string | undefined;
}): boolean {
  return (
    retryableStatus(input.status) ||
    input.recoverability === 'retryable' ||
    (input.code !== undefined && transientCodes.has(input.code))
  );
}

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
export function serverErrorFields(body: unknown): ServerErrorFields {
  if (!isRecord(body)) return { details: {} };
  const source = recordValue(body.error) ?? body;
  const details = {
    ...recordValue(source.context),
    ...recordValue(source.details)
  };
  const recovery = recoveryFrom(source.recovery) ?? recoveryFrom(body.recovery);
  const requestId =
    stringValue(source.requestId) ?? stringValue(recordValue(body.trace)?.requestId);
  return {
    code: stringValue(source.code) ?? stringValue(body.code),
    message:
      stringValue(source.message) ?? stringValue(body.message) ?? stringValue(body.error),
    ...(recovery ? { recovery } : {}),
    details,
    ...(requestId ? { requestId } : {}),
    recoverability: stringValue(source.recoverability) ?? stringValue(body.recoverability)
  };
}

/** The error for a failed response or an operation failure envelope. */
export function operationErrorInit(input: {
  responseBody: unknown;
  status?: number | undefined;
  /** Used when the body has no message, e.g. `Moreflow form submission failed`. */
  fallbackMessage: string;
  cause?: unknown;
}): MoreflowErrorInit {
  const fields = serverErrorFields(input.responseBody);
  const code = fields.code ?? 'REQUEST_FAILED';
  return {
    message:
      fields.message ??
      (typeof input.responseBody === 'string' && input.responseBody.trim()
        ? input.responseBody.trim().slice(0, 240)
        : input.status !== undefined
          ? `${input.fallbackMessage} with HTTP ${input.status}.`
          : `${input.fallbackMessage}.`),
    code,
    ...(input.status !== undefined ? { status: input.status } : {}),
    retryable: isRetryableFailure({
      status: input.status,
      code,
      recoverability: fields.recoverability
    }),
    recovery: fields.recovery,
    details: fields.details,
    ...(fields.requestId ? { requestId: fields.requestId } : {}),
    responseBody: input.responseBody,
    ...(input.cause !== undefined ? { cause: input.cause } : {})
  };
}

/** No response was received. Retryable. */
export function networkErrorInit(message: string, cause: unknown): MoreflowErrorInit {
  return { message, code: 'NETWORK_ERROR', retryable: true, cause };
}

/** The caller cancelled the request. Not retryable. */
export function abortedErrorInit(message: string, signal: AbortSignal): MoreflowErrorInit {
  return { message, code: 'ABORTED', retryable: false, cause: signal.reason };
}

/** A required argument is missing; `details.field` names it. */
export function validationErrorInit(field: string, message: string): MoreflowErrorInit {
  return { message, code: 'VALIDATION_ERROR', retryable: false, details: { field } };
}

/** The runtime has no fetch. */
export function fetchUnavailableInit(sdkName: string): MoreflowErrorInit {
  return {
    message: `${sdkName} needs a fetch implementation; pass fetchImpl in this runtime.`,
    code: 'FETCH_UNAVAILABLE',
    retryable: false
  };
}
