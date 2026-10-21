import { type MoreflowClientErrorCode, type MoreflowErrorInit, MoreflowSdkError } from './internal/errors';
export type { MoreflowClientErrorCode, MoreflowErrorRecovery } from './internal/errors';
/**
 * Codes a `MoreflowChatbotError` carries: the SDK's own codes and the codes the
 * public chatbot operations return. A newer server may send codes not listed here.
 */
export type ChatbotErrorCode = MoreflowClientErrorCode
/** The stream ended without a terminal event; retain clientMessageId when retrying. */
 | 'STREAM_INCOMPLETE'
/** Rating a message needs a thread id. */
 | 'THREAD_REQUIRED'
/** No active chatbot with this id, or the page's origin is not allowed. */
 | 'NOT_FOUND'
/** The thread belongs to another visitor. */
 | 'FORBIDDEN' | 'AUTH_ERROR'
/** A required consent purpose is not granted; `details.required` lists the requests. */
 | 'CHATBOT_CONSENT_REQUIRED'
/** The consent text changed since the config was loaded; `details` is the current request. */
 | 'CHATBOT_CONSENT_WORDING_CHANGED'
/** The answer names a purpose the chatbot does not ask for. */
 | 'CHATBOT_CONSENT_NOT_REQUESTED'
/** The reply broke the chatbot's answer policy. */
 | 'POLICY_VALIDATION_FAILED'
/** Too many requests; retryable. */
 | 'RATE_LIMIT'
/** Another request with this clientMessageId is running; retry after the indicated delay. */
 | 'IDEMPOTENCY_IN_PROGRESS'
/** This clientMessageId belongs to different content; inspect history before creating a new message. */
 | 'IDEMPOTENCY_CONFLICT'
/** A prior send's outcome cannot be confirmed; inspect history before sending again. */
 | 'INVALID_STATE' | 'INTERNAL_ERROR';
/** The error every `@moreflow/chatbots` helper throws. */
export declare class MoreflowChatbotError extends MoreflowSdkError<ChatbotErrorCode> {
    /** The server's retry delay, from Retry-After or structured operation details. */
    readonly retryAfterSeconds: number | undefined;
    constructor(init: MoreflowErrorInit & {
        retryAfter?: string | undefined;
    });
}
/** Codes the SDK itself raises for a send that was cancelled or whose stream was cut off. */
export declare const chatbotStreamErrorCodes: {
    readonly aborted: 'ABORTED';
    readonly incomplete: 'STREAM_INCOMPLETE';
};
/** The caller's AbortSignal fired; the request or stream was cancelled on purpose. */
export declare function abortedError(signal: AbortSignal): MoreflowChatbotError;
/**
 * The stream ended without `message.complete` or `message.error`. The server may already have
 * stored the visitor's message. It is safe to retry only with the original clientMessageId.
 */
export declare function streamIncompleteError(cause?: unknown): MoreflowChatbotError;
export declare function isRetryableChatbotError(error: unknown): boolean;
/** Builds the package error for a failed operation response or an operation failure envelope. */
export declare function operationError(options: {
    responseBody: unknown;
    status?: number | undefined;
    retryAfter?: string | undefined;
    cause?: unknown;
}): MoreflowChatbotError;
