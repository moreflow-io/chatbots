import {
  captureAcquisitionTracking,
  createMemoryStorage,
  type AcquisitionTracking,
  type StorageLike,
  type TrackingCaptureOptions
} from '@moreflow/tracking';

import { type ChatbotLeadConsentAnswer, type ChatbotLeadConsentRequest, normalizeChatbotLeadConsent } from './consent';
import { MoreflowChatbotError, operationError } from './errors';

export { captureAcquisitionTracking, createMemoryStorage };
export type { StorageLike };
export * from './consent';
export { isRetryableChatbotError, MoreflowChatbotError } from './errors';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeStorageGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Browser storage can be blocked in private or embedded contexts.
  }
}

function safeStorageRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Browser storage can be blocked in private or embedded contexts.
  }
}

function browserLocalStorage(): StorageLike {
  try {
    return globalThis.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

/**
 * Generates the visitor ids used by the public chatbot SDK. Browsers with
 * `crypto.randomUUID` get a UUID; older or restricted contexts retain the
 * SDK's non-cryptographic fallback rather than failing chat initialization.
 */
export function createChatbotRandomId(): string {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch {
    // Fall through when Web Crypto is unavailable or access is restricted.
  }
  return `mf_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function chatbotVisitorStorageKey(chatbotId: string): string {
  return `moreflow_chat_visitor_${chatbotId}`;
}

export function chatbotThreadStorageKey(chatbotId: string, visitorId: string): string {
  return `moreflow_chat_thread_${chatbotId}_${visitorId}`;
}

export interface ChatbotIdentity {
  chatbotId: string;
  visitorId: string;
  getThreadId(): string | null;
  setThreadId(threadId: string | null | undefined): void;
  clearThread(): void;
}

export function createChatbotIdentity(options: {
  chatbotId: string;
  storage?: StorageLike | undefined;
  randomId?: (() => string) | undefined;
}): ChatbotIdentity {
  const chatbotId = options.chatbotId.trim();
  if (!chatbotId) throw new Error('chatbotId is required.');

  const storage = options.storage ?? browserLocalStorage();
  const visitorKey = chatbotVisitorStorageKey(chatbotId);
  const existingVisitorId = stringValue(safeStorageGet(storage, visitorKey));
  const visitorId = existingVisitorId ?? (options.randomId ?? createChatbotRandomId)();
  if (!existingVisitorId) safeStorageSet(storage, visitorKey, visitorId);
  const threadKey = chatbotThreadStorageKey(chatbotId, visitorId);

  return {
    chatbotId,
    visitorId,
    getThreadId() {
      return stringValue(safeStorageGet(storage, threadKey)) ?? null;
    },
    setThreadId(threadId) {
      const nextThreadId = stringValue(threadId);
      if (nextThreadId) {
        safeStorageSet(storage, threadKey, nextThreadId);
        return;
      }
      safeStorageRemove(storage, threadKey);
    },
    clearThread() {
      safeStorageRemove(storage, threadKey);
    }
  };
}

function camelCaseKey(key: string): string {
  return key.replace(/_([a-z0-9])/giu, (_match, character: string) => character.toUpperCase());
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue);
  if (!isRecord(value)) return value;

  const normalized: CanonicalChatbotRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (camelCaseKey(key) === key) normalized[key] = normalizeCanonicalValue(entry);
  }
  for (const [key, entry] of Object.entries(value)) {
    const canonicalKey = camelCaseKey(key);
    if (!(canonicalKey in normalized)) normalized[canonicalKey] = normalizeCanonicalValue(entry);
  }
  return normalized;
}

/** Converts public API records to one camel-case representation with camel-case precedence. */
export function normalizeChatbotConfig(value: unknown): ChatbotPublicConfig {
  const record = normalizeCanonicalValue(value);
  if (!isRecord(record)) throw new Error('Public chatbot configuration must be an object.');

  const settings = isRecord(record.settings) ? record.settings : {};
  const embedSettings = isRecord(record.embedSettings) ? record.embedSettings : {};
  const leadFields = Array.isArray(record.leadFields) ? record.leadFields.filter(isRecord) : [];
  const funnelSettings = isRecord(record.funnelSettings) ? record.funnelSettings : {};
  const supportSettings = isRecord(record.supportSettings) ? record.supportSettings : {};
  const accountId = stringValue(record.accountId);
  const description = stringValue(record.description);
  const avatarStorageId = stringValue(record.avatarStorageId);

  return {
    ...record,
    id: stringValue(record.id) ?? '',
    name: stringValue(record.name) ?? '',
    mode: stringValue(record.mode) ?? '',
    ...(accountId ? { accountId: chatbotAccountId(accountId) } : {}),
    ...(description ? { description } : {}),
    settings,
    embedSettings,
    leadFields,
    funnelSettings,
    supportSettings,
    ...(avatarStorageId ? { avatarStorageId } : {}),
    leadConsent: normalizeChatbotLeadConsent(record.leadConsent)
  };
}

export function normalizeChatbotPublicConfig(value: unknown): ChatbotPublicConfigResponse {
  if (!isRecord(value)) throw new Error('Public chatbot response must be an object.');
  return {
    chatbot: normalizeChatbotConfig(value.chatbot),
    ...(isRecord(value.trace) ? { trace: value.trace } : {})
  };
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
  const { viewportWidth, screenWidth, screenHeight, ...trackingOptions } = options;
  const browser = browserContext();
  const referrer = trackingOptions.referrer ?? stringValue(browser.document?.referrer);
  const userAgent = trackingOptions.userAgent ?? stringValue(browser.navigator?.userAgent);
  const tracking = captureAcquisitionTracking({
    ...trackingOptions,
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

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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

function defaultOrigin(): string | undefined {
  try {
    return stringValue(globalThis.location?.origin);
  } catch {
    return undefined;
  }
}

function normalizeApiBaseUrl(apiBaseUrl: string | undefined): string {
  return (apiBaseUrl ?? '').replace(/\/+$/u, '');
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
  }): Promise<{ ratings: ChatbotMessageRating[]; trace?: Record<string, unknown> | undefined }>;
  setMessageRating(input: {
    chatbotId: string;
    visitorId: string;
    threadId: string;
    messageId: string;
    rating: 'up' | 'down' | null;
  }): Promise<{ rating: ChatbotMessageRating; trace?: Record<string, unknown> | undefined }>;
  streamMessage(input: ChatbotSendMessageInput): AsyncIterable<ChatbotStreamEvent>;
}

export interface CreateChatbotOperationTransportOptions {
  apiBaseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  origin?: string | undefined;
}

function resolveFetch(fetchImpl: typeof fetch | undefined): typeof fetch {
  if (fetchImpl) return fetchImpl;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  throw new Error('A fetch implementation is required to call the Moreflow chatbot API.');
}

function asMessagesPage(value: unknown): ChatbotMessagesPage {
  const record = isRecord(value) ? value : {};
  const items = Array.isArray(record.items)
    ? record.items.filter(isRecord).map((item) => ({
        ...item,
        id: stringValue(item.id) ?? '',
        role: stringValue(item.role) ?? '',
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

export type ChatbotStreamEvent =
  | { type: 'message.start'; data: Record<string, unknown> }
  | { type: 'message.delta'; delta: string; data: Record<string, unknown> }
  | { type: 'message.complete'; result: ChatbotSendResult; data: Record<string, unknown> }
  | { type: 'message.error'; error: MoreflowChatbotError; data: Record<string, unknown> };

function parseSseEvent(raw: string): ChatbotStreamEvent | null {
  const lines = raw.split('\n');
  const event = stringValue(
    lines.find((line) => line.startsWith('event:'))?.slice('event:'.length)
  );
  const dataText = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');
  let data: Record<string, unknown> = {};
  if (dataText) {
    try {
      const parsed = JSON.parse(dataText);
      if (isRecord(parsed)) data = parsed;
    } catch {
      // Ignore malformed event payloads rather than introducing presentation behavior here.
    }
  }

  if (event === 'message.start') return { type: event, data };
  if (event === 'message.delta') return { type: event, delta: stringValue(data.delta) ?? '', data };
  if (event === 'message.complete') return { type: event, result: asSendResult(data), data };
  if (event === 'message.error') {
    return {
      type: event,
      error: operationError({ responseBody: data }),
      data
    };
  }
  return null;
}

async function* parseSse(response: Response): AsyncGenerator<ChatbotStreamEvent> {
  if (!response.body) {
    throw new MoreflowChatbotError({
      message: 'The chatbot streaming response did not include a body.',
      retryable: true,
      responseBody: undefined
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/gu, '\n');
    const records = buffer.split('\n\n');
    buffer = records.pop() ?? '';
    for (const record of records) {
      const event = parseSseEvent(record);
      if (event) yield event;
    }
  }
  buffer += decoder.decode().replace(/\r\n/gu, '\n');
  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event) yield event;
  }
}

export function createChatbotOperationTransport(
  options: CreateChatbotOperationTransportOptions = {}
): ChatbotOperationTransport {
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  const fetchImpl = resolveFetch(options.fetchImpl);
  const origin = options.origin ?? defaultOrigin();

  async function call<T = unknown>(
    operationId: ChatbotOperationId,
    input: Record<string, unknown>
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${apiBaseUrl}/v1/operations/${operationId}`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'content-type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ ...input, ...(origin ? { origin } : {}) })
      });
    } catch (cause) {
      throw new MoreflowChatbotError({
        message: 'The chatbot operation request could not reach the network.',
        code: 'NETWORK_ERROR',
        retryable: true,
        responseBody: undefined,
        cause
      });
    }

    const payload = await readResponseBody(response);
    if (!response.ok) throw operationError({ responseBody: payload, status: response.status });
    return normalizeChatbotOperationPayload<T>(payload);
  }

  return {
    call,
    async getPublic(chatbotId) {
      return normalizeChatbotPublicConfig(await call(chatbotOperationIds.getPublic, { chatbotId }));
    },
    async listMessages(input) {
      return asMessagesPage(await call(chatbotOperationIds.messagesList, input));
    },
    async sendMessage(input) {
      return asSendResult(await call(chatbotOperationIds.messagesSend, compactRecord(input)));
    },
    async listMessageRatings(input) {
      return asRatings(await call(chatbotOperationIds.messageRatingsList, input));
    },
    async setMessageRating(input) {
      return asRatingResult(await call(chatbotOperationIds.messageRatingsSet, input));
    },
    async *streamMessage(input) {
      let response: Response;
      try {
        response = await fetchImpl(
          `${apiBaseUrl}/v1/chatbots/${encodeURIComponent(input.chatbotId)}/messages/stream`,
          {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: {
              'content-type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(compactRecord(input))
          }
        );
      } catch (cause) {
        throw new MoreflowChatbotError({
          message: 'The chatbot streaming request could not reach the network.',
          code: 'NETWORK_ERROR',
          retryable: true,
          responseBody: undefined,
          cause
        });
      }
      if (!response.ok)
        throw operationError({
          responseBody: await readResponseBody(response),
          status: response.status
        });
      yield* parseSse(response);
    }
  };
}

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
  send(
    options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
      threadId?: string | undefined;
    }
  ): Promise<ChatbotSendResult>;
  sendStream(
    options: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
      threadId?: string | undefined;
    }
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
  reset(): void;
}

export interface CreateChatbotClientOptions extends CreateChatbotOperationTransportOptions {
  chatbotId: string;
  storage?: StorageLike | undefined;
  randomId?: (() => string) | undefined;
  metadataCapture?: (() => ChatbotConversationMetadata) | undefined;
}

export function createChatbotClient(options: CreateChatbotClientOptions): ChatbotClient {
  const identity = createChatbotIdentity({
    chatbotId: options.chatbotId,
    ...(options.storage ? { storage: options.storage } : {}),
    ...(options.randomId ? { randomId: options.randomId } : {})
  });
  const transport = createChatbotOperationTransport(options);
  const metadataCapture = options.metadataCapture ?? captureChatbotMetadata;

  function resolveSendInput(
    input: Omit<ChatbotSendMessageInput, 'chatbotId' | 'visitorId' | 'threadId'> & {
      threadId?: string | undefined;
    }
  ): ChatbotSendMessageInput {
    const message = input.message.trim();
    if (!message) {
      throw new MoreflowChatbotError({
        message: 'message is required.',
        code: 'VALIDATION_ERROR',
        responseBody: undefined
      });
    }
    const threadId = stringValue(input.threadId) ?? identity.getThreadId() ?? undefined;
    return {
      ...input,
      chatbotId: identity.chatbotId,
      visitorId: identity.visitorId,
      ...(threadId ? { threadId } : {}),
      message,
      metadata: input.metadata ?? metadataCapture()
    };
  }

  function adoptThread(result: ChatbotSendResult): void {
    const threadId = stringValue(result.threadId);
    if (threadId) identity.setThreadId(threadId);
  }

  return {
    chatbotId: identity.chatbotId,
    visitorId: identity.visitorId,
    getThreadId: identity.getThreadId,
    getConfig: () => transport.getPublic(identity.chatbotId),
    async listMessages(listOptions = {}) {
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
      });
    },
    async send(input) {
      const result = await transport.sendMessage(resolveSendInput(input));
      adoptThread(result);
      return result;
    },
    async *sendStream(input) {
      for await (const event of transport.streamMessage(resolveSendInput(input))) {
        if (event.type === 'message.complete') adoptThread(event.result);
        yield event;
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
          responseBody: undefined
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
    clearThread: identity.clearThread,
    reset: identity.clearThread
  };
}
