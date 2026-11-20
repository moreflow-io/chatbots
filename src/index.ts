import {
  type AcquisitionTracking,
  type AcquisitionTrackingConfig,
  captureAcquisitionTracking,
  clearAcquisitionTracking,
  configureAcquisitionTracking,
  createMemoryStorage,
  type StorageLike,
  type TrackingCaptureOptions
} from '@moreflow/tracking';
import type { ChatbotLeadConsentAnswer } from './consent';
import type { ChatbotMessageRating, ChatbotMessagesPage, ChatbotPublicConfig, ChatbotPublicConfigResponse, ChatbotSendResult } from './public-types';

export { normalizeChatbotConfig, normalizeChatbotPublicConfig } from './config';
export type { ChatbotErrorDescription, DescribeChatbotErrorOptions } from './error-messages';
export { describeChatbotError } from './error-messages';
export * from './public-types';
export { createChatbotSession } from './session';
export * from './session-types';

import { MoreflowChatbotError } from './errors';
import { createChatbotIdentity, createChatbotRandomId } from './identity';
import {
  type AcquisitionTrackingSetting,
  acquisitionTrackingConsented,
  captureUrlAcquisitionTracking
} from './internal/acquisition-tracking';
import { validationErrorInit } from './internal/errors';
import type { BaseUrlOptions } from './internal/http';
import { type PageExperimentAssignment, pageExperimentAssignments } from './internal/page-experiments';
import { pageVisitReference } from './internal/visit-reference';
import {
  chatbotExperimentFor,
  chatbotPageVisitorKey,
  experimentFromChatbotConfig,
  mergeChatbotExperimentVariants,
  rememberChatbotExperiment,
  trackChatbotExposure
} from './chatbot-experiments';
import { stringValue } from './internal/values';
import type { ChatbotStreamEvent } from './stream';
import { chatbotOperationIds, createChatbotOperationTransport } from './operation-transport';
export { chatbotOperationIds, createChatbotOperationTransport, normalizeChatbotOperationPayload } from './operation-transport';
export {
  createChatbotChallengeSession,
  createChatbotChallengeTokenProvider,
  isChatbotChallengeError
} from './challenge';
export type { ChatbotChallengeTokenProvider } from './challenge';

export * from './consent';
export type { ChatbotAdsConsentDecision, ChatbotAdsConsentMode } from './ads-consent';
export {
  chatbotAdsConsentMode,
  chatbotAdsConsentStorageKey,
  readChatbotAdsConsent,
  storeChatbotAdsConsent
} from './ads-consent';
export type { ChatbotErrorCode, MoreflowClientErrorCode, MoreflowErrorRecovery } from './errors';
export { chatbotStreamErrorCodes, isRetryableChatbotError, MoreflowChatbotError } from './errors';
export { isMoreflowError } from './internal/errors';
export type { ChatbotIdentity } from './identity';
export {
  chatbotThreadStorageKey,
  chatbotVisitorStorageKey,
  createChatbotIdentity,
  createChatbotRandomId
} from './identity';
export type { ChatbotStreamEvent } from './stream';
export type { AcquisitionTrackingConfig, AcquisitionTrackingSetting, StorageLike };
export {
  captureAcquisitionTracking,
  clearAcquisitionTracking,
  configureAcquisitionTracking,
  createMemoryStorage
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
export function chatbotAccountId(value: string): ChatbotAccountId {
  return value as ChatbotAccountId; // Public API payload boundary.
}

/** Brand externally supplied public API client ids at the package boundary. */
export function chatbotClientId(value: string): ChatbotClientId {
  return value as ChatbotClientId; // Public API payload boundary.
}

const chatbotAcquisitionFieldMap = {
  pageUrl: 'page_url',
  referrer: 'referrer',
  userAgent: 'user_agent',
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmTerm: 'utm_term',
  utmContent: 'utm_content',
  utmCampaignId: 'utm_campaignid',
  gadCampaignId: 'gad_campaignid',
  gclid: 'gclid',
  gbraid: 'gbraid',
  wbraid: 'wbraid',
  ttclid: 'ttclid',
  ttp: 'ttp',
  oppref: 'oppref',
  fbclid: 'fbclid',
  fbp: 'fbp',
  fbc: 'fbc'
} as const satisfies Record<string, keyof AcquisitionTracking>;

type ChatbotAcquisitionMetadata = {
  -readonly [ChatbotKey in keyof typeof chatbotAcquisitionFieldMap]?:
    | AcquisitionTracking[(typeof chatbotAcquisitionFieldMap)[ChatbotKey]]
    | undefined;
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

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function browserContext() {
  return globalThis as typeof globalThis & {
    innerWidth?: unknown;
    screen?: { width?: unknown; height?: unknown };
    document?: { referrer?: unknown };
    navigator?: { userAgent?: unknown };
  };
}

function deviceTypeFor(
  viewportWidth: number | undefined
): ChatbotConversationMetadata['deviceType'] {
  if (viewportWidth === undefined) return 'unknown';
  if (viewportWidth <= 640) return 'mobile';
  if (viewportWidth <= 1024) return 'tablet';
  return 'desktop';
}

function mapChatbotAcquisitionMetadata(tracking: AcquisitionTracking): ChatbotAcquisitionMetadata {
  const metadata: ChatbotAcquisitionMetadata = {};
  for (const chatbotKey of Object.keys(chatbotAcquisitionFieldMap) as Array<
    keyof typeof chatbotAcquisitionFieldMap
  >) {
    const trackingKey = chatbotAcquisitionFieldMap[chatbotKey];
    const value = tracking[trackingKey];
    if (value) metadata[chatbotKey] = value;
  }
  return metadata;
}

function trafficSourceMetadata(tracking: AcquisitionTracking): ChatbotConversationMetadata {
  return tracking.utm_source || tracking.gclid
    ? { trafficSource: tracking.utm_source ?? tracking.gclid }
    : {};
}

/**
 * The metadata a send carries without tracking consent: the UTM parameters and
 * ad click ids of the page URL, read without cookies, storage or device data.
 */
function urlChatbotMetadata(
  location: TrackingCaptureOptions['location']
): ChatbotConversationMetadata | undefined {
  const tracking = captureUrlAcquisitionTracking(location);
  const metadata = tracking
    ? { ...mapChatbotAcquisitionMetadata(tracking), ...trafficSourceMetadata(tracking) }
    : {};
  return Object.keys(metadata).length > 0 ? Object.freeze(metadata) : undefined;
}

/**
 * Reuses @moreflow/tracking's persisted acquisition capture and maps its
 * snake-case fields to the existing camel-case chatbot operation metadata contract.
 */
export function captureChatbotMetadata(
  options: ChatbotMetadataCaptureOptions = {}
): ChatbotConversationMetadata {
  const { viewportWidth, screenWidth, screenHeight, ...trackingCapture } = options;
  const browser = browserContext();
  const referrer = trackingCapture.referrer ?? stringValue(browser.document?.referrer);
  const userAgent = trackingCapture.userAgent ?? stringValue(browser.navigator?.userAgent);
  const tracking = captureAcquisitionTracking({
    ...trackingCapture,
    ...(referrer ? { referrer } : {}),
    ...(userAgent ? { userAgent } : {})
  });
  const width =
    numberValue(viewportWidth) ??
    numberValue(browser.innerWidth) ??
    numberValue(screenWidth) ??
    numberValue(browser.screen?.width);
  const resolvedScreenWidth = numberValue(screenWidth) ?? numberValue(browser.screen?.width);
  const resolvedScreenHeight = numberValue(screenHeight) ?? numberValue(browser.screen?.height);

  return Object.freeze({
    ...mapChatbotAcquisitionMetadata(tracking),
    ...trafficSourceMetadata(tracking),
    ...(width !== undefined ? { deviceType: deviceTypeFor(width) } : {}),
    ...(resolvedScreenWidth !== undefined ? { screenWidth: resolvedScreenWidth } : {}),
    ...(resolvedScreenHeight !== undefined ? { screenHeight: resolvedScreenHeight } : {})
  });
}

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
  call<T = unknown>(
    operationId: ChatbotOperationId,
    input: Record<string, unknown>,
    options?: ChatbotRequestOptions | undefined
  ): Promise<T>;
  getPublic(chatbotId: string, options?: ChatbotRequestOptions, visitorKey?: string | undefined): Promise<ChatbotPublicConfigResponse>;
  listMessages(input: {
    chatbotId: string;
    visitorId: string;
    threadId: string;
    cursor?: string | undefined;
    limit?: number | undefined;
  }, options?: ChatbotRequestOptions): Promise<ChatbotMessagesPage>;
  sendMessage(
    input: ChatbotSendMessageInput,
    options?: ChatbotRequestOptions | undefined
  ): Promise<ChatbotSendResult>;
  listMessageRatings(input: {
    chatbotId: string;
    visitorId: string;
    threadId: string;
  }): Promise<{ ratings: ChatbotMessageRating[]; trace?: Record<string, unknown> | undefined }>;
  setMessageRating(input: {
    chatbotId: string;
    visitorId: string;
    threadId: string;
    messageId: string;
    rating: 'up' | 'down' | null;
  }): Promise<{ rating: ChatbotMessageRating; trace?: Record<string, unknown> | undefined }>;
  streamMessage(
    input: ChatbotSendMessageInput,
    options?: ChatbotRequestOptions | undefined
  ): AsyncIterable<ChatbotStreamEvent>;
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
  send(
    options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
      threadId?: string | undefined;
    },
    requestOptions?: ChatbotRequestOptions | undefined
  ): Promise<ChatbotSendResult>;
  /**
   * Yields events until `message.complete` or `message.error`. A stream that ends without
   * either throws a `STREAM_INCOMPLETE` error; an aborted `signal` throws `ABORTED`.
   */
  sendStream(
    options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
      threadId?: string | undefined;
    },
    requestOptions?: ChatbotRequestOptions | undefined
  ): AsyncIterable<ChatbotStreamEvent>;
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
  }): Promise<{ rating: ChatbotMessageRating; trace?: Record<string, unknown> | undefined }>;
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

/**
 * Follows the caller's signal and can also abort on its own when the client resets.
 * Without `AbortController` the caller's signal is used as is.
 */
function linkedAbortController(signal: AbortSignal | undefined) {
  if (typeof AbortController === 'undefined') {
    return { signal, abort: () => undefined, release: () => undefined };
  }
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    release: () => signal?.removeEventListener('abort', abortFromCaller)
  };
}

export function createChatbotClient(options: CreateChatbotClientOptions): ChatbotClient {
  const identity = createChatbotIdentity({
    chatbotId: options.chatbotId,
    ...(options.storage ? { storage: options.storage } : {}),
    ...(options.randomId ? { randomId: options.randomId } : {})
  });
  const transport = createChatbotOperationTransport(options);
  const capture = options.trackingCapture;
  const trackingCapture = typeof capture === 'function' ? capture : () => captureChatbotMetadata(capture);
  // Bumped by every reset; a send only adopts its thread while its generation is current.
  let generation = 0;
  const inFlight = new Set<() => void>();

  function startOver(): void {
    generation += 1;
    const aborts = [...inFlight];
    inFlight.clear();
    for (const abort of aborts) abort();
  }

  function track(signal: AbortSignal | undefined) {
    const linked = linkedAbortController(signal);
    inFlight.add(linked.abort);
    const startedIn = generation;
    return {
      signal: linked.signal,
      adoptThread(result: ChatbotSendResult): void {
        if (startedIn !== generation) return;
        const threadId = stringValue(result.threadId);
        if (threadId) identity.setThreadId(threadId);
      },
      adoptRecovery(error: unknown): void {
        if (startedIn !== generation || !(error instanceof MoreflowChatbotError)) return;
        const recovery = error.recovery;
        const args = recovery?.args;
        if (!args || recovery?.operation !== chatbotOperationIds.messagesList ||
          args.chatbotId !== identity.chatbotId || args.visitorId !== identity.visitorId) return;
        const threadId = stringValue(args.threadId);
        if (threadId) identity.setThreadId(threadId);
      },
      done(): void {
        linked.release();
        inFlight.delete(linked.abort);
      }
    };
  }

  function resolveSendInput(
    input: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
      threadId?: string | undefined;
    }
  ): ChatbotSendMessageInput {
    const message = input.message.trim();
    if (!message) {
      throw new MoreflowChatbotError(validationErrorInit('message', 'message is required.'));
    }
    const threadId = stringValue(input.threadId) ?? identity.getThreadId() ?? undefined;
    const capturedMetadata =
      input.metadata ??
      (acquisitionTrackingConsented(options.acquisitionTracking)
        ? trackingCapture()
        : urlChatbotMetadata(typeof capture === 'function' ? undefined : capture?.location));
    const metadata =
      options.adsConsent === undefined
        ? capturedMetadata
        : { ...capturedMetadata, adsConsent: acquisitionTrackingConsented(options.adsConsent) };
    identity.persistVisitor();
    const experimentVariants =
      input.experimentVariants ?? mergeChatbotExperimentVariants(chatbotExperimentFor(identity.chatbotId), pageExperimentAssignments());
    // The visit the page view's pageview is linked to (docs/website-analytics.md §8.1); absent without a tracker reference.
    const visit = pageVisitReference();
    return {
      ...input,
      chatbotId: identity.chatbotId,
      visitorId: identity.visitorId,
      ...(threadId ? { threadId } : {}),
      message,
      clientMessageId: input.clientMessageId ?? createChatbotRandomId(),
      ...(metadata ? { metadata } : {}),
      ...(experimentVariants.length > 0 ? { experimentVariants } : {}),
      ...(visit ? { visit } : {})
    };
  }

  // The public read sends the page view's visitor key; an assigned chatbot experiment is kept for the page
  // view's messages and its exposure is recorded once (chatbot-experiments.ts).
  async function readPublicConfig(requestOptions?: ChatbotRequestOptions) {
    const response = await transport.getPublic(identity.chatbotId, requestOptions, chatbotPageVisitorKey());
    const experiment = experimentFromChatbotConfig(response);
    rememberChatbotExperiment(identity.chatbotId, experiment);
    if (experiment) trackChatbotExposure(identity.chatbotId, experiment);
    return response;
  }

  return {
    chatbotId: identity.chatbotId,
    get visitorId() {
      return identity.visitorId;
    },
    getThreadId: identity.getThreadId,
    getConfig: (requestOptions) => readPublicConfig(requestOptions),
    loadConfig: async (requestOptions) => (await readPublicConfig(requestOptions)).chatbot,
    async listMessages(listOptions = {}, requestOptions) {
      const threadId = stringValue(listOptions.threadId) ?? identity.getThreadId();
      if (!threadId) return null;
      return transport.listMessages({
        chatbotId: identity.chatbotId,
        visitorId: identity.visitorId,
        threadId,
        ...(stringValue(listOptions.cursor) ? { cursor: stringValue(listOptions.cursor) } : {}),
        ...(numberValue(listOptions.limit) !== undefined
          ? { limit: numberValue(listOptions.limit) }
          : {})
      }, requestOptions);
    },
    async send(input, requestOptions) {
      const sendInput = resolveSendInput(input);
      const request = track(requestOptions?.signal);
      try {
        const result = await transport.sendMessage(
          sendInput,
          request.signal ? { signal: request.signal } : {}
        );
        request.adoptThread(result);
        return result;
      } catch (error) {
        request.adoptRecovery(error);
        throw error;
      } finally {
        request.done();
      }
    },
    async *sendStream(input, requestOptions) {
      const sendInput = resolveSendInput(input);
      const request = track(requestOptions?.signal);
      try {
        for await (const event of transport.streamMessage(
          sendInput,
          request.signal ? { signal: request.signal } : {}
        )) {
          if (event.type === 'message.complete') request.adoptThread(event.result);
          if (event.type === 'message.error') request.adoptRecovery(event.error);
          yield event;
        }
      } catch (error) {
        request.adoptRecovery(error);
        throw error;
      } finally {
        request.done();
      }
    },
    async listMessageRatings(listOptions = {}) {
      const threadId = stringValue(listOptions.threadId) ?? identity.getThreadId();
      if (!threadId) return null;
      return transport.listMessageRatings({
        chatbotId: identity.chatbotId,
        visitorId: identity.visitorId,
        threadId
      });
    },
    async setMessageRating(input) {
      const threadId = stringValue(input.threadId) ?? identity.getThreadId();
      if (!threadId) {
        throw new MoreflowChatbotError({
          message: 'A chatbot thread is required to rate a message.',
          code: 'THREAD_REQUIRED',
          details: { field: 'threadId' }
        });
      }
      return transport.setMessageRating({
        chatbotId: identity.chatbotId,
        visitorId: identity.visitorId,
        threadId,
        messageId: input.messageId,
        rating: input.rating
      });
    },
    clearThread() {
      startOver();
      identity.clearThread();
    },
    reset() {
      startOver();
      identity.clearThread();
    },
    forgetVisitor() {
      startOver();
      identity.forgetVisitor();
    }
  };
}
