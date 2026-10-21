import { describe, expect, it, vi } from 'vitest';
import { createChatbotClient, createChatbotSession, createMemoryStorage } from './index';

const consent = [
  { purpose: 'marketing_email', text: 'News', wordingVersion: 'v1', required: true },
  { purpose: 'email_tracking', text: 'Tracking', wordingVersion: 'v1', required: false }
];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' }
});
const complete = (response = 'Answer') => new Response(
  `event: message.complete\ndata: ${JSON.stringify({ response, assistantMessageId: 'a1', threadId: 't1' })}\n\n`,
  { headers: { 'content-type': 'text/event-stream' } }
);
function fixture(options: { consent?: unknown[]; thread?: string; handler?: (url: string, body: Record<string, unknown>, init?: RequestInit) => Response | Promise<Response> } = {}) {
  const storage = createMemoryStorage();
  if (options.thread) {
    storage.setItem('moreflow_chat_visitor_bot', 'visitor');
    storage.setItem('moreflow_chat_thread_bot_visitor', options.thread);
  }
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body: Record<string, unknown> = JSON.parse(String(init?.body));
    if (url.endsWith('getPublic')) return json({ chatbot: {
      id: 'bot', name: 'MPU West', mode: 'chat', settings: { welcome_message: 'Welcome' },
      embed_settings: { primary_color: '#112233', teaser: { enabled: true, messages: [{ text: 'Hi' }] } },
      avatar_url: 'https://example.test/avatar', company_logo_url: null, leadConsent: options.consent ?? []
    } });
    if (options.handler) return options.handler(url, body, init);
    if (url.endsWith('messages.list')) return json({ items: [], hasMore: false });
    return complete();
  });
  const client = createChatbotClient({ chatbotId: 'bot', storage, fetchImpl, baseUrl: '' });
  const session = createChatbotSession(client, { locale: 'en' });
  return { client, session, fetchImpl };
}

describe('createChatbotSession', () => {
  it('loads typed config, seeds welcome, and caches snapshots until a change', async () => {
    const { session, client } = fixture();
    expect(session.getSnapshot().status).toBe('loading');
    const changed = vi.fn();
    const unsubscribe = session.subscribe(changed);
    await session.ready;
    expect(session.getSnapshot()).toBe(session.getSnapshot());
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', messages: [{ text: 'Welcome', role: 'assistant' }],
      config: { embedSettings: { primaryColor: '#112233', teaser: { messages: [{ text: 'Hi' }] } } } });
    expect((await client.loadConfig()).settings.welcomeMessage).toBe('Welcome');
    expect(changed).toHaveBeenCalled();
    unsubscribe();
  });

  it('tracks tri-state decisions and attaches granted and declined consent only on the first message', async () => {
    const { session, fetchImpl } = fixture({ consent });
    await session.ready;
    expect(session.getSnapshot().consent).toMatchObject({ needed: true, missing: [consent[0]] });
    expect(await session.send('Hello')).toEqual({ status: 'consent_required', restoreText: 'Hello' });
    expect(session.consent.confirm()).toBe(false);
    session.consent.setDecision('marketing_email', true);
    session.consent.setDecision('email_tracking', false);
    expect(session.consent.confirm()).toBe(true);
    await session.send('First');
    await session.send('Second');
    const sends = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/stream'));
    expect(JSON.parse(String(sends[0]?.[1]?.body)).consent).toEqual([
      { purpose: 'marketing_email', granted: true, wordingVersion: 'v1' },
      { purpose: 'email_tracking', granted: false, wordingVersion: 'v1' }
    ]);
    expect(JSON.parse(String(sends[1]?.[1]?.body))).not.toHaveProperty('consent');
    session.reset();
    expect(session.getSnapshot().consent).toMatchObject({ needed: true, decisions: {} });
    session.consent.setDecision('marketing_email', null);
    expect(session.getSnapshot().consent.decisions.marketing_email).toBeNull();
    session.consent.acceptAll();
    expect(session.getSnapshot().status).toBe('ready');
  });

  it.each(['CHATBOT_CONSENT_REQUIRED', 'CHATBOT_CONSENT_WORDING_CHANGED', 'CHATBOT_CONSENT_NOT_REQUESTED'])(
    'recovers %s and restores composer text without failed messages', async (code) => {
      const { session } = fixture({ consent, handler: (url) => url.endsWith('messages.list')
        ? json({ items: [], hasMore: false })
        : json({ error: { code, message: 'Consent changed', details: { required: consent } } }, 409) });
      await session.ready;
      session.consent.acceptAll();
      await expect(session.send('Keep this text')).resolves.toEqual({ status: 'consent_required', restoreText: 'Keep this text' });
      expect(session.getSnapshot()).toMatchObject({ status: 'consent', messages: [{ id: 'welcome' }],
        consent: { needed: true, confirmed: false, decisions: {} }, error: { code } });
    }
  );

  it('keeps the server error wording authoritative over a stale config refresh', async () => {
    let fail = true;
    const current = { ...consent[0], wordingVersion: 'v2', text: 'Updated consent', purpose: 'marketing_email', required: true };
    const { session, fetchImpl } = fixture({ consent, handler: () => fail
      ? json({ error: { code: 'CHATBOT_CONSENT_WORDING_CHANGED', details: current } }, 409)
      : complete() });
    await session.ready;
    session.consent.acceptAll();
    expect((await session.send('Hello')).status).toBe('consent_required');
    expect(session.getSnapshot().consent.requests[0]).toEqual(current);
    session.reset();
    expect(session.getSnapshot().consent.requests[0]).toEqual(current);
    session.consent.acceptAll();
    fail = false;
    await session.send('Hello');
    const last = fetchImpl.mock.calls.at(-1);
    expect(JSON.parse(String(last?.[1]?.body)).consent[0].wordingVersion).toBe('v2');
  });

  it('removes withdrawn consent purposes using the authoritative error request list', async () => {
    const { session } = fixture({ consent, handler: () => json({ error: {
      code: 'CHATBOT_CONSENT_NOT_REQUESTED', details: { purpose: 'marketing_email', requested: [] }
    } }, 409) });
    await session.ready;
    session.consent.acceptAll();
    await expect(session.send('Hello')).resolves.toEqual({ status: 'consent_required', restoreText: 'Hello' });
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', consent: { needed: false, requests: [], decisions: {} } });
    session.reset();
    expect(session.getSnapshot().consent.needed).toBe(false);
  });

  it('aborts reset and ignores late replies that disregard the signal', async () => {
    let resolveReply: ((response: Response) => void) | undefined;
    let signal: AbortSignal | null | undefined;
    const { session, client } = fixture({ handler: (_url, _body, init) => {
      signal = init?.signal;
      return new Promise<Response>((resolve) => { resolveReply = resolve; });
    } });
    await session.ready;
    const sending = session.send('Hello');
    expect(session.getSnapshot().messages.at(-1)?.pending).toBe(true);
    session.reset();
    expect(signal?.aborted).toBe(true);
    resolveReply?.(complete('Late reply'));
    await expect(sending).resolves.toEqual({ status: 'aborted' });
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', messages: [{ id: 'welcome' }] });
    expect(client.getThreadId()).toBeNull();
  });

  it('aborts initial loading and starts cleanly again', async () => {
    const storage = createMemoryStorage();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
      if (fetchImpl.mock.calls.length > 1) return resolve(json({ chatbot: { settings: {}, leadConsent: [] } }));
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const session = createChatbotSession(createChatbotClient({ chatbotId: 'bot', storage, fetchImpl }));
    const oldLoad = session.ready;
    session.dispose();
    await session.start();
    await oldLoad;
    expect(session.getSnapshot().status).toBe('ready');
  });

  it('loads older history with hasMore, preserves order and deduplicates boundaries', async () => {
    const { session, fetchImpl } = fixture({ thread: 't1', handler: (_url, body) => body.cursor
      ? json({ items: [{ id: 'old', role: 'agent', text: 'Older' }, { id: 'latest', role: 'visitor', text: 'Hi' }], hasMore: false })
      : json({ items: [{ id: 'latest', role: 'visitor', text: 'Hi' }], nextCursor: 'older', hasMore: true }) });
    await session.ready;
    await session.loadMore();
    expect(session.getSnapshot().messages.map((message) => message.id)).toEqual(['old', 'latest']);
    expect(session.getSnapshot().messages[0]?.role).toBe('agent');
    expect(session.getSnapshot().hasMore).toBe(false);
    await session.loadMore();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toMatchObject({ cursor: 'older' });
  });

  it('falls back from an incomplete stream with the same id and replaces partial text', async () => {
    const bodies: Record<string, unknown>[] = [];
    const { session } = fixture({ handler: (url, body) => {
      bodies.push(body);
      return url.endsWith('/stream') ? new Response('event: message.delta\ndata: {"delta":"Partial"}\n\n')
        : json({ threadId: 't1', assistantMessageId: 'a1', response: 'Full answer' });
    } });
    await session.ready;
    expect((await session.send('Hello')).status).toBe('sent');
    expect(bodies[0]?.clientMessageId).toBeTruthy();
    expect(bodies[0]?.clientMessageId).toBe(bodies[1]?.clientMessageId);
    expect(session.getSnapshot().messages.at(-1)).toMatchObject({ text: 'Full answer', pending: false });
  });

  it('retries timeout failures with the original message id, never duplicating optimistic messages', async () => {
    let fail = true;
    const { session, fetchImpl } = fixture({ handler: () => fail
      ? Promise.reject(new TypeError('Offline')) : complete() });
    await session.ready;
    expect((await session.send('Hello')).status).toBe('error');
    const failed = session.getSnapshot().messages.find((message) => message.failed);
    expect(failed?.role).toBe('visitor');
    fail = false;
    expect((await session.retry(failed?.id ?? '')).status).toBe('sent');
    const sends = fetchImpl.mock.calls.filter(([url]) => !String(url).endsWith('getPublic'));
    const ids = sends.map(([, init]) => JSON.parse(String(init?.body)).clientMessageId);
    expect(new Set(ids).size).toBe(1);
    expect(session.getSnapshot().messages.filter((message) => message.role === 'visitor')).toHaveLength(1);
  });

  it('preserves HTTP Retry-After from streaming rate limits without another send', async () => {
    const { session, fetchImpl } = fixture({ handler: () => new Response(JSON.stringify({ error: {
      code: 'RATE_LIMIT', message: 'Slow down'
    } }), { status: 429, headers: { 'retry-after': '17', 'content-type': 'application/json' } }) });
    await session.ready;
    await session.send('Hello');
    expect(session.getSnapshot().error).toMatchObject({ code: 'RATE_LIMIT', retryable: true, retryAfterSeconds: 17 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces an in-progress send with its retry delay and retains its id for manual retry', async () => {
    let processing = true;
    const { session, fetchImpl } = fixture({ handler: () => processing
      ? new Response(`event: message.error\ndata: ${JSON.stringify({
        code: 'IDEMPOTENCY_IN_PROGRESS', details: { retryAfterSeconds: 12 }
      })}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
      : complete() });
    await session.ready;
    expect((await session.send('Hello')).status).toBe('error');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: {
      code: 'IDEMPOTENCY_IN_PROGRESS', retryable: true, retryAfterSeconds: 12,
      message: 'Your message is still being processed. Please wait a moment and try again.'
    } });
    const failed = session.getSnapshot().messages.find((message) => message.failed);
    expect(failed).toMatchObject({ role: 'visitor', text: 'Hello' });
    processing = false;
    expect((await session.retry(failed?.id ?? '')).status).toBe('sent');
    const sends = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/stream'));
    const ids = sends.map(([, init]) => JSON.parse(String(init?.body)).clientMessageId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(1);
    expect(session.getSnapshot().messages.filter((message) => message.role === 'visitor')).toHaveLength(1);
  });

  it.each(['json', 'sse'])('recovers first-send history after an uncertain %s outcome without sending again', async (transport) => {
    const { session, client, fetchImpl } = fixture({ handler: (url, body) => {
      if (url.endsWith('messages.list')) return json({ items: [{ id: 'a1', role: 'assistant', text: 'Persisted reply' }], hasMore: false });
      const error = { code: 'INVALID_STATE', recoverability: 'operator_action',
        recovery: { operation: 'chatbots.embed.messages.list', args: { chatbotId: 'bot', visitorId: body.visitorId, threadId: 'recovery-thread' } } };
      return transport === 'json' ? json({ error }, 409)
        : new Response(`event: message.error\ndata: ${JSON.stringify(error)}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
    } });
    await session.ready;
    expect((await session.send('Hello')).status).toBe('error');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().error).toMatchObject({ code: 'INVALID_STATE', retryable: false,
      message: 'The status of your last message could not be confirmed. Please reload the chat. If no reply appears, contact the chat operator before sending it again.'
    });
    expect(client.getThreadId()).toBe('recovery-thread');
    const restored = createChatbotSession(client);
    await restored.ready;
    expect(restored.getSnapshot().messages).toMatchObject([{ text: 'Persisted reply' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    session.dispose();
    restored.dispose();
  });

  it.each([{ chatbotId: 'other-bot' }, { visitorId: 'other-visitor' }])('ignores recovery pointers outside this visitor and chatbot: %j', async (foreignScope) => {
    const { client, session } = fixture({ handler: (_url, body) => json({ error: {
      code: 'INVALID_STATE', recovery: { operation: 'chatbots.embed.messages.list', args: {
        chatbotId: 'bot', visitorId: body.visitorId, threadId: 'foreign-thread', ...foreignScope
      } }
    } }, 409) });
    await session.ready;
    expect((await session.send('Hello')).status).toBe('error');
    expect(client.getThreadId()).toBeNull();
    session.dispose();
  });

  it('does not fall back on policy failures and exposes localized errors', async () => {
    const { session, fetchImpl } = fixture({ handler: () => json({ error: {
      code: 'POLICY_VALIDATION_FAILED', message: 'Developer message'
    } }, 422) });
    await session.ready;
    expect((await session.send('Hello')).status).toBe('error');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().error?.message).not.toBe('Developer message');
  });
});
