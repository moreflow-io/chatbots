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
import type { BaseUrlOptions } from './internal/http';
import { type PageExperimentAssignment } from './internal/page-experiments';
import type { ChatbotStreamEvent } from './stream';
import { chatbotOperationIds } from './operation-transport';
export { chatbotOperationIds, createChatbotOperationTransport, normalizeChatbotOperationPayload } from './operation-transport';
export { createChatbotChallengeSession, createChatbotChallengeTokenProvider, isChatbotChallengeError } from './challenge';
export type { ChatbotChallengeTokenProvider } from './challenge';
export * from './consent';
export type { ChatbotAdsConsentDecision, ChatbotAdsConsentMode } from './ads-consent';
export { chatbotAdsConsentMode, chatbotAdsConsentStorageKey, readChatbotAdsConsent, storeChatbotAdsConsent } from './ads-consent';
export type { ChatbotErrorCode, MoreflowClientErrorCode, MoreflowErrorRecovery } from './errors';
export { chatbotStreamErrorCodes, isRetryableChatbotError, MoreflowChatbotError } from './errors';
export { isMoreflowError } from './internal/errors';
export type { ChatbotIdentity } from './identity';
export { chatbotThreadStorageKey, chatbotVisitorStorageKey, createChatbotIdentity, createChatbotRandomId } from './identity';
export type { ChatbotStreamEvent } from './stream';
export type { AcquisitionTrackingConfig, AcquisitionTrackingSetting, StorageLike };
export { captureAcquisitionTracking, clearAcquisitionTracking, configureAcquisitionTracking, createMemoryStorage };
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
    readonly utmCampaignId: 'utm_campaignid';
    readonly gadCampaignId: 'gad_campaignid';
    readonly gclid: 'gclid';
    readonly gbraid: 'gbraid';
    readonly wbraid: 'wbraid';
    readonly ttclid: 'ttclid';
    readonly ttp: 'ttp';
    readonly oppref: 'oppref';
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
    /**
     * The visitor's advertising consent. The conversation keeps the latest value a message sent, and
     * while it is `false` the lead is reported to neither Meta, TikTok nor ChatGPT Ads. Set it with the
     * client's `adsConsent` option rather than here.
     */
    adsConsent?: boolean | undefined;
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
    /**
     * The experiment variants the visitor saw. Unset, the page's assignments from the tracker's memory
     * are sent (never stored by the SDK); `[]` sends none. Moreflow stores them with a lead this message
     * creates only while the account allows it.
     */
    experimentVariants?: PageExperimentAssignment[] | undefined;
};
export interface ChatbotRequestOptions {
    /** Cancels the request; a stream stops and its response body is released. */
    signal?: AbortSignal | undefined;
}
export interface ChatbotOperationTransport {
    call<T = unknown>(operationId: ChatbotOperationId, input: Record<string, unknown>, options?: ChatbotRequestOptions | undefined): Promise<T>;
    getPublic(chatbotId: string, options?: ChatbotRequestOptions, visitorKey?: string | undefined): Promise<ChatbotPublicConfigResponse>;
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
    /** Called after enforcement is discovered, for every challenged attempt. Return a fresh chatbot_message token. */
    getChallengeToken?: import('./challenge').ChatbotChallengeTokenProvider | undefined;
    /** Accessible title for the browser challenge iframe. */
    challengeTitle?: string | undefined;
    /** Owned API origin for the challenge when messages use a same-origin/custom proxy. */
    challengeBaseUrl?: string | undefined;
    /**
     * @deprecated Ignored. The API checks the chatbot's allowed domains against the
     * request's `Origin` (or `Referer`) header, which the browser sets; a value in
     * the body was always overwritten.
     */
    origin?: string | undefined;
}
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
     * The visitor's tracking consent. Without consent (the default) every send
     * carries only the UTM parameters and ad click ids of the current page URL,
     * with no cookie or storage access. Pass `true`, or a function that returns
     * `true` once the visitor agreed in your consent banner, to also attach ad
     * cookies (`_fbp`, `_fbc`, `_ttp`), referrer, page URL and device, kept in
     * browser storage.
     */
    acquisitionTracking?: AcquisitionTrackingSetting | undefined;
    /** Capture options or a replacement callback; used only with tracking consent.
     * Unset options follow `configureAcquisitionTracking()`. Without consent only
     * `location` is read from the options. */
    trackingCapture?: ChatbotMetadataCaptureOptions | (() => ChatbotConversationMetadata | undefined) | undefined;
    /**
     * The visitor's advertising consent, for a chatbot whose config has `settings.adsTracking`. When
     * set, every send carries it as `metadata.adsConsent`: `true`, or a function returning `true` once
     * the visitor agreed, lets Moreflow report the conversation's lead to Meta, TikTok and ChatGPT Ads;
     * `false` (or a function returning anything else) keeps it from them. Unset sends no consent signal
     * and the lead is reported as before. A function is asked on every send.
     */
    adsConsent?: AcquisitionTrackingSetting | undefined;
}
export declare function createChatbotClient(options: CreateChatbotClientOptions): ChatbotClient;
