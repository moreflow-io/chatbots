export interface DescribeChatbotErrorOptions {
    /** Defaults to German. */
    locale?: 'de' | 'en' | undefined;
    /** German uses "Sie" by default, or "du" when informal. */
    formality?: 'formal' | 'informal' | undefined;
}
export interface ChatbotErrorDescription {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterSeconds: number | undefined;
    /** The original error, retained for logging. */
    cause: unknown;
}
/** Describes a caught failure safely for visitors while retaining the original error. */
export declare function describeChatbotError(error: unknown, options?: DescribeChatbotErrorOptions): ChatbotErrorDescription;
