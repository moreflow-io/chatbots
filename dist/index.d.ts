import { captureAcquisitionTracking, createMemoryStorage, type AcquisitionTracking, type StorageLike, type TrackingCaptureOptions } from '@moreflow/tracking';
import { type ChatbotLeadConsentAnswer, type ChatbotLeadConsentRequest } from './consent';
import { MoreflowChatbotError } from './errors';
export { captureAcquisitionTracking, createMemoryStorage };
export type { StorageLike };
export * from './consent';
export { isRetryableChatbotError, MoreflowChatbotError } from './errors';
export declare const chatbotOperationIds: {
    readonly getPublic: 'chatbots.embed.getPublic';
    readonly messagesList: 'chatbots.embed.messages.list';
    readonly messagesSend: 'chatbots.embed.messages.send';
    readonly messageRatingsList: 'chatbots.embed.messageRatings.list';
    readonly messageRatingsSet: 'chatbots.embed.messageRatings.set';
};
export type ChatbotOperationId = (typeof chatbotOperationIds)[keyof typeof chatbotOperationIds];
export type CanonicalChatbotRecord = Record<string, unknown>;
declare const chatbotAccountIdBrand: unique symbol;
declare const chatbotClientIdBrand: unique symbol;
export type ChatbotAccountId = string & {
    readonly [chatbotAccountIdBrand]: 'ChatbotAccountId';
};
export type ChatbotClientId = string & {
    readonly [chatbotClientIdBrand]: 'ChatbotClientId';
};
/** Brand externally supplied public API account ids at the package boundary. */
export declare function chatbotAccountId(value: string): ChatbotAccountId;
/** Brand externally supplied public API client ids at the package boundary. */
export declare function chatbotClientId(value: string): ChatbotClientId;
declare const chatbotAcquisitionFieldMap: {
    readonly pageUrl: 'page_url';
    readonly referrer: 'referrer';
    readonly userAgent: 'user_agent';
    readonly utmSource: 'utm_source';
    readonly utmMedium: 'utm_medium';
    readonly utmCampaign: 'utm_campaign';
    readonly utmTerm: 'utm_term';
    readonly utmContent: 'utm_content';
    readonly gclid: 'gclid';
    readonly gbraid: 'gbraid';
    readonly wbraid: 'wbraid';
    readonly ttclid: 'ttclid';
    readonly ttp: 'ttp';
    readonly fbclid: 'fbclid';
    readonly fbp: 'fbp';
    readonly fbc: 'fbc';
};
type ChatbotAcquisitionMetadata = {
    -readonly [ChatbotKey in keyof typeof chatbotAcquisitionFieldMap]?: AcquisitionTracking[(typeof chatbotAcquisitionFieldMap)[ChatbotKey]] | undefined;
};
export type ChatbotConversationMetadata = ChatbotAcquisitionMetadata & {
    deviceType?: 'mobile' | 'desktop' | 'tablet' | 'unknown' | undefined;
    trafficSource?: AcquisitionTracking['utm_source'] | undefined;
    screenWidth?: number | undefined;
    screenHeight?: number | undefined;
};
export interface ChatbotMetadataCaptureOptions extends TrackingCaptureOptions {
    viewportWidth?: number | undefined;
    screenWidth?: number | undefined;
    screenHeight?: number | undefined;
}
export type ChatbotPublicConfig = CanonicalChatbotRecord & {
    id: string;
    name: string;
    mode: string;
    accountId?: ChatbotAccountId | undefined;
    description?: string | undefined;
    settings: CanonicalChatbotRecord;
    embedSettings: CanonicalChatbotRecord;
    leadFields: CanonicalChatbotRecord[];
    funnelSettings: CanonicalChatbotRecord;
    supportSettings: CanonicalChatbotRecord;
    avatarStorageId?: string | undefined;
    /** The lead consent purposes the chatbot asks for; empty when it asks for none. */
    leadConsent: ChatbotLeadConsentRequest[];
};
export interface ChatbotPublicConfigResponse {
    chatbot: ChatbotPublicConfig;
    trace?: Record<string, unknown> | undefined;
}
export interface ChatbotMessage {
    id: string;
    role: string;
    text: string;
    status?: string | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    [key: string]: unknown;
}
export interface ChatbotMessagesPage {
    items: ChatbotMessage[];
    hasMore: boolean;
    nextCursor?: string | undefined;
    trace?: Record<string, unknown> | undefined;
}
export interface ChatbotMessageRating {
    chatbotId: string;
    threadId: string;
    messageId: string;
    visitorId: string;
    rating: 'up' | 'down' | null;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    [key: string]: unknown;
}
export interface ChatbotSendResult {
    threadId?: string | undefined;
    response?: string | undefined;
    assistantMessageId?: string | undefined;
    conversationId?: string | undefined;
    success?: boolean | undefined;
    clientCreated?: boolean | undefined;
    clientId?: ChatbotClientId | undefined;
    [key: string]: unknown;
}
/**
 * Generates the visitor ids used by the public chatbot SDK. Browsers with
 * `crypto.randomUUID` get a UUID; older or restricted contexts retain the
 * SDK's non-cryptographic fallback rather than failing chat initialization.
 */
export declare function createChatbotRandomId(): string;
export declare function chatbotVisitorStorageKey(chatbotId: string): string;
export declare function chatbotThreadStorageKey(chatbotId: string, visitorId: string): string;
export interface ChatbotIdentity {
    chatbotId: string;
    visitorId: string;
    getThreadId(): string | null;
    setThreadId(threadId: string | null | undefined): void;
    clearThread(): void;
}
export declare function createChatbotIdentity(options: {
    chatbotId: string;
    storage?: StorageLike | undefined;
    randomId?: (() => string) | undefined;
}): ChatbotIdentity;
/** Converts public API records to one camel-case representation with camel-case precedence. */
export declare function normalizeChatbotConfig(value: unknown): ChatbotPublicConfig;
export declare function normalizeChatbotPublicConfig(value: unknown): ChatbotPublicConfigResponse;
/**
 * Reuses @moreflow/tracking's persisted acquisition capture and maps its
 * snake-case fields to the existing camel-case chatbot operation metadata contract.
 */
export declare function captureChatbotMetadata(options?: ChatbotMetadataCaptureOptions): ChatbotConversationMetadata;
/** Normalizes both Moreflow operation envelopes and direct operation payloads. */
export declare function normalizeChatbotOperationPayload<T = unknown>(payload: unknown): T;
export type ChatbotSendMessageInput = {
    chatbotId: string;
    visitorId?: string | undefined;
    threadId?: string | undefined;
    message: string;
    metadata?: ChatbotConversationMetadata | undefined;
    collectedData?: Record<string, unknown> | Array<Record<string, unknown>> | undefined;
    clientId?: ChatbotClientId | undefined;
    attachments?: Array<Record<string, unknown>> | undefined;
    modelOverride?: string | undefined;
    /** The visitor's answers to `config.chatbot.leadConsent`; required purposes must be granted. */
    consent?: ChatbotLeadConsentAnswer[] | undefined;
};
export interface ChatbotOperationTransport {
    call<T = unknown>(operationId: ChatbotOperationId, input: Record<string, unknown>): Promise<T>;
    getPublic(chatbotId: string): Promise<ChatbotPublicConfigResponse>;
    listMessages(input: {
        chatbotId: string;
        visitorId: string;
        threadId: string;
        cursor?: string | undefined;
        limit?: number | undefined;
    }): Promise<ChatbotMessagesPage>;
    sendMessage(input: ChatbotSendMessageInput): Promise<ChatbotSendResult>;
    listMessageRatings(input: {
        chatbotId: string;
        visitorId: string;
        threadId: string;
    }): Promise<{
        ratings: ChatbotMessageRating[];
        trace?: Record<string, unknown> | undefined;
    }>;
    setMessageRating(input: {
        chatbotId: string;
        visitorId: string;
        threadId: string;
        messageId: string;
        rating: 'up' | 'down' | null;
    }): Promise<{
        rating: ChatbotMessageRating;
        trace?: Record<string, unknown> | undefined;
    }>;
    streamMessage(input: ChatbotSendMessageInput): AsyncIterable<ChatbotStreamEvent>;
}
export interface CreateChatbotOperationTransportOptions {
    apiBaseUrl?: string | undefined;
    fetchImpl?: typeof fetch | undefined;
    origin?: string | undefined;
}
export type ChatbotStreamEvent = {
    type: 'message.start';
    data: Record<string, unknown>;
} | {
    type: 'message.delta';
    delta: string;
    data: Record<string, unknown>;
} | {
    type: 'message.complete';
    result: ChatbotSendResult;
    data: Record<string, unknown>;
} | {
    type: 'message.error';
    error: MoreflowChatbotError;
    data: Record<string, unknown>;
};
export declare function createChatbotOperationTransport(options?: CreateChatbotOperationTransportOptions): ChatbotOperationTransport;
export interface ChatbotClient {
    readonly chatbotId: string;
    readonly visitorId: string;
    getThreadId(): string | null;
    getConfig(): Promise<ChatbotPublicConfigResponse>;
    listMessages(options?: {
        threadId?: string | undefined;
        cursor?: string | undefined;
        limit?: number | undefined;
    }): Promise<ChatbotMessagesPage | null>;
    send(options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
        threadId?: string | undefined;
    }): Promise<ChatbotSendResult>;
    sendStream(options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
        threadId?: string | undefined;
    }): AsyncIterable<ChatbotStreamEvent>;
    listMessageRatings(options?: {
        threadId?: string | undefined;
    }): Promise<{
        ratings: ChatbotMessageRating[];
        trace?: Record<string, unknown> | undefined;
    } | null>;
    setMessageRating(options: {
        messageId: string;
        rating: 'up' | 'down' | null;
        threadId?: string | undefined;
    }): Promise<{
        rating: ChatbotMessageRating;
        trace?: Record<string, unknown> | undefined;
    }>;
    clearThread(): void;
    reset(): void;
}
export interface CreateChatbotClientOptions extends CreateChatbotOperationTransportOptions {
    chatbotId: string;
    storage?: StorageLike | undefined;
    randomId?: (() => string) | undefined;
    metadataCapture?: (() => ChatbotConversationMetadata) | undefined;
}
export declare function createChatbotClient(options: CreateChatbotClientOptions): ChatbotClient;
