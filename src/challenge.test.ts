// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createChatbotChallengeSession,
  createChatbotChallengeTokenProvider,
  freshChatbotChallengeToken
} from './challenge';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
function frame() {
  return document.querySelector('iframe')!;
}
function reply(
  type: string,
  extra: Record<string, unknown> = {},
  source?: Window | null,
  origin?: string
) {
  const target = frame();
  const url = new URL(target.src);
  window.dispatchEvent(
    new MessageEvent('message', {
      source: source ?? target.contentWindow,
      origin: origin ?? url.origin,
      data: {
        type: `moreflow.challenge.${type}`,
        requestId: url.searchParams.get('requestId'),
        ...extra
      }
    })
  );
}
describe('owned-host chatbot challenge frame', () => {
  it.each([
    [{ baseUrl: '' }, 'https://api.moreflow.io'],
    [{ baseUrl: 'https://customer.example/proxy' }, 'https://api.moreflow.io'],
    [{ baseUrl: 'https://dev-api.moreflow.io' }, 'https://dev-api.moreflow.io'],
    [
      { baseUrl: '', challengeBaseUrl: 'https://dev-api.moreflow.io' },
      'https://dev-api.moreflow.io'
    ]
  ] as const)('keeps proxy sends on an owned challenge host: %j', async (options, origin) => {
    const result = freshChatbotChallengeToken(options, 'bot');
    expect(new URL(frame().src).origin).toBe(origin);
    reply('disabled');
    await expect(result).resolves.toBeUndefined();
  });
  it('binds replies to origin, frame window and per-attempt nonce, then removes the frame', async () => {
    const getToken = createChatbotChallengeTokenProvider({
      baseUrl: 'https://dev-api.moreflow.io',
      title: 'Sicherheitsprüfung'
    });
    const promise = getToken({ chatbotId: 'bot', action: 'chatbot_message' });
    const first = frame();
    expect(first.src).toContain('https://dev-api.moreflow.io/chatbots/bot?challenge=1');
    expect(first.title).toBe('Sicherheitsprüfung');
    expect(first.style.pointerEvents).toBe('none');
    reply('token', { token: 'forged' }, window);
    reply('token', { token: 'forged' }, undefined, 'https://customer.example');
    reply('token', { token: 'forged', requestId: 'another-attempt' });
    expect(frame()).toBe(first);
    reply('visible');
    expect(first.style.pointerEvents).toBe('auto');
    reply('token', { token: 'fresh-1' });
    await expect(promise).resolves.toBe('fresh-1');
    expect(document.querySelector('iframe')).toBeNull();
    const second = getToken({ chatbotId: 'bot', action: 'chatbot_message' });
    expect(frame()).not.toBe(first);
    expect(frame().src).not.toBe(first.src);
    reply('token', { token: 'fresh-2' });
    await expect(second).resolves.toBe('fresh-2');
  });
  it('sends no token when the server reports disabled', async () => {
    const result = createChatbotChallengeTokenProvider()({
      chatbotId: 'bot',
      action: 'chatbot_message'
    });
    reply('disabled');
    await expect(result).resolves.toBeUndefined();
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('cleans up on cancellation and refuses an already-aborted request', async () => {
    const controller = new AbortController();
    const getToken = createChatbotChallengeTokenProvider();
    const result = getToken({
      chatbotId: 'bot',
      action: 'chatbot_message',
      signal: controller.signal
    });
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: 'ABORTED' });
    expect(document.querySelector('iframe')).toBeNull();
    await expect(
      getToken({
        chatbotId: 'bot',
        action: 'chatbot_message',
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });
  it.each([
    'error',
    'timeout'
  ])('cleans up on %s without silently bypassing a failed challenge', async (kind) => {
    vi.useFakeTimers();
    const result = createChatbotChallengeTokenProvider()({
      chatbotId: 'bot',
      action: 'chatbot_message'
    });
    const assertion = expect(result).rejects.toMatchObject({
      code: 'TURNSTILE_VERIFICATION_UNAVAILABLE'
    });
    if (kind === 'error') reply('error');
    else vi.advanceTimersByTime(120_000);
    await assertion;
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('shares enforcement across page clients, scopes it to API and chatbot, and never caches tokens', async () => {
    const getChallengeToken = vi.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two');
    const options = {
      baseUrl: 'https://dev-api.moreflow.io',
      getChallengeToken
    };
    const first = createChatbotChallengeSession(options);
    const remounted = createChatbotChallengeSession(options);
    expect(first.isRequired('session-bot')).toBe(false);
    expect(getChallengeToken).not.toHaveBeenCalled();
    first.require('session-bot');
    expect(remounted.isRequired('session-bot')).toBe(true);
    expect(remounted.isRequired('other-bot')).toBe(false);
    expect(
      createChatbotChallengeSession({
        baseUrl: 'https://api.moreflow.io'
      }).isRequired('session-bot')
    ).toBe(false);
    await expect(first.getToken('session-bot')).resolves.toBe('one');
    await expect(remounted.getToken('session-bot')).resolves.toBe('two');
    expect(getChallengeToken).toHaveBeenCalledTimes(2);
  });

  it('clears a learned requirement when enforcement is disabled during the page session', async () => {
    const challenge = createChatbotChallengeSession({
      getChallengeToken: async () => undefined
    });
    challenge.require('disabled-after-enable');
    await challenge.getToken('disabled-after-enable');
    expect(challenge.isRequired('disabled-after-enable')).toBe(false);
  });
});
