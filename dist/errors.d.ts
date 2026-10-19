export declare class MoreflowChatbotError extends Error {
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
    });
}
export declare function isRetryableChatbotError(error: unknown): boolean;
/** Builds the package error for a failed operation response or an operation failure envelope. */
export declare function operationError(options: {
    responseBody: unknown;
    status?: number | undefined;
    cause?: unknown;
}): MoreflowChatbotError;
