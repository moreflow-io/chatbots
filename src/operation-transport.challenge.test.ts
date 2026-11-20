// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createChatbotClient, createChatbotOperationTransport, createMemoryStorage } from './index';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const sse = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const rejected = (code: string) => ({
  success: false,
  error: { code, message: 'Solve again' }
});
const codes = [
  'TURNSTILE_TOKEN_REQUIRED',
  'TURNSTILE_TOKEN_INVALID',
  'TURNSTILE_ACTION_MISMATCH',
  'TURNSTILE_HOSTNAME_NOT_ALLOWED'
];

describe('chatbot fresh challenge transport', () => {
  it.each(
    codes
  )('re-challenges generic sends once after %s with the same logical message', async (code) => {
    const getChallengeToken = vi.fn().mockResolvedValueOnce('fresh').mockResolvedValueOnce('next');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(rejected(code), 403))
      .mockImplementation(async () => json({ threadId: 'thread', response: 'Done' }));
    const client = createChatbotClient({
      chatbotId: 'bot',
      fetchImpl,
      getChallengeToken,
      storage: createMemoryStorage()
    });
    await client.send({ message: 'Hello', clientMessageId: 'logical-1' });
    await client.send({ message: 'Again', clientMessageId: 'logical-2' });
    expect(getChallengeToken).toHaveBeenCalledTimes(2);
    expect(getChallengeToken).toHaveBeenCalledWith(
      expect.objectContaining({ chatbotId: 'bot', action: 'chatbot_message' })
    );
    expect(
      fetchImpl.mock.calls.map(([, init]) => new Headers(init.headers).get('x-captcha-response'))
    ).toEqual([null, 'fresh', 'next']);
    expect(fetchImpl.mock.calls.map(([, init]) => JSON.parse(init.body).clientMessageId)).toEqual([
      'logical-1',
      'logical-1',
      'logical-2'
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).not.toHaveProperty('token');
  });
  it.each(
    codes
  )('re-challenges stream errors once after %s without emitting a rejected terminal event', async (code) => {
    const getChallengeToken = vi.fn().mockResolvedValueOnce('new').mockResolvedValueOnce('next');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          sse('message.start', {}) + sse('message.error', { code, message: 'Solve again' })
        )
      )
      .mockImplementation(async () => new Response(sse('message.complete', { response: 'Done' })));
    const transport = createChatbotOperationTransport({
      fetchImpl,
      getChallengeToken
    });
    const events = [];
    for await (const event of transport.streamMessage({
      chatbotId: 'bot',
      message: 'Hello',
      clientMessageId: 'same'
    }))
      events.push(event);
    for await (const event of transport.streamMessage({
      chatbotId: 'bot',
      message: 'Again',
      clientMessageId: 'next'
    }))
      events.push(event);
    expect(events.map((event) => event.type)).toEqual([
      'message.start',
      'message.complete',
      'message.complete'
    ]);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(
      Array(3).fill('https://api.moreflow.io/v1/chatbots/bot/messages/stream')
    );
    expect(
      fetchImpl.mock.calls.map(([, init]) => new Headers(init.headers).get('x-captcha-response'))
    ).toEqual([null, 'new', 'next']);
    expect(fetchImpl.mock.calls.map(([, init]) => JSON.parse(init.body).clientMessageId)).toEqual([
      'same',
      'same',
      'next'
    ]);
  });
  it('also recovers an HTTP stream rejection, and bounds repeated rejection to two attempts', async () => {
    const getChallengeToken = vi.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two');
    const fetchImpl = vi.fn(async () => json(rejected('TURNSTILE_TOKEN_INVALID'), 403));
    const transport = createChatbotOperationTransport({
      fetchImpl,
      getChallengeToken
    });
    await expect(async () => {
      for await (const _ of transport.streamMessage({
        chatbotId: 'bot',
        message: 'Hello'
      })) {
      }
    }).rejects.toMatchObject({ code: 'TURNSTILE_TOKEN_INVALID' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(getChallengeToken).toHaveBeenCalledTimes(1);
  });
  it('does not send after reset while an external challenge provider ignores cancellation', async () => {
    let solve: ((token: string) => void) | undefined;
    const getChallengeToken = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          solve = resolve;
        })
    );
    const fetchImpl = vi.fn(async () => json(rejected('TURNSTILE_TOKEN_REQUIRED'), 403));
    const client = createChatbotClient({
      chatbotId: 'bot',
      fetchImpl,
      getChallengeToken,
      storage: createMemoryStorage()
    });
    const pending = client.send({ message: 'Hello' });
    await vi.waitFor(() => expect(getChallengeToken).toHaveBeenCalledTimes(1));
    client.reset();
    solve?.('late-token');
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('keeps disabled sends working, and does not challenge reads or retry ambiguous network failures', async () => {
    const getChallengeToken = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ chatbot: {} }))
      .mockResolvedValueOnce(json({ response: 'Done' }))
      .mockRejectedValueOnce(new Error('offline'));
    const transport = createChatbotOperationTransport({
      fetchImpl,
      getChallengeToken
    });
    await transport.getPublic('bot');
    expect(getChallengeToken).not.toHaveBeenCalled();
    await transport.sendMessage({ chatbotId: 'bot', message: 'Hello' });
    expect(new Headers(fetchImpl.mock.calls[1]![1].headers).has('x-captcha-response')).toBe(false);
    await expect(
      transport.sendMessage({ chatbotId: 'bot', message: 'Hello' })
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(getChallengeToken).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('shares learned enforcement between generic and stream sends and refreshes invalid tokens', async () => {
    const getChallengeToken = vi
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('expired')
      .mockResolvedValueOnce('replacement');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(rejected('TURNSTILE_TOKEN_REQUIRED'), 403))
      .mockResolvedValueOnce(json({ response: 'Done' }))
      .mockResolvedValueOnce(json(rejected('TURNSTILE_TOKEN_INVALID'), 403))
      .mockResolvedValueOnce(new Response(sse('message.complete', { response: 'Done' })));
    const transport = createChatbotOperationTransport({
      fetchImpl,
      getChallengeToken
    });
    await transport.sendMessage({ chatbotId: 'bot', message: 'Hello' });
    for await (const _ of transport.streamMessage({
      chatbotId: 'bot',
      message: 'Again'
    })) {
    }
    expect(
      fetchImpl.mock.calls.map(([, init]) => new Headers(init.headers).get('x-captcha-response'))
    ).toEqual([null, 'first', 'expired', 'replacement']);
    expect(getChallengeToken).toHaveBeenCalledTimes(3);
  });

  it('does not replay a stream after content has been delivered', async () => {
    const getChallengeToken = vi.fn();
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          sse('message.delta', { delta: 'Partial' }) +
            sse('message.error', {
              code: 'TURNSTILE_TOKEN_REQUIRED',
              message: 'Failed'
            })
        )
    );
    const transport = createChatbotOperationTransport({
      fetchImpl,
      getChallengeToken
    });
    const events = [];
    for await (const event of transport.streamMessage({
      chatbotId: 'bot',
      message: 'Hello'
    }))
      events.push(event);
    expect(events.map((event) => event.type)).toEqual(['message.delta', 'message.error']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getChallengeToken).not.toHaveBeenCalled();
  });
});
