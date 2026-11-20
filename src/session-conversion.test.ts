import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatbotClient } from './index';
import type { ChatbotSendResult } from './public-types';
import { sendSessionMessage } from './session-send';

const clientId = '3f2b6c1e-7a4d-4e8b-9c0d-1a2b3c4d5e6f';
const input = { chatbotId: 'chatbot-1', message: 'Hallo', clientMessageId: 'm1' } as unknown as Parameters<ChatbotClient['send']>[0];

function chatClient(result: ChatbotSendResult): ChatbotClient {
  return {
    chatbotId: 'chatbot-1',
    async *sendStream() {
      yield { type: 'message.complete', result };
    },
    send: vi.fn()
  } as unknown as ChatbotClient;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a chatbot send that creates a lead records the chatbot_lead_created conversion (website-analytics §6.1)', () => {
  it('tracks once when the send created the CRM lead, with the chatbot id only', async () => {
    const track = vi.fn();
    vi.stubGlobal('window', { moreflowAnalytics: { track, identify: () => false } });
    await sendSessionMessage(chatClient({ response: 'Gern', clientId, clientCreated: true } as ChatbotSendResult), input, {}, () => {});
    expect(track).toHaveBeenCalledExactlyOnceWith('chatbot_lead_created', { chatbot_id: 'chatbot-1' });
  });

  it('does not track a message that does not create a lead, nor a send without the tracker', async () => {
    const track = vi.fn();
    vi.stubGlobal('window', { moreflowAnalytics: { track } });
    await sendSessionMessage(chatClient({ response: 'Gern', clientId, clientCreated: false } as ChatbotSendResult), input, {}, () => {});
    await sendSessionMessage(chatClient({ response: 'Gern' } as ChatbotSendResult), input, {}, () => {});
    expect(track).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    await expect(
      sendSessionMessage(chatClient({ response: 'Gern', clientId, clientCreated: true } as ChatbotSendResult), input, {}, () => {})
    ).resolves.toMatchObject({ response: 'Gern' });
  });
});
