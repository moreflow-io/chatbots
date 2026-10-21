// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ChatbotLeadConsentRequest,
  chatbotOperationIds,
  chatbotThreadStorageKey,
  chatbotVisitorStorageKey,
  createChatbotClient,
  createMemoryStorage
} from './index';
import { useChatbot } from './react';
import type { ChatbotSessionOptions } from './session-types';

afterEach(cleanup);

const chatbotId = 'chatbot-1';
const marketing: ChatbotLeadConsentRequest = {
  purpose: 'marketing_email', text: 'Send me offers by email.', wordingVersion: 'wording-1', required: true
};
const config = (leadConsent: ChatbotLeadConsentRequest[] = []) => ({
  chatbot: { id: chatbotId, name: 'Assistant', mode: 'support', settings: { welcomeMessage: 'Welcome!' }, leadConsent }
});
const json = (body: unknown) => new Response(JSON.stringify({ success: true, data: body }), {
  headers: { 'content-type': 'application/json' }
});
const operationUrl = (operation: string) => `/v1/operations/${operation}`;
const complete = () => new Response(`event: message.complete\ndata: ${JSON.stringify({
  threadId: 'thread-1', assistantMessageId: 'reply-1', response: 'Hello!'
})}\n\n`, { headers: { 'content-type': 'text/event-stream' } });

function clientFor(fetchImpl: typeof fetch, returning = false) {
  const storage = createMemoryStorage();
  if (returning) {
    storage.setItem(chatbotVisitorStorageKey(chatbotId), 'visitor-1');
    storage.setItem(chatbotThreadStorageKey(chatbotId, 'visitor-1'), 'thread-1');
  }
  return createChatbotClient({
    chatbotId, baseUrl: '', storage, randomId: () => 'visitor-1', fetchImpl
  });
}

describe('useChatbot', () => {
  it('loads config followed by returning-visitor history and keeps the session on rerender', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(chatbotOperationIds.getPublic)) return json(config());
      return json({ items: [{ id: 'past-1', role: 'assistant', text: 'Previous reply.' }], hasMore: true, nextCursor: 'older' });
    });
    const client = clientFor(fetchImpl, true);
    const { result, rerender } = renderHook(() => useChatbot(client, { locale: 'en', pageSize: 10 }));
    expect(result.current.state.status).toBe('loading');

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state.config).toMatchObject({ id: chatbotId, name: 'Assistant' });
    expect(result.current.state.messages).toEqual([expect.objectContaining({ id: 'past-1', text: 'Previous reply.' })]);
    expect(result.current.state.hasMore).toBe(true);
    expect(fetchImpl.mock.calls.map(([input]) => String(input))).toEqual([
      operationUrl(chatbotOperationIds.getPublic), operationUrl(chatbotOperationIds.messagesList)
    ]);
    expect(fetchImpl).toHaveBeenLastCalledWith(operationUrl(chatbotOperationIds.messagesList), expect.objectContaining({
      body: expect.stringContaining('"limit":10')
    }));

    const session = result.current.session;
    const state = result.current.state;
    rerender();
    expect(result.current.session).toBe(session);
    expect(result.current.state).toBe(state);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('re-renders for consent decisions, confirmation, sends and reset', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith(chatbotOperationIds.getPublic) ? json(config([marketing])) : complete()
    );
    const client = clientFor(fetchImpl);
    const { result } = renderHook(() => useChatbot(client, { locale: 'en' }));
    await waitFor(() => expect(result.current.state.status).toBe('consent'));
    const session = result.current.session;
    expect(result.current.state.consent).toMatchObject({ needed: true, confirmed: false, missing: [marketing] });

    act(() => session.consent.setDecision('marketing_email', true));
    expect(result.current.state.consent.decisions.marketing_email).toBe(true);
    expect(result.current.state.consent.missing).toEqual([]);
    act(() => session.consent.setDecision('marketing_email', null));
    expect(result.current.state.consent.missing).toEqual([marketing]);
    act(() => session.consent.acceptAll());
    act(() => { expect(session.consent.confirm()).toBe(true); });
    expect(result.current.state.status).toBe('ready');
    expect(result.current.state.consent.confirmed).toBe(true);

    await act(async () => { expect(await session.send('Hello')).toMatchObject({ status: 'sent' }); });
    expect(result.current.state.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Hello', pending: false, failed: false }),
      expect.objectContaining({ text: 'Hello!', role: 'assistant' })
    ]));
    expect(fetchImpl).toHaveBeenLastCalledWith(`/v1/chatbots/${chatbotId}/messages/stream`, expect.objectContaining({
      body: expect.stringContaining('"consent":[{"purpose":"marketing_email","granted":true,"wordingVersion":"wording-1"}]')
    }));
    act(() => session.reset());
    expect(result.current.state.status).toBe('consent');
    expect(result.current.state.messages.some((message) => message.text === 'Hello')).toBe(false);
  });

  it('aborts an in-flight send when the component unmounts', async () => {
    let sendSignal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(chatbotOperationIds.getPublic)) return json(config());
      sendSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    const client = clientFor(fetchImpl);
    const { result, unmount } = renderHook(() => useChatbot(client));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    let pending: ReturnType<typeof result.current.session.send> | undefined;
    act(() => { pending = result.current.session.send('Hello'); });
    await waitFor(() => expect(sendSignal).toBeDefined());
    expect(sendSignal?.aborted).toBe(false);
    unmount();
    expect(sendSignal?.aborted).toBe(true);
    await act(async () => { await pending; });
    expect(client.getThreadId()).toBeNull();
  });

  it('restarts loading after StrictMode effect cleanup and resolves readiness', async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    let resolveRestart: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal);
      if (signals.length > 1) {
        return new Promise<Response>((resolve) => { resolveRestart = resolve; });
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    const client = clientFor(fetchImpl);
    const { result } = renderHook(() => useChatbot(client), {
      // StrictMode must wrap the root to replay initial effects in React 19.
      reactStrictMode: true
    });
    // Fail promptly if effect replay never starts the replacement request.
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(result.current.state.status).toBe('loading');

    const session = result.current.session;
    let readySettled = false;
    const ready = session.ready.then(() => { readySettled = true; });
    await act(async () => { await Promise.resolve(); });
    expect(readySettled).toBe(false);
    expect(resolveRestart).toBeDefined();
    await act(async () => { resolveRestart?.(json(config())); });
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
      expect(readySettled).toBe(true);
    });
    await ready;
    expect(result.current.session).toBe(session);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.messages).toEqual([expect.objectContaining({ text: 'Welcome!' })]);
  });

  it('creates a new session when the client or copy options change', async () => {
    const fetchImpl = vi.fn(async () => json(config()));
    const client = clientFor(fetchImpl);
    const { result, rerender } = renderHook(({ activeClient, options }) => useChatbot(activeClient, options), {
      initialProps: { activeClient: client, options: { locale: 'de', formality: 'formal' } as ChatbotSessionOptions }
    });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    let previous = result.current.session;
    rerender({ activeClient: client, options: { locale: 'en', formality: 'formal' } });
    expect(result.current.session).not.toBe(previous);
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    previous = result.current.session;
    rerender({ activeClient: client, options: { locale: 'en', formality: 'informal' } });
    expect(result.current.session).not.toBe(previous);
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    previous = result.current.session;
    rerender({ activeClient: clientFor(fetchImpl), options: { locale: 'en', formality: 'informal' } });
    expect(result.current.session).not.toBe(previous);
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });

  it('does not start network requests during server rendering', () => {
    const fetchImpl = vi.fn(async () => json(config()));
    const client = clientFor(fetchImpl);
    function Chat() {
      useChatbot(client);
      return null;
    }
    renderToString(createElement(Chat));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
