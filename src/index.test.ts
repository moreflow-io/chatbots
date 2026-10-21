import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureChatbotMetadata,
  chatbotStreamErrorCodes,
  createChatbotClient,
  createChatbotIdentity,
  createChatbotOperationTransport,
  createMemoryStorage,
  isRetryableChatbotError,
  MoreflowChatbotError,
  normalizeChatbotConfig,
  normalizeChatbotPublicConfig,
  type ChatbotStreamEvent,
  type StorageLike
} from './index';

const chatbotId = '3f1a9c02-5b6d-4e71-9c8a-2d4f6b8e0a13';

afterEach(() => {
  vi.unstubAllGlobals();
});

function sseRecord(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A controllable SSE body that records whether the SDK cancelled it. */
function controlledSseResponse(initialRecords: string[]) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const state = { cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      for (const record of initialRecords) streamController.enqueue(encoder.encode(record));
    },
    cancel() {
      state.cancelled = true;
    }
  });
  return {
    state,
    response: new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' }
    }),
    push(record: string) {
      controller?.enqueue(encoder.encode(record));
    },
    close() {
      controller?.close();
    }
  };
}

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
    expect(storage.getItem(`moreflow_chat_visitor_${chatbotId}`)).toBeNull();
    expect(first.getThreadId()).toBeNull();

    first.persistVisitor();
    expect(storage.getItem(`moreflow_chat_visitor_${chatbotId}`)).toBe('visitor-1');

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

    // A chatbot of its own: blocked storage diverts to the session-wide memory fallback,
    // which only exists in a browser, where `window` exists.
    vi.stubGlobal('window', {});
    const identity = createChatbotIdentity({
      chatbotId: 'blocked-storage-bot',
      storage: blockedStorage,
      randomId: () => 'generated-visitor'
    });

    expect(identity.visitorId).toBe('generated-visitor');
    expect(identity.getThreadId()).toBeNull();
    expect(() => identity.persistVisitor()).not.toThrow();
    expect(() => identity.setThreadId('thread-1')).not.toThrow();
    expect(identity.getThreadId()).toBe('thread-1');
    expect(
      createChatbotIdentity({ chatbotId: 'blocked-storage-bot', storage: blockedStorage }).visitorId
    ).toBe('generated-visitor');
    expect(() => identity.clearThread()).not.toThrow();
    expect(identity.getThreadId()).toBeNull();
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
      baseUrl: 'https://api.moreflow.test/',
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
    // The API reads the embedding origin from the Origin/Referer header, never the body.
    expect(requests[0]?.body).toEqual({ chatbotId });
  });

  it('sends no dev-tunnel header and forwards the caller signal', async () => {
    const inits: RequestInit[] = [];
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async (_input, init) => {
        inits.push(init ?? {});
        return operationResponse({ threadId: 'thread-1' });
      }
    });
    const controller = new AbortController();

    const pending = client.send({ message: 'Hello' }, { signal: controller.signal });
    const requestSignal = inits[0]?.signal;
    expect(requestSignal?.aborted).toBe(false);
    controller.abort();
    expect(requestSignal?.aborted).toBe(true);
    await pending;
    expect(new Headers(inits[0]?.headers).has('ngrok-skip-browser-warning')).toBe(false);
  });

  it('reports an aborted send as ABORTED instead of a retryable network error', async () => {
    const controller = new AbortController();
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async (_input, init) => {
        controller.abort();
        throw init?.signal?.reason;
      }
    });

    const failure = await client
      .send({ message: 'Hello' }, { signal: controller.signal })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MoreflowChatbotError);
    expect(failure).toMatchObject({ code: chatbotStreamErrorCodes.aborted, retryable: false });
  });

  it('adopts the server thread id, persists it, and clears it on reset', async () => {
    const storage = createMemoryStorage();
    const requestBodies: Record<string, unknown>[] = [];
    const client = createChatbotClient({
      chatbotId,
      storage,
      randomId: () => 'visitor-1',
      baseUrl: 'https://api.moreflow.test',
      acquisitionTracking: true,
      trackingCapture: () => ({ utmSource: 'newsletter' }),
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

  it('aborts an in-flight send on reset and never adopts its late thread id', async () => {
    const storage = createMemoryStorage();
    const signals: Array<AbortSignal | undefined> = [];
    let reply: (response: Response) => void = () => undefined;
    const client = createChatbotClient({
      chatbotId,
      storage,
      randomId: () => 'visitor-1',
      // Ignores the abort signal, like a reply already on its way back.
      fetchImpl: (_input, init) => {
        signals.push(init?.signal ?? undefined);
        return new Promise<Response>((resolve) => {
          reply = resolve;
        });
      }
    });
    storage.setItem(`moreflow_chat_thread_${chatbotId}_visitor-1`, 'thread-old');

    const pending = client.send({ message: 'Hello' });
    client.reset();
    expect(signals[0]?.aborted).toBe(true);
    reply(operationResponse({ threadId: 'thread-old', response: 'Late' }));

    await expect(pending).resolves.toMatchObject({ threadId: 'thread-old' });
    expect(client.getThreadId()).toBeNull();
    expect(storage.getItem(`moreflow_chat_thread_${chatbotId}_visitor-1`)).toBeNull();
  });

  it('keeps adopting threads for sends started after a clearThread', async () => {
    let threadNumber = 0;
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async () => operationResponse({ threadId: `thread-${++threadNumber}` })
    });

    await client.send({ message: 'Hello' });
    client.clearThread();
    await client.send({ message: 'Hello again' });

    expect(client.getThreadId()).toBe('thread-2');
  });

  it('never stores an old thread under the new visitor after forgetVisitor', async () => {
    const storage = createMemoryStorage();
    let visitorNumber = 0;
    let reply: (response: Response) => void = () => undefined;
    const client = createChatbotClient({
      chatbotId,
      storage,
      randomId: () => `visitor-${++visitorNumber}`,
      fetchImpl: () =>
        new Promise<Response>((resolve) => {
          reply = resolve;
        })
    });

    const pending = client.send({ message: 'Hello' });
    client.forgetVisitor();
    reply(operationResponse({ threadId: 'thread-of-visitor-1' }));
    await pending;

    expect(client.visitorId).toBe('visitor-2');
    expect(client.getThreadId()).toBeNull();
  });

  it('aborts a stream on reset before its complete event can adopt the thread', async () => {
    const stream = controlledSseResponse([
      sseRecord('message.start', { chatbotId, visitorId: 'visitor-1' })
    ]);
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async () => stream.response
    });

    const iterator = client.sendStream({ message: 'Hello' })[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { type: 'message.start' }
    });
    // Resetting cancels the body, so the complete event the server would send never arrives.
    client.reset();

    await expect(iterator.next()).rejects.toMatchObject({ code: 'ABORTED' });
    expect(client.getThreadId()).toBeNull();
    expect(stream.state.cancelled).toBe(true);
  });

  it('passes trackingCapture to the built-in metadata capture', async () => {
    const storage = createMemoryStorage();
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      acquisitionTracking: true,
      trackingCapture: {
        location: { href: 'https://example.test/?utm_source=google' },
        storage,
        persistenceKey: 'site:acquisition'
      },
      fetchImpl: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return operationResponse({ threadId: 'thread-1' });
      }
    });

    await client.send({ message: 'Hello' });

    expect(bodies[0]?.metadata).toMatchObject({ utmSource: 'google' });
    expect(storage.getItem('site:acquisition')).toContain('google');
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
  it('cancels the response body when the consumer stops reading early', async () => {
    const stream = controlledSseResponse([
      sseRecord('message.start', { chatbotId }),
      sseRecord('message.delta', { delta: 'Hel' })
    ]);
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async () => stream.response
    });

    const events: string[] = [];
    for await (const event of client.sendStream({ message: 'Hello' })) {
      events.push(event.type);
      if (event.type === 'message.delta') break;
    }

    expect(events).toEqual(['message.start', 'message.delta']);
    expect(stream.state.cancelled).toBe(true);
  });

  it('stops a pending stream read and cancels the body when the signal aborts', async () => {
    const stream = controlledSseResponse([sseRecord('message.start', { chatbotId })]);
    const controller = new AbortController();
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async () => stream.response
    });

    const events: string[] = [];
    const failure = await (async () => {
      for await (const event of client.sendStream(
        { message: 'Hello' },
        { signal: controller.signal }
      )) {
        events.push(event.type);
        // The next read is pending on a stream that never sends more data.
        setTimeout(() => controller.abort(), 0);
      }
    })().catch((error: unknown) => error);

    expect(events).toEqual(['message.start']);
    expect(failure).toMatchObject({
      name: 'MoreflowChatbotError',
      code: chatbotStreamErrorCodes.aborted
    });
    expect(stream.state.cancelled).toBe(true);
  });

  it('throws STREAM_INCOMPLETE when the stream ends without a terminal event', async () => {
    const stream = controlledSseResponse([
      sseRecord('message.start', { chatbotId }),
      sseRecord('message.delta', { delta: 'Hello ' })
    ]);
    stream.close();
    const storage = createMemoryStorage();
    const client = createChatbotClient({
      chatbotId,
      storage,
      randomId: () => 'visitor-1',
      fetchImpl: async () => stream.response
    });

    const events: string[] = [];
    const failure = await (async () => {
      for await (const event of client.sendStream({ message: 'Hello' })) events.push(event.type);
    })().catch((error: unknown) => error);

    expect(events).toEqual(['message.start', 'message.delta']);
    expect(failure).toBeInstanceOf(MoreflowChatbotError);
    expect(failure).toMatchObject({
      code: chatbotStreamErrorCodes.incomplete,
      retryable: false
    });
    expect(client.getThreadId()).toBeNull();
  });

  it('yields message.error as the terminal event and releases the body', async () => {
    const stream = controlledSseResponse([
      sseRecord('message.start', { chatbotId }),
      sseRecord('message.error', {
        code: 'CHATBOT_CONSENT_REQUIRED',
        message: 'Consent is required.'
      })
    ]);
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: async () => stream.response
    });

    const events: ChatbotStreamEvent[] = [];
    for await (const event of client.sendStream({ message: 'Hello' })) events.push(event);

    expect(events.map((event) => event.type)).toEqual(['message.start', 'message.error']);
    const terminal = events[1];
    expect(terminal?.type === 'message.error' ? terminal.error : undefined).toMatchObject({
      name: 'MoreflowChatbotError',
      code: 'CHATBOT_CONSENT_REQUIRED',
      message: 'Consent is required.'
    });
    expect(stream.state.cancelled).toBe(true);
  });
});

describe('@moreflow/chatbots family conventions', () => {
  it('throws MoreflowChatbotError instead of a plain Error for bad input and bad responses', () => {
    expect(() => createChatbotIdentity({ chatbotId: ' ' })).toThrow(MoreflowChatbotError);
    expect(() => createChatbotIdentity({ chatbotId: ' ' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', details: { field: 'chatbotId' } })
    );
    expect(() => normalizeChatbotPublicConfig('nope')).toThrow(
      expect.objectContaining({ code: 'INVALID_RESPONSE', responseBody: 'nope' })
    );
  });

  it('defaults to the production API and keeps typed recovery on operation failures', async () => {
    const urls: string[] = [];
    const transport = createChatbotOperationTransport({
      fetchImpl: async (input) => {
        urls.push(String(input));
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'CHATBOT_CONSENT_REQUIRED',
              message: 'Consent is required.',
              context: { required: [] },
              recovery: { operation: 'chatbots.embed.messages.send', args: { consent: [] } }
            }
          }),
          { status: 200 }
        );
      }
    });

    await expect(
      transport.sendMessage({ chatbotId: 'bot-1', message: 'Hi' })
    ).rejects.toMatchObject({
      code: 'CHATBOT_CONSENT_REQUIRED',
      details: { required: [] },
      recovery: { operation: 'chatbots.embed.messages.send', args: { consent: [] } }
    });
    expect(urls).toEqual(['https://api.moreflow.io/v1/operations/chatbots.embed.messages.send']);
  });
});
