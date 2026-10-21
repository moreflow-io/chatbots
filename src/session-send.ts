import { MoreflowChatbotError, streamIncompleteError } from './errors';
import type { ChatbotClient, ChatbotRequestOptions } from './index';
import type { ChatbotSendResult } from './public-types';

/** Fall back only for a transport failure, preserving the same logical request id. */
export function canFallbackChatbotStream(error: unknown): boolean {
  if (!(error instanceof MoreflowChatbotError)) return false;
  return ['NETWORK_ERROR', 'STREAM_INCOMPLETE', 'INVALID_RESPONSE'].includes(error.code) ||
    [404, 405, 406, 415, 501].includes(error.status ?? 0);
}

export async function sendSessionMessage(
  client: ChatbotClient,
  input: Parameters<ChatbotClient['send']>[0],
  options: ChatbotRequestOptions,
  onDelta: (text: string) => void
): Promise<ChatbotSendResult> {
  try {
    for await (const event of client.sendStream(input, options)) {
      if (event.type === 'message.delta') onDelta(event.delta);
      if (event.type === 'message.error') throw event.error;
      if (event.type === 'message.complete') return event.result;
    }
    throw streamIncompleteError();
  } catch (error) {
    if (options.signal?.aborted || !canFallbackChatbotStream(error)) throw error;
    return client.send(input, options);
  }
}
