import { normalizeChatbotPublicConfig } from './config';
import { abortedError, MoreflowChatbotError, operationError } from './errors';
import { fetchUnavailableInit, networkErrorInit } from './internal/errors';
import { readResponseBody, resolveBaseUrl, resolveFetch } from './internal/http';
import { isRecord, stringValue } from './internal/values';
import { parseSse } from './stream';
import type {
  ChatbotOperationId,
  ChatbotOperationTransport,
  ChatbotRequestOptions,
  CreateChatbotOperationTransportOptions
} from './index';
import type { ChatbotMessage, ChatbotMessageRating, ChatbotMessagesPage } from './public-types';
import { createChatbotChallengeSession, isChatbotChallengeError } from './challenge';

export const chatbotOperationIds = {
  getPublic: 'chatbots.embed.getPublic',
  messagesList: 'chatbots.embed.messages.list',
  messagesSend: 'chatbots.embed.messages.send',
  messageRatingsList: 'chatbots.embed.messageRatings.list',
  messageRatingsSet: 'chatbots.embed.messageRatings.set'
} as const;

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

function asSendResult(value: unknown): import('./public-types').ChatbotSendResult {
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
  return {
    ratings,
    ...(isRecord(record.trace) ? { trace: record.trace } : {})
  };
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
  const challenge = createChatbotChallengeSession(options);

  async function call<T = unknown>(
    operationId: ChatbotOperationId,
    input: Record<string, unknown>,
    requestOptions: ChatbotRequestOptions = {}
  ): Promise<T> {
    const { signal } = requestOptions;
    const challenged = operationId === chatbotOperationIds.messagesSend;
    for (let attempt = 0; ; attempt += 1) {
      const token =
        challenged && challenge.isRequired(String(input.chatbotId))
          ? await challenge.getToken(String(input.chatbotId), signal)
          : undefined;
      if (signal?.aborted) throw abortedError(signal);
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/operations/${operationId}`, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'content-type': 'application/json',
            ...(token ? { 'x-captcha-response': token } : {})
          },
          body: JSON.stringify(input),
          ...(signal ? { signal } : {})
        });
      } catch (cause) {
        if (signal?.aborted) throw abortedError(signal);
        throw new MoreflowChatbotError(
          networkErrorInit('The chatbot operation request could not reach the network.', cause)
        );
      }
      try {
        const payload = await readResponseBody(response);
        if (!response.ok)
          throw operationError({
            responseBody: payload,
            status: response.status,
            retryAfter: response.headers.get('retry-after') ?? undefined
          });
        return normalizeChatbotOperationPayload<T>(payload);
      } catch (error) {
        // Challenge rejection happens before execution. Never replay an ambiguous network/generation failure.
        if (challenged && isChatbotChallengeError(error)) {
          challenge.require(String(input.chatbotId));
          if (attempt === 0) continue;
        }
        throw error;
      }
    }
  }

  return {
    call,
    async getPublic(chatbotId, options, visitorKey) {
      return normalizeChatbotPublicConfig(
        await call(chatbotOperationIds.getPublic, { chatbotId, ...(visitorKey ? { visitorKey } : {}) }, options)
      );
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
      for (let attempt = 0; ; attempt += 1) {
        const token = challenge.isRequired(input.chatbotId)
          ? await challenge.getToken(input.chatbotId, signal)
          : undefined;
        if (signal?.aborted) throw abortedError(signal);
        let response: Response;
        try {
          response = await fetchImpl(
            `${baseUrl}/chatbots/${encodeURIComponent(input.chatbotId)}/messages/stream`,
            {
              method: 'POST',
              mode: 'cors',
              credentials: 'omit',
              headers: {
                'content-type': 'application/json',
                ...(token ? { 'x-captcha-response': token } : {})
              },
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
        let retry = false;
        let deliveredContent = false;
        try {
          if (!response.ok)
            throw operationError({
              responseBody: await readResponseBody(response),
              status: response.status,
              retryAfter: response.headers.get('retry-after') ?? undefined
            });
          for await (const event of parseSse(response, signal)) {
            if (
              event.type === 'message.error' &&
              !deliveredContent &&
              isChatbotChallengeError(event.error)
            ) {
              challenge.require(input.chatbotId);
              if (attempt === 0) {
                retry = true;
                break;
              }
            }
            if (event.type === 'message.delta' || event.type === 'message.complete')
              deliveredContent = true;
            yield event;
          }
        } catch (error) {
          if (!deliveredContent && isChatbotChallengeError(error)) {
            challenge.require(input.chatbotId);
            if (attempt === 0) retry = true;
            else throw error;
          } else {
            throw error;
          }
        }
        if (!retry) return;
      }
    }
  };
}
