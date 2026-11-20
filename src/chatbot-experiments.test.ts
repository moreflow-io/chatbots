import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatbotClient, createMemoryStorage } from './index';

// The chatbot opener experiment in the client (moreflow-bfdek.11): the public read sends the page view's
// visitor key, the assigned opener is served, the exposure is recorded once, and the messages carry the variant.
const warmOpener = 'Hallo! Soll ich Ihnen ein Angebot machen?';

function stubTracker(tracker: unknown) {
  vi.stubGlobal('window', { moreflowAnalytics: tracker });
}

function operationResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

/** The public read as the server answers it: the opener of the assigned variant (or the chatbot's own), and the experiment. */
function publicConfig(chatbotId: string, opener: { welcomeMessage: string; quickReplies?: string[] }, experiment: unknown) {
  return {
    chatbot: {
      id: chatbotId,
      name: 'Funnel assistant',
      mode: 'funnel',
      settings: { language: 'de', welcomeMessage: opener.welcomeMessage },
      embedSettings: {},
      leadFields: [],
      funnelSettings: {},
      supportSettings: {},
      leadConsent: [],
      ...(opener.quickReplies ? { quickReplies: opener.quickReplies } : {})
    },
    experiment,
    trace: {}
  };
}

const ownOpener = { welcomeMessage: 'Hallo, wie kann ich helfen?' };
const warmAssigned = { welcomeMessage: warmOpener, quickReplies: ['Preise', 'Termin'] };

/** Serves the public read with the given opener and experiment, and records the body of every operation call. */
function fakeFetch(
  chatbotId: string,
  answer: { opener: { welcomeMessage: string; quickReplies?: string[] }; experiment: unknown },
  bodies: Array<Record<string, unknown>>
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    bodies.push({ url, ...body });
    if (url.endsWith('chatbots.embed.getPublic')) return operationResponse(publicConfig(chatbotId, answer.opener, answer.experiment));
    return operationResponse({ threadId: 'thread-1' });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chatbot opener experiment in the client', () => {
  it('sends a page visitor key, serves the assigned opener, records the exposure once and sends the variant with messages', async () => {
    const chatbotId = 'chatbot-opener-warm';
    const track = vi.fn();
    stubTracker({ track });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-1',
      fetchImpl: fakeFetch(chatbotId, { opener: warmAssigned, experiment: { key: 'opener', variant: 'warm' } }, bodies)
    });

    const config = await client.loadConfig();
    expect(config.settings.welcomeMessage).toBe(warmOpener);
    expect(config.quickReplies).toEqual(['Preise', 'Termin']);
    const read = bodies.find((body) => String(body.url).endsWith('chatbots.embed.getPublic'));
    expect(read?.visitorKey).toEqual(expect.any(String));
    expect(String(read?.visitorKey).length).toBeGreaterThan(0);

    await client.loadConfig();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('exposure', { experiment: 'opener', variant: 'warm' });

    await client.send({ message: 'Ich suche ein Angebot' });
    const send = bodies.find((body) => String(body.url).endsWith('chatbots.embed.messages.send'));
    expect(send?.experimentVariants).toEqual([{ experiment: 'opener', variant: 'warm' }]);
  });

  it('serves the chatbot’s own opener, records nothing and sends no variant when no experiment is assigned', async () => {
    const chatbotId = 'chatbot-opener-control';
    const track = vi.fn();
    stubTracker({ track });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-2',
      fetchImpl: fakeFetch(chatbotId, { opener: ownOpener, experiment: null }, bodies)
    });

    const config = await client.loadConfig();
    expect(config.settings.welcomeMessage).toBe('Hallo, wie kann ich helfen?');
    expect(config.quickReplies).toBeUndefined();
    expect(track).not.toHaveBeenCalled();

    await client.send({ message: 'Hallo' });
    const send = bodies.find((body) => String(body.url).endsWith('chatbots.embed.messages.send'));
    expect(send).not.toHaveProperty('experimentVariants');
  });

  it('keeps reading when the tracker throws, and still sends the assignment', async () => {
    const chatbotId = 'chatbot-opener-broken-tracker';
    stubTracker({
      track: () => {
        throw new Error('tracker down');
      }
    });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({
      chatbotId,
      storage: createMemoryStorage(),
      randomId: () => 'visitor-3',
      fetchImpl: fakeFetch(chatbotId, { opener: warmAssigned, experiment: { key: 'opener', variant: 'warm' } }, bodies)
    });

    const config = await client.loadConfig();
    expect(config.settings.welcomeMessage).toBe(warmOpener);
    await client.send({ message: 'Hallo' });
    const send = bodies.find((body) => String(body.url).endsWith('chatbots.embed.messages.send'));
    expect(send?.experimentVariants).toEqual([{ experiment: 'opener', variant: 'warm' }]);
  });
});
