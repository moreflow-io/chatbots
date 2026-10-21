import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type BrowserChatbots = typeof import('./index');

const browserBundle = readFileSync(new URL('../dist/browser.js', import.meta.url), 'utf8');

const throwingStorage = {
  getItem() {
    throw new Error('Storage is blocked.');
  },
  setItem() {
    throw new Error('Storage is blocked.');
  },
  removeItem() {
    throw new Error('Storage is blocked.');
  }
};

function loadBrowserChatbots(): BrowserChatbots {
  const sandbox = {
    Headers,
    Response,
    ReadableStream,
    TextDecoder,
    TextEncoder,
    URL,
    crypto: { randomUUID: () => 'visitor-1' },
    localStorage: throwingStorage,
    sessionStorage: throwingStorage,
    location: { href: 'https://shop.example.test/', origin: 'https://shop.example.test' },
    document: { cookie: '', referrer: '' },
    navigator: { userAgent: 'vm' },
    window: undefined as unknown
  };
  sandbox.window = sandbox;
  const context = createContext(sandbox);
  runInContext(browserBundle, context, { filename: 'dist/browser.js' });
  const chatbots = Reflect.get(context, 'MoreflowChatbots');
  expect(chatbots).toBeTruthy();
  return chatbots as BrowserChatbots;
}

function sse(events: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(event));
        controller.close();
      }
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

describe('@moreflow/chatbots browser build', () => {
  it('runs as a classic script against the production API with blocked storage', async () => {
    expect(browserBundle).not.toMatch(/(?:^|\n)\s*import\s/mu);
    const chatbots = loadBrowserChatbots();
    const urls: string[] = [];
    const client = chatbots.createChatbotClient({
      chatbotId: 'bot-1',
      fetchImpl: async (input, init) => {
        urls.push(String(input));
        if (String(input).endsWith('/messages/stream')) {
          return sse([
            'event: message.delta\ndata: {"delta":"Hi"}\n\n',
            'event: message.complete\ndata: {"threadId":"thread-1","response":"Hi"}\n\n'
          ]);
        }
        // The browser's Origin header names the embedding page; the body carries none.
        expect(JSON.parse(String(init?.body))).not.toHaveProperty('origin');
        return new Response(
          JSON.stringify({ success: true, data: { chatbot: { id: 'bot-1', name: 'Bot' } } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    });

    expect(client.visitorId).toBe('visitor-1');
    expect((await client.getConfig()).chatbot).toMatchObject({ id: 'bot-1', leadConsent: [] });
    const events = [];
    for await (const event of client.sendStream({ message: 'Hello' })) events.push(event.type);
    expect(events).toEqual(['message.delta', 'message.complete']);
    expect(client.getThreadId()).toBe('thread-1');
    expect(urls).toEqual([
      'https://api.moreflow.io/v1/operations/chatbots.embed.getPublic',
      'https://api.moreflow.io/v1/chatbots/bot-1/messages/stream'
    ]);
  });

  it('throws the shared error shape from the global API', async () => {
    const chatbots = loadBrowserChatbots();
    const client = chatbots.createChatbotClient({
      chatbotId: 'bot-1',
      baseUrl: 'https://dev-api.moreflow.io',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'RATE_LIMIT',
              message: 'Slow down.',
              recovery: null,
              details: { retryAfterSeconds: 2 },
              requestId: 'req_1'
            }
          }),
          { status: 429 }
        )
    });
    const failure = await client.getConfig().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(chatbots.MoreflowChatbotError);
    expect(failure).toMatchObject({
      name: 'MoreflowChatbotError',
      code: 'RATE_LIMIT',
      retryable: true,
      details: { retryAfterSeconds: 2 },
      requestId: 'req_1'
    });
  });
});
