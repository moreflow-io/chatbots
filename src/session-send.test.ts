import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatbotClient } from './index';
import type { ChatbotSendResult } from './public-types';
import { sendSessionMessage } from './session-send';

const clientId = '3f2b6c1e-7a4d-4e8b-9c0d-1a2b3c4d5e6f';

function streamingClient(result: ChatbotSendResult): ChatbotClient {
  return {
    async *sendStream() {
      yield { type: 'message.complete', result };
    },
    send: vi.fn()
  } as unknown as ChatbotClient;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a chatbot message that links a CRM contact identifies the visitor (website-analytics D-decision, option c)', () => {
  it('passes the linked client id to the tracker identify', async () => {
    const identify = vi.fn(() => true);
    vi.stubGlobal('window', { moreflowAnalytics: { identify } });
    const result = await sendSessionMessage(streamingClient({ response: 'hi', clientId: clientId as ChatbotSendResult['clientId'] }), { message: 'x' } as never, {}, () => undefined);
    expect(result.response).toBe('hi');
    expect(identify).toHaveBeenCalledExactlyOnceWith(clientId);
  });

  it('does not identify before a contact is linked and works without the tracker', async () => {
    const identify = vi.fn(() => true);
    vi.stubGlobal('window', { moreflowAnalytics: { identify } });
    await sendSessionMessage(streamingClient({ response: 'hi' }), { message: 'x' } as never, {}, () => undefined);
    expect(identify).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    await expect(
      sendSessionMessage(streamingClient({ clientId: clientId as ChatbotSendResult['clientId'] }), { message: 'x' } as never, {}, () => undefined)
    ).resolves.toMatchObject({ clientId });
  });
});
