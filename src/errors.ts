export class MoreflowChatbotError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly retryable: boolean;
  readonly responseBody: unknown;
  readonly details: unknown;

  constructor(options: {
    message: string;
    status?: number | undefined;
    code?: string | undefined;
    retryable?: boolean | undefined;
    responseBody?: unknown;
    details?: unknown;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'MoreflowChatbotError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.responseBody = options.responseBody;
    this.details = options.details;
  }
}

function retryableStatus(status: number | undefined): boolean {
  return (
    status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500)
  );
}

export function isRetryableChatbotError(error: unknown): boolean {
  return error instanceof MoreflowChatbotError && error.retryable;
}

function errorRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function errorText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function errorFields(payload: unknown): {
  code?: string | undefined;
  message?: string | undefined;
  details?: unknown;
} {
  const record = errorRecord(payload);
  const error = errorRecord(record?.error) ?? record;
  return {
    ...(errorText(error?.code) ? { code: errorText(error?.code) } : {}),
    ...(errorText(error?.message) ? { message: errorText(error?.message) } : {}),
    ...(error?.details !== undefined ? { details: error.details } : {})
  };
}

/** Builds the package error for a failed operation response or an operation failure envelope. */
export function operationError(options: {
  responseBody: unknown;
  status?: number | undefined;
  cause?: unknown;
}): MoreflowChatbotError {
  const fields = errorFields(options.responseBody);
  return new MoreflowChatbotError({
    message:
      fields.message ??
      (options.status
        ? `Operation request failed with status ${options.status}.`
        : 'Operation request failed.'),
    ...(options.status !== undefined ? { status: options.status } : {}),
    ...(fields.code ? { code: fields.code } : {}),
    retryable: retryableStatus(options.status),
    responseBody: options.responseBody,
    ...(fields.details !== undefined ? { details: fields.details } : {}),
    ...(options.cause !== undefined ? { cause: options.cause } : {})
  });
}
