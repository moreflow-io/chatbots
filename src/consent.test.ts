import { describe, expect, it } from 'vitest';
import {
  type ChatbotLeadConsentRequest,
  chatbotLeadConsentAnswers,
  chatbotLeadConsentFromError,
  createChatbotClient,
  createMemoryStorage,
  MoreflowChatbotError,
  missingRequiredChatbotLeadConsent,
  normalizeChatbotConfig
} from './index';

const chatbotId = '3f1a9c02-5b6d-4e71-9c8a-2d4f6b8e0a13';
const marketing: ChatbotLeadConsentRequest = {
  purpose: 'marketing_email',
  text: 'Send me offers by email.',
  wordingVersion: `chatbot:${chatbotId}:b3bd1f8b8bb0`,
  required: true
};
const tracking: ChatbotLeadConsentRequest = {
  purpose: 'email_tracking',
  text: 'Track whether you open our emails.',
  wordingVersion: `chatbot:${chatbotId}:0a1b2c3d4e5f`,
  required: false
};

describe('lead consent', () => {
  it('normalizes the requested purposes from the public config and drops malformed entries', () => {
    const config = normalizeChatbotConfig({
      id: chatbotId,
      name: 'Assistant',
      mode: 'funnel',
      lead_consent: [marketing, { purpose: 'unknown', text: 'x', wordingVersion: 'v' }, { ...tracking, required: 'yes' }]
    });
    expect(config.leadConsent).toEqual([marketing, tracking]);
    expect(normalizeChatbotConfig({ id: chatbotId }).leadConsent).toEqual([]);
  });

  it('builds answers only for decided purposes and reports required purposes not granted', () => {
    const answers = chatbotLeadConsentAnswers([marketing, tracking], { email_tracking: false });
    expect(answers).toEqual([{ purpose: 'email_tracking', granted: false, wordingVersion: tracking.wordingVersion }]);
    expect(missingRequiredChatbotLeadConsent([marketing, tracking], answers)).toEqual([marketing]);

    const granted = chatbotLeadConsentAnswers([marketing, tracking], { marketing_email: true });
    expect(missingRequiredChatbotLeadConsent([marketing, tracking], granted)).toEqual([]);
    // A grant for older wording does not satisfy the current text.
    expect(
      missingRequiredChatbotLeadConsent([marketing], [{ ...granted[0]!, wordingVersion: 'chatbot:old:000000000000' }])
    ).toEqual([marketing]);
  });

  it('reads the requests to show from consent errors', () => {
    const required = new MoreflowChatbotError({
      message: 'The visitor must agree to the required consent before chatting.',
      code: 'CHATBOT_CONSENT_REQUIRED',
      details: { required: [marketing] }
    });
    expect(chatbotLeadConsentFromError(required)).toEqual([marketing]);
    const changed = new MoreflowChatbotError({
      message: 'The consent text changed since it was loaded.',
      code: 'CHATBOT_CONSENT_WORDING_CHANGED',
      details: marketing
    });
    expect(chatbotLeadConsentFromError(changed)).toEqual([marketing]);
    expect(chatbotLeadConsentFromError(new MoreflowChatbotError({ message: 'x', code: 'NOT_FOUND' }))).toEqual([]);
    expect(chatbotLeadConsentFromError(new Error('x'))).toEqual([]);
  });

  it('sends consent answers with the message and surfaces a refused message as a consent error', async () => {
    const bodies: unknown[] = [];
    const responses = [
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CHATBOT_CONSENT_REQUIRED',
            message: 'The visitor must agree to the required consent before chatting.',
            details: { required: [marketing] }
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
      new Response(JSON.stringify({ success: true, data: { threadId: 'thread-1', response: 'Hi.' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    ];
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      trackingCapture: () => ({}),
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return responses.shift()!;
      }
    });

    const refused = await client.send({ message: 'Hello' }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(MoreflowChatbotError);
    expect(chatbotLeadConsentFromError(refused)).toEqual([marketing]);

    const consent = chatbotLeadConsentAnswers([marketing], { marketing_email: true });
    await expect(client.send({ message: 'Hello', consent })).resolves.toMatchObject({ threadId: 'thread-1' });
    expect(bodies[1]).toMatchObject({ chatbotId, visitorId: 'visitor-1', message: 'Hello', consent });
    expect(client.getThreadId()).toBe('thread-1');
  });
});
