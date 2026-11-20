import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatbotClient, createMemoryStorage } from './index';

const chatbotId = '3f1a9c02-5b6d-4e71-9c8a-2d4f6b8e0a13';

function stubTracker(tracker: unknown) {
  vi.stubGlobal('window', { moreflowAnalytics: tracker });
}

function operationResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function sentBodies(bodies: Array<Record<string, unknown>>) {
  return async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return operationResponse({ threadId: 'thread-1' });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chatbot messages carry the page experiment variants', () => {
  it('sends the tracker assignments as experimentVariants and reads no storage for them', async () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    stubTracker({ getAssignments: () => [{ experiment: 'chat_opener', variant: 'b' }] });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({ chatbotId, storage: createMemoryStorage(), randomId: () => 'visitor-1', fetchImpl: sentBodies(bodies) });
    await client.send({ message: 'Hallo' });
    expect(bodies[0]?.experimentVariants).toEqual([{ experiment: 'chat_opener', variant: 'b' }]);
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('lets an explicit experimentVariants option replace the page assignments, and [] send none', async () => {
    stubTracker({ getAssignments: () => [{ experiment: 'chat_opener', variant: 'b' }] });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({ chatbotId, storage: createMemoryStorage(), randomId: () => 'visitor-1', fetchImpl: sentBodies(bodies) });
    await client.send({ message: 'Hallo', experimentVariants: [{ experiment: 'cta', variant: 'control' }] });
    await client.send({ message: 'Noch einmal', experimentVariants: [] });
    expect(bodies[0]?.experimentVariants).toEqual([{ experiment: 'cta', variant: 'control' }]);
    expect(bodies[1]?.experimentVariants).toEqual([]);
  });

  it('omits the field without a tracker or when the tracker throws', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({ chatbotId, storage: createMemoryStorage(), randomId: () => 'visitor-1', fetchImpl: sentBodies(bodies) });
    await client.send({ message: 'Eins' });
    stubTracker({ getAssignments: () => { throw new Error('boom'); } });
    await client.send({ message: 'Zwei' });
    expect(bodies.map((body) => body.experimentVariants)).toEqual([undefined, undefined]);
  });
});

describe('chatbot messages carry the page visit reference (docs/website-analytics.md §8.1)', () => {
  const visit = { eventId: 'b_abcdefgh12345678', at: '2026-11-10T12:00:00.000Z' };

  it('sends the tracker reference as visit', async () => {
    stubTracker({ getAssignments: () => [], visitRef: () => visit });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({ chatbotId, storage: createMemoryStorage(), randomId: () => 'visitor-1', fetchImpl: sentBodies(bodies) });
    await client.send({ message: 'Hallo' });
    expect(bodies[0]?.visit).toEqual(visit);
  });

  it('sends no visit without a reference', async () => {
    stubTracker({ getAssignments: () => [], visitRef: () => null });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createChatbotClient({ chatbotId, storage: createMemoryStorage(), randomId: () => 'visitor-1', fetchImpl: sentBodies(bodies) });
    await client.send({ message: 'Eins' });
    expect(bodies[0]).not.toHaveProperty('visit');
  });
});
