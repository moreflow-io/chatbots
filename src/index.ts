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
import { normalizeChatbotPublicConfig } from './config';
import type { ChatbotLeadConsentAnswer } from './consent';
import type { ChatbotMessage, ChatbotMessageRating, ChatbotMessagesPage, ChatbotPublicConfig, ChatbotPublicConfigResponse, ChatbotSendResult } from './public-types';

export { normalizeChatbotConfig, normalizeChatbotPublicConfig } from './config';
export type { ChatbotErrorDescription, DescribeChatbotErrorOptions } from './error-messages';
export { describeChatbotError } from './error-messages';
export * from './public-types';
export { createChatbotSession } from './session';
export * from './session-types';

import { abortedError, MoreflowChatbotError, operationError } from './errors';
import { createChatbotIdentity, createChatbotRandomId } from './identity';
import {
  type AcquisitionTrackingSetting,
  acquisitionTrackingEnabled
} from './internal/acquisition-tracking';
import {
  fetchUnavailableInit,
  networkErrorInit,
  validationErrorInit
} from './internal/errors';
import {
  type BaseUrlOptions,
  readResponseBody,
  resolveBaseUrl,
  resolveFetch
} from './internal/http';
import { isRecord, stringValue } from './internal/values';
import { type ChatbotStreamEvent, parseSse } from './stream';

export * from './consent';
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

export const chatbotOperationIds = {
  getPublic: 'chatbots.embed.getPublic',
  messagesList: 'chatbots.embed.messages.list',
  messagesSend: 'chatbots.embed.messages.send',
  messageRatingsList: 'chatbots.embed.messageRatings.list',
  messageRatingsSet: 'chatbots.embed.messageRatings.set'
} as const;

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
  gclid: 'gclid',
  gbraid: 'gbraid',
  wbraid: 'wbraid',
  ttclid: 'ttclid',
  ttp: 'ttp',
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
    ...(tracking.utm_source || tracking.gclid
      ? { trafficSource: tracking.utm_source ?? tracking.gclid }
      : {}),
    ...(width !== undefined ? { deviceType: deviceTypeFor(width) } : {}),
    ...(resolvedScreenWidth !== undefined ? { screenWidth: resolvedScreenWidth } : {}),
    ...(resolvedScreenHeight !== undefined ? { screenHeight: resolvedScreenHeight } : {})
  });
}

/** Normalizes both Moreflow operation envelopes and direct operation payloads. */
export function normalizeChatbotOperationPayload<T = unknown>(payload: unknown): T {
  if (isRecord(payload) && payload.success === true && Object.hasOwn(payload, 'data')) {
    return payload.data as T;
  }
  if (isRecord(payload) && payload.success === false) {
    throw operationError({ responseBody: payload });
  }
  return payload as T;
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
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
  getPublic(chatbotId: string, options?: ChatbotRequestOptions): Promise<ChatbotPublicConfigResponse>;
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
  /**
   * @deprecated Ignored. The API checks the chatbot's allowed domains against the
   * request's `Origin` (or `Referer`) header, which the browser sets; a value in
   * the body was always overwritten.
   */
  origin?: string | undefined;
}

function messageRole(value: unknown): ChatbotMessage['role'] {
  return value === 'visitor' || value === 'agent' || value === 'system' ? value : 'assistant';
}

function asMessagesPage(value: unknown): ChatbotMessagesPage {
  const record = isRecord(value) ? value : {};
  const items = Array.isArray(record.items)
    ? record.items.filter(isRecord).map((item) => ({
        ...item,
        id: stringValue(item.id) ?? '',
        role: messageRole(item.role),
        text: stringValue(item.text) ?? ''
      }))
    : [];
  return {
    items,
    hasMore: record.hasMore === true,
    ...(stringValue(record.nextCursor) ? { nextCursor: stringValue(record.nextCursor) } : {}),
    ...(isRecord(record.trace) ? { trace: record.trace } : {})
  };
}

function asSendResult(value: unknown): ChatbotSendResult {
  return isRecord(value) ? value : {};
}

function asRatingValue(value: unknown): ChatbotMessageRating['rating'] {
  return value === 'up' || value === 'down' ? value : null;
}

function asRatings(value: unknown): {
  ratings: ChatbotMessageRating[];
  trace?: Record<string, unknown> | undefined;
} {
  const record = isRecord(value) ? value : {};
  const ratings = Array.isArray(record.ratings)
    ? record.ratings.filter(isRecord).map((rating) => ({
        ...rating,
        chatbotId: stringValue(rating.chatbotId) ?? '',
        threadId: stringValue(rating.threadId) ?? '',
        messageId: stringValue(rating.messageId) ?? '',
        visitorId: stringValue(rating.visitorId) ?? '',
        rating: asRatingValue(rating.rating)
      }))
    : [];
  return { ratings, ...(isRecord(record.trace) ? { trace: record.trace } : {}) };
}

function asRatingResult(value: unknown): {
  rating: ChatbotMessageRating;
  trace?: Record<string, unknown> | undefined;
} {
  const record = isRecord(value) ? value : {};
  const rating = isRecord(record.rating) ? record.rating : {};
  return {
    rating: {
      ...rating,
      chatbotId: stringValue(rating.chatbotId) ?? '',
      threadId: stringValue(rating.threadId) ?? '',
      messageId: stringValue(rating.messageId) ?? '',
      visitorId: stringValue(rating.visitorId) ?? '',
      rating: asRatingValue(rating.rating)
    },
    ...(isRecord(record.trace) ? { trace: record.trace } : {})
  };
}

export function createChatbotOperationTransport(
  options: CreateChatbotOperationTransportOptions = {}
): ChatbotOperationTransport {
  const baseUrl = resolveBaseUrl(options);
  const resolvedFetch = resolveFetch(options.fetchImpl);
  if (!resolvedFetch) throw new MoreflowChatbotError(fetchUnavailableInit('@moreflow/chatbots'));
  const fetchImpl: typeof fetch = resolvedFetch;

  async function call<T = unknown>(
    operationId: ChatbotOperationId,
    input: Record<string, unknown>,
    requestOptions: ChatbotRequestOptions = {}
  ): Promise<T> {
    const { signal } = requestOptions;
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/v1/operations/${operationId}`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        ...(signal ? { signal } : {})
      });
    } catch (cause) {
      if (signal?.aborted) throw abortedError(signal);
      throw new MoreflowChatbotError(
        networkErrorInit('The chatbot operation request could not reach the network.', cause)
      );
    }

    const payload = await readResponseBody(response);
    if (!response.ok) throw operationError({ responseBody: payload, status: response.status, retryAfter: response.headers.get('retry-after') ?? undefined });
    return normalizeChatbotOperationPayload<T>(payload);
  }

  return {
    call,
    async getPublic(chatbotId, options) {
      return normalizeChatbotPublicConfig(await call(chatbotOperationIds.getPublic, { chatbotId }, options));
    },
    async listMessages(input, options) {
      return asMessagesPage(await call(chatbotOperationIds.messagesList, input, options));
    },
    async sendMessage(input, requestOptions) {
      return asSendResult(
        await call(chatbotOperationIds.messagesSend, compactRecord(input), requestOptions)
      );
    },
    async listMessageRatings(input) {
      return asRatings(await call(chatbotOperationIds.messageRatingsList, input));
    },
    async setMessageRating(input) {
      return asRatingResult(await call(chatbotOperationIds.messageRatingsSet, input));
    },
    async *streamMessage(input, requestOptions = {}) {
      const { signal } = requestOptions;
      let response: Response;
      try {
        response = await fetchImpl(
          `${baseUrl}/v1/chatbots/${encodeURIComponent(input.chatbotId)}/messages/stream`,
          {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(compactRecord(input)),
            ...(signal ? { signal } : {})
          }
        );
      } catch (cause) {
        if (signal?.aborted) throw abortedError(signal);
        throw new MoreflowChatbotError(
          networkErrorInit('The chatbot streaming request could not reach the network.', cause)
        );
      }
      if (!response.ok)
        throw operationError({
          responseBody: await readResponseBody(response),
          status: response.status,
          retryAfter: response.headers.get('retry-after') ?? undefined
        });
      yield* parseSse(response, signal);
    }
  };
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
   * Attaches acquisition metadata (UTM parameters, ad click ids, Meta's `_fbp`/`_fbc`
   * cookies, referrer, page URL, device) to every send. Off by default because the
   * capture reads cookies and writes browser storage, which needs consent in the EU.
   */
  acquisitionTracking?: AcquisitionTrackingSetting | undefined;
  /** Capture options or a replacement callback; used only while `acquisitionTracking` is on.
   * Unset options follow `configureAcquisitionTracking()`. */
  trackingCapture?: ChatbotMetadataCaptureOptions | (() => ChatbotConversationMetadata | undefined) | undefined;
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
    const metadata =
      input.metadata ??
      (acquisitionTrackingEnabled(options.acquisitionTracking) ? trackingCapture() : undefined);
    identity.persistVisitor();
    return {
      ...input,
      chatbotId: identity.chatbotId,
      visitorId: identity.visitorId,
      ...(threadId ? { threadId } : {}),
      message,
      clientMessageId: input.clientMessageId ?? createChatbotRandomId(),
      ...(metadata ? { metadata } : {})
    };
  }

  return {
    chatbotId: identity.chatbotId,
    get visitorId() {
      return identity.visitorId;
    },
    getThreadId: identity.getThreadId,
    getConfig: (requestOptions) => transport.getPublic(identity.chatbotId, requestOptions),
    loadConfig: async (requestOptions) => (await transport.getPublic(identity.chatbotId, requestOptions)).chatbot,
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
