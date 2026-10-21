import { type AcquisitionTracking, type AcquisitionTrackingConfig, captureAcquisitionTracking, clearAcquisitionTracking, configureAcquisitionTracking, createMemoryStorage, type StorageLike, type TrackingCaptureOptions } from '@moreflow/tracking';
import type { ChatbotLeadConsentAnswer } from './consent';
import type { ChatbotMessageRating, ChatbotMessagesPage, ChatbotPublicConfig, ChatbotPublicConfigResponse, ChatbotSendResult } from './public-types';
export { normalizeChatbotConfig, normalizeChatbotPublicConfig } from './config';
export type { ChatbotErrorDescription, DescribeChatbotErrorOptions } from './error-messages';
export { describeChatbotError } from './error-messages';
export * from './public-types';
export { createChatbotSession } from './session';
export * from './session-types';
import { type AcquisitionTrackingSetting } from './internal/acquisition-tracking';
import { type BaseUrlOptions } from './internal/http';
import { type ChatbotStreamEvent } from './stream';
export * from './consent';
export type { ChatbotErrorCode, MoreflowClientErrorCode, MoreflowErrorRecovery } from './errors';
export { chatbotStreamErrorCodes, isRetryableChatbotError, MoreflowChatbotError } from './errors';
export { isMoreflowError } from './internal/errors';
export type { ChatbotIdentity } from './identity';
export { chatbotThreadStorageKey, chatbotVisitorStorageKey, createChatbotIdentity, createChatbotRandomId } from './identity';
export type { ChatbotStreamEvent } from './stream';
export type { AcquisitionTrackingConfig, AcquisitionTrackingSetting, StorageLike };
export { captureAcquisitionTracking, clearAcquisitionTracking, configureAcquisitionTracking, createMemoryStorage };
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
    /** Reuse this id when retrying the same logical message. */
    clientMessageId?: string | undefined;
    metadata?: ChatbotConversationMetadata | undefined;
    collectedData?: Record<string, unknown> | Array<Record<string, unknown>> | undefined;
    attachments?: Array<Record<string, unknown>> | undefined;
    modelOverride?: string | undefined;
    /** The visitor's answers to `config.chatbot.leadConsent`; required purposes must be granted. */
    consent?: ChatbotLeadConsentAnswer[] | undefined;
};
export interface ChatbotRequestOptions {
    /** Cancels the request; a stream stops and its response body is released. */
    signal?: AbortSignal | undefined;
}
export interface ChatbotOperationTransport {
    call<T = unknown>(operationId: ChatbotOperationId, input: Record<string, unknown>, options?: ChatbotRequestOptions | undefined): Promise<T>;
    getPublic(chatbotId: string, options?: ChatbotRequestOptions): Promise<ChatbotPublicConfigResponse>;
    listMessages(input: {
        chatbotId: string;
        visitorId: string;
        threadId: string;
        cursor?: string | undefined;
        limit?: number | undefined;
    }, options?: ChatbotRequestOptions): Promise<ChatbotMessagesPage>;
    sendMessage(input: ChatbotSendMessageInput, options?: ChatbotRequestOptions | undefined): Promise<ChatbotSendResult>;
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
    streamMessage(input: ChatbotSendMessageInput, options?: ChatbotRequestOptions | undefined): AsyncIterable<ChatbotStreamEvent>;
}
export interface CreateChatbotOperationTransportOptions extends BaseUrlOptions {
    fetchImpl?: typeof fetch | undefined;
    /**
     * @deprecated Ignored. The API checks the chatbot's allowed domains against the
     * request's `Origin` (or `Referer`) header, which the browser sets; a value in
     * the body was always overwritten.
     */
    origin?: string | undefined;
}
export declare function createChatbotOperationTransport(options?: CreateChatbotOperationTransportOptions): ChatbotOperationTransport;
export interface ChatbotClient {
    readonly chatbotId: string;
    /** Stored on the first send; changes after `forgetVisitor()`. */
    readonly visitorId: string;
    getThreadId(): string | null;
    getConfig(options?: ChatbotRequestOptions): Promise<ChatbotPublicConfigResponse>;
    loadConfig(options?: ChatbotRequestOptions): Promise<ChatbotPublicConfig>;
    listMessages(options?: {
        threadId?: string | undefined;
        cursor?: string | undefined;
        limit?: number | undefined;
    }, requestOptions?: ChatbotRequestOptions): Promise<ChatbotMessagesPage | null>;
    send(options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
        threadId?: string | undefined;
    }, requestOptions?: ChatbotRequestOptions | undefined): Promise<ChatbotSendResult>;
    /**
     * Yields events until `message.complete` or `message.error`. A stream that ends without
     * either throws a `STREAM_INCOMPLETE` error; an aborted `signal` throws `ABORTED`.
     */
    sendStream(options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
        threadId?: string | undefined;
    }, requestOptions?: ChatbotRequestOptions | undefined): AsyncIterable<ChatbotStreamEvent>;
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
    /**
     * Same as `clearThread()`: the next message starts a new thread. `clearThread()`,
     * `reset()` and `forgetVisitor()` abort sends still in flight (they reject with code
     * `ABORTED`), and a reply that arrives anyway never brings the old thread back.
     */
    reset(): void;
    /**
     * Removes the stored visitor and thread ids from storage and continues as a new
     * visitor, whose id is stored again only when it sends a message.
     */
    forgetVisitor(): void;
}
export interface CreateChatbotClientOptions extends CreateChatbotOperationTransportOptions {
    chatbotId: string;
    storage?: StorageLike | undefined;
    randomId?: (() => string) | undefined;
    /**
     * Attaches acquisition metadata (UTM parameters, ad click ids, Meta's `_fbp`/`_fbc`
     * cookies, referrer, page URL, device) to every send. Off by default because the
     * capture reads cookies and writes browser storage, which needs consent in the EU.
     */
    acquisitionTracking?: AcquisitionTrackingSetting | undefined;
    /** Capture options or a replacement callback; used only while `acquisitionTracking` is on.
     * Unset options follow `configureAcquisitionTracking()`. */
    trackingCapture?: ChatbotMetadataCaptureOptions | (() => ChatbotConversationMetadata | undefined) | undefined;
}
export declare function createChatbotClient(options: CreateChatbotClientOptions): ChatbotClient;
