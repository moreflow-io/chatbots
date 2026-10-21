import { type StorageLike } from '@moreflow/tracking';
/**
 * Generates the visitor ids used by the public chatbot SDK. Browsers with
 * `crypto.randomUUID` get a UUID; older or restricted contexts retain the
 * SDK's non-cryptographic fallback rather than failing chat initialization.
 */
export declare function createChatbotRandomId(): string;
export declare function chatbotVisitorStorageKey(chatbotId: string): string;
export declare function chatbotThreadStorageKey(chatbotId: string, visitorId: string): string;
export interface ChatbotIdentity {
    readonly chatbotId: string;
    /** A stored visitor id, or a new one that stays in memory until `persistVisitor()`. */
    readonly visitorId: string;
    /** Stores the visitor id; the client calls it when the visitor sends a first message. */
    persistVisitor(): void;
    /** Removes the stored visitor and thread ids and starts a new, unstored visitor. */
    forgetVisitor(): void;
    getThreadId(): string | null;
    setThreadId(threadId: string | null | undefined): void;
    clearThread(): void;
}
/**
 * Reads a returning visitor's id but writes nothing to storage until
 * `persistVisitor()`, so merely loading a page with the chatbot stores nothing.
 */
export declare function createChatbotIdentity(options: {
    chatbotId: string;
    storage?: StorageLike | undefined;
    randomId?: (() => string) | undefined;
}): ChatbotIdentity;
