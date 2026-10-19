/**
 * Lead consent for public chatbots. The public config lists the purposes the chatbot asks for
 * with the account's own text; a client shows that text verbatim and sends the visitor's decision
 * with a message. A required purpose must be granted before the chatbot accepts messages, and each
 * new thread is a new conversation that needs its own consent.
 */
export declare const chatbotLeadConsentPurposes: readonly ['marketing_email', 'email_tracking'];
export type ChatbotLeadConsentPurpose = (typeof chatbotLeadConsentPurposes)[number];
/** One purpose the chatbot asks the visitor about. */
export interface ChatbotLeadConsentRequest {
    purpose: ChatbotLeadConsentPurpose;
    /** The account-authored text. Show it verbatim; Moreflow does not author consent wording. */
    text: string;
    /** Identifies the text the visitor saw; send it back with the answer. */
    wordingVersion: string;
    /** When true, the chatbot refuses messages until the visitor grants this purpose. */
    required: boolean;
}
/** The visitor's decision for one requested purpose, sent with `send({ message, consent })`. */
export interface ChatbotLeadConsentAnswer {
    purpose: ChatbotLeadConsentPurpose;
    granted: boolean;
    wordingVersion: string;
}
export declare const chatbotConsentErrorCodes: {
    /** A required purpose is not granted; `details.required` lists the requests to show. */
    readonly required: 'CHATBOT_CONSENT_REQUIRED';
    /** The account changed the text since the config was loaded; `details` is the current request. */
    readonly wordingChanged: 'CHATBOT_CONSENT_WORDING_CHANGED';
    /** The answer names a purpose the chatbot does not ask for. */
    readonly notRequested: 'CHATBOT_CONSENT_NOT_REQUESTED';
};
/** Reads the requested purposes from the public config; malformed entries are dropped. */
export declare function normalizeChatbotLeadConsent(value: unknown): ChatbotLeadConsentRequest[];
/**
 * Builds the answers for a message from the visitor's decisions, keyed by purpose. Purposes
 * without a decision are left out, so the chatbot may still ask about them in the conversation.
 */
export declare function chatbotLeadConsentAnswers(requests: readonly ChatbotLeadConsentRequest[], decisions: Partial<Record<ChatbotLeadConsentPurpose, boolean>>): ChatbotLeadConsentAnswer[];
/** The required requests the answers do not grant: a client can block sending until this is empty. */
export declare function missingRequiredChatbotLeadConsent(requests: readonly ChatbotLeadConsentRequest[], answers?: readonly ChatbotLeadConsentAnswer[]): ChatbotLeadConsentRequest[];
/**
 * The consent requests a consent error asks the client to show: the required requests for
 * `CHATBOT_CONSENT_REQUIRED`, the current request for `CHATBOT_CONSENT_WORDING_CHANGED`, otherwise none.
 */
export declare function chatbotLeadConsentFromError(error: unknown): ChatbotLeadConsentRequest[];
