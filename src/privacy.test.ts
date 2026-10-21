import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatbotThreadStorageKey, chatbotVisitorStorageKey, createChatbotClient, createMemoryStorage } from './index';

const chatbotId = '3f1a9c02-5b6d-4e71-9c8a-2d4f6b8e0a13';
const visitorKey = chatbotVisitorStorageKey(chatbotId);

afterEach(() => {
  vi.unstubAllGlobals();
});

function recordingClient(options: Partial<Parameters<typeof createChatbotClient>[0]> = {}) {
  const bodies: Record<string, unknown>[] = [];
  const storage = createMemoryStorage();
  let nextVisitor = 0;
  const client = createChatbotClient({
    chatbotId,
    storage,
    randomId: () => `visitor-${(nextVisitor += 1)}`,
    baseUrl: 'https://api.moreflow.test',
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ success: true, data: { threadId: 'thread-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    ...options
  });
  return { client, bodies, storage };
}

describe('@moreflow/chatbots stored visitor data', () => {
  it('stores nothing until the visitor sends a first message', async () => {
    const { client, storage } = recordingClient();

    await client.getConfig().catch(() => undefined);
    expect(client.visitorId).toBe('visitor-1');
    expect(storage.getItem(visitorKey)).toBeNull();

    await client.send({ message: 'Hello' });

    expect(storage.getItem(visitorKey)).toBe('visitor-1');
    expect(storage.getItem(chatbotThreadStorageKey(chatbotId, 'visitor-1'))).toBe('thread-1');
  });

  it('forgets the stored visitor and thread and continues as a new visitor', async () => {
    const { client, bodies, storage } = recordingClient();
    await client.send({ message: 'Hello' });

    client.forgetVisitor();

    expect(storage.getItem(visitorKey)).toBeNull();
    expect(storage.getItem(chatbotThreadStorageKey(chatbotId, 'visitor-1'))).toBeNull();
    expect(client.visitorId).toBe('visitor-2');
    expect(client.getThreadId()).toBeNull();

    await client.send({ message: 'Hello again' });
    expect(bodies[1]).toMatchObject({ visitorId: 'visitor-2' });
    expect(bodies[1]).not.toHaveProperty('threadId');
    expect(storage.getItem(visitorKey)).toBe('visitor-2');
  });
});

describe('@moreflow/chatbots acquisitionTracking', () => {
  function stubLandingPage() {
    vi.stubGlobal('location', { href: 'https://example.test/?utm_source=google', search: '' });
    vi.stubGlobal('document', { cookie: '_fbp=fb.1.123.456', referrer: '' });
    const session = createMemoryStorage();
    vi.stubGlobal('sessionStorage', session);
    return session;
  }

  it('sends no metadata and reads no cookies by default', async () => {
    const session = stubLandingPage();
    const { client, bodies } = recordingClient();

    await client.send({ message: 'Hello' });

    expect(bodies[0]).not.toHaveProperty('metadata');
    expect(session.getItem('moreflow:acquisition:v1')).toBeNull();
  });

  it('captures acquisition metadata when enabled', async () => {
    stubLandingPage();
    const { client, bodies } = recordingClient({ acquisitionTracking: true });

    await client.send({ message: 'Hello' });

    expect(bodies[0]?.metadata).toMatchObject({ utmSource: 'google', fbp: 'fb.1.123.456' });
  });

  it('asks a consent function on every send and never calls a capture override without consent', async () => {
    stubLandingPage();
    let consented = false;
    const trackingCapture = vi.fn(() => ({ utmSource: 'override' }));
    const { client, bodies } = recordingClient({
      acquisitionTracking: () => consented,
      trackingCapture
    });

    await client.send({ message: 'Before consent' });
    consented = true;
    await client.send({ message: 'After consent' });

    expect(trackingCapture).toHaveBeenCalledTimes(1);
    expect(bodies[0]).not.toHaveProperty('metadata');
    expect(bodies[1]?.metadata).toEqual({ utmSource: 'override' });
  });

  it('sends explicit metadata whatever the setting', async () => {
    const { client, bodies } = recordingClient();

    await client.send({ message: 'Hello', metadata: { deviceType: 'desktop' } });

    expect(bodies[0]?.metadata).toEqual({ deviceType: 'desktop' });
  });
});
