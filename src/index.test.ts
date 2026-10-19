import { describe, expect, it } from 'vitest';
import {
  captureChatbotMetadata,
  createChatbotClient,
  createChatbotIdentity,
  createChatbotOperationTransport,
  createMemoryStorage,
  isRetryableChatbotError,
  MoreflowChatbotError,
  normalizeChatbotConfig,
  type StorageLike
} from './index';

const chatbotId = '3f1a9c02-5b6d-4e71-9c8a-2d4f6b8e0a13';

function operationResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('@moreflow/chatbots', () => {
  it('persists visitor identity and thread ids using the established SDK keys', () => {
    const storage = createMemoryStorage();
    const first = createChatbotIdentity({
      chatbotId,
      storage,
      randomId: () => 'visitor-1'
    });

    expect(first.visitorId).toBe('visitor-1');
    expect(storage.getItem(`moreflow_chat_visitor_${chatbotId}`)).toBe('visitor-1');
    expect(first.getThreadId()).toBeNull();

    first.setThreadId('thread-1');
    expect(storage.getItem(`moreflow_chat_thread_${chatbotId}_visitor-1`)).toBe('thread-1');

    const reloaded = createChatbotIdentity({
      chatbotId,
      storage,
      randomId: () => 'visitor-2'
    });
    expect(reloaded.visitorId).toBe('visitor-1');
    expect(reloaded.getThreadId()).toBe('thread-1');

    reloaded.clearThread();
    expect(storage.getItem(`moreflow_chat_thread_${chatbotId}_visitor-1`)).toBeNull();
  });

  it('continues with a random id when local storage is unavailable', () => {
    const blockedStorage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    };

    const identity = createChatbotIdentity({
      chatbotId,
      storage: blockedStorage,
      randomId: () => 'generated-visitor'
    });

    expect(identity.visitorId).toBe('generated-visitor');
    expect(identity.getThreadId()).toBeNull();
    expect(() => identity.setThreadId('thread-1')).not.toThrow();
    expect(() => identity.clearThread()).not.toThrow();
  });

  it('normalizes legacy snake-case public configuration only once at the boundary', () => {
    const config = normalizeChatbotConfig({
      id: chatbotId,
      name: 'Example bot',
      mode: 'public',
      settings: {
        welcome_message: 'Legacy greeting',
        welcomeMessage: 'Canonical greeting'
      },
      embed_settings: {
        primary_color: '#111827',
        primaryColor: '#f97316'
      },
      lead_fields: [{ field_key: 'email_address' }],
      funnel_settings: { target_stage: 'lead' },
      support_settings: { agent_handoff: true }
    });

    expect(config.settings).toEqual({ welcomeMessage: 'Canonical greeting' });
    expect(config.embedSettings).toEqual({ primaryColor: '#f97316' });
    expect(config.leadFields).toEqual([{ fieldKey: 'email_address' }]);
    expect(config.funnelSettings).toEqual({ targetStage: 'lead' });
    expect(config.supportSettings).toEqual({ agentHandoff: true });
    expect(config).not.toHaveProperty('embed_settings');
  });

  it('uses all five public operation ids with the SDK request envelope', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const transport = createChatbotOperationTransport({
      apiBaseUrl: 'https://api.moreflow.test/',
      origin: 'https://customer.example',
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        if (url.endsWith('getPublic')) {
          return operationResponse({
            chatbot: {
              id: chatbotId,
              name: 'Example bot',
              mode: 'public',
              settings: {},
              embedSettings: {},
              leadFields: [],
              funnelSettings: {},
              supportSettings: {}
            }
          });
        }
        if (url.endsWith('messages.list')) return operationResponse({ items: [], hasMore: false });
        if (url.endsWith('messages.send')) return operationResponse({ threadId: 'thread-1' });
        if (url.endsWith('messageRatings.list')) return operationResponse({ ratings: [] });
        return operationResponse({
          rating: {
            chatbotId,
            threadId: 'thread-1',
            messageId: 'message-1',
            visitorId: 'visitor-1',
            rating: 'up'
          }
        });
      }
    });

    await transport.getPublic(chatbotId);
    await transport.listMessages({ chatbotId, visitorId: 'visitor-1', threadId: 'thread-1' });
    await transport.sendMessage({ chatbotId, visitorId: 'visitor-1', message: 'Hello' });
    await transport.listMessageRatings({ chatbotId, visitorId: 'visitor-1', threadId: 'thread-1' });
    await transport.setMessageRating({
      chatbotId,
      visitorId: 'visitor-1',
      threadId: 'thread-1',
      messageId: 'message-1',
      rating: 'up'
    });

    expect(requests.map((request) => request.url)).toEqual([
      'https://api.moreflow.test/v1/operations/chatbots.embed.getPublic',
      'https://api.moreflow.test/v1/operations/chatbots.embed.messages.list',
      'https://api.moreflow.test/v1/operations/chatbots.embed.messages.send',
      'https://api.moreflow.test/v1/operations/chatbots.embed.messageRatings.list',
      'https://api.moreflow.test/v1/operations/chatbots.embed.messageRatings.set'
    ]);
    expect(requests[0]?.body).toEqual({ chatbotId, origin: 'https://customer.example' });
  });

  it('adopts the server thread id, persists it, and clears it on reset', async () => {
    const storage = createMemoryStorage();
    const requestBodies: Record<string, unknown>[] = [];
    const client = createChatbotClient({
      chatbotId,
      storage,
      randomId: () => 'visitor-1',
      apiBaseUrl: 'https://api.moreflow.test',
      metadataCapture: () => ({ utmSource: 'newsletter' }),
      fetchImpl: async (_input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return operationResponse({ threadId: 'thread-adopted', response: 'Hi there' });
      }
    });

    const first = await client.send({ message: 'Hello' });
    expect(first.threadId).toBe('thread-adopted');
    expect(client.getThreadId()).toBe('thread-adopted');
    expect(storage.getItem(`moreflow_chat_thread_${chatbotId}_visitor-1`)).toBe('thread-adopted');
    expect(requestBodies[0]).toMatchObject({
      chatbotId,
      visitorId: 'visitor-1',
      message: 'Hello',
      metadata: { utmSource: 'newsletter' }
    });

    await client.send({ message: 'A second message' });
    expect(requestBodies[1]).toMatchObject({ threadId: 'thread-adopted' });

    client.reset();
    expect(client.getThreadId()).toBeNull();
    expect(storage.getItem(`moreflow_chat_thread_${chatbotId}_visitor-1`)).toBeNull();
  });

  it('marks temporary operation failures retryable and preserves surfaced operation errors', async () => {
    const temporary = createChatbotOperationTransport({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ error: { code: 'TEMPORARY_FAILURE', message: 'Try again' } }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        )
    });
    const surfaced = createChatbotOperationTransport({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    });

    await expect(temporary.getPublic(chatbotId)).rejects.toMatchObject({
      name: 'MoreflowChatbotError',
      status: 503,
      code: 'TEMPORARY_FAILURE',
      retryable: true,
      responseBody: { error: { code: 'TEMPORARY_FAILURE', message: 'Try again' } }
    });
    await expect(surfaced.getPublic(chatbotId)).rejects.toMatchObject({
      name: 'MoreflowChatbotError',
      code: 'ORIGIN_NOT_ALLOWED',
      retryable: false
    });

    try {
      await temporary.getPublic(chatbotId);
    } catch (error) {
      expect(error).toBeInstanceOf(MoreflowChatbotError);
      expect(isRetryableChatbotError(error)).toBe(true);
    }
  });

  it('maps the shared forms acquisition capture into chatbot metadata without duplicating it', () => {
    const storage = createMemoryStorage();
    const metadata = captureChatbotMetadata({
      location: {
        href: 'https://customer.example/pricing?utm_source=google&utm_campaign=launch&gclid=click-1&utm_campaignid=campaign-1&gad_campaignid=campaign-2&gad_source=1'
      },
      referrer: 'https://search.example/',
      userAgent: 'Vitest browser',
      viewportWidth: 375,
      screenWidth: 390,
      screenHeight: 844,
      storage
    });

    expect(metadata).toMatchObject({
      pageUrl:
        'https://customer.example/pricing?utm_source=google&utm_campaign=launch&gclid=click-1&utm_campaignid=campaign-1&gad_campaignid=campaign-2&gad_source=1',
      referrer: 'https://search.example/',
      userAgent: 'Vitest browser',
      trafficSource: 'google',
      utmSource: 'google',
      utmCampaign: 'launch',
      gclid: 'click-1',
      deviceType: 'mobile',
      screenWidth: 390,
      screenHeight: 844
    });

    const later = captureChatbotMetadata({
      location: { href: 'https://customer.example/about' },
      viewportWidth: 1200,
      storage
    });
    expect(later.gclid).toBe('click-1');
    expect(later.utmSource).toBe('google');
    expect(metadata).not.toHaveProperty('utmCampaignid');
    expect(metadata).not.toHaveProperty('gadCampaignid');
    expect(metadata).not.toHaveProperty('gadSource');
  });

  it('adopts the thread id from the public SSE complete event', async () => {
    const storage = createMemoryStorage();
    const body = [
      'event: message.start\n',
      `data: ${JSON.stringify({ chatbotId, visitorId: 'visitor-1' })}\n\n`,
      'event: message.delta\n',
      `data: ${JSON.stringify({ delta: 'Hello ' })}\n\n`,
      'event: message.complete\n',
      `data: ${JSON.stringify({ threadId: 'thread-streamed', response: 'Hello there' })}\n\n`
    ].join('');
    const client = createChatbotClient({
      chatbotId,
      storage,
      randomId: () => 'visitor-1',
      fetchImpl: async () =>
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        })
    });

    const events: string[] = [];
    for await (const event of client.sendStream({ message: 'Hello' })) events.push(event.type);

    expect(events).toEqual(['message.start', 'message.delta', 'message.complete']);
    expect(client.getThreadId()).toBe('thread-streamed');
  });
});
