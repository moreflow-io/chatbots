import { MoreflowChatbotError, streamIncompleteError } from './errors';
import type { ChatbotClient, ChatbotRequestOptions } from './index';
import type { ChatbotSendResult } from './public-types';
import { trackWebsiteConversion } from './internal/conversion-tracking';
import { identifyWebsiteVisitor } from './internal/visitor-identify';

/** Fall back only for a transport failure, preserving the same logical request id. */
export function canFallbackChatbotStream(error: unknown): boolean {
  if (!(error instanceof MoreflowChatbotError)) return false;
  return ['NETWORK_ERROR', 'STREAM_INCOMPLETE', 'INVALID_RESPONSE'].includes(error.code) ||
    [404, 405, 406, 415, 501].includes(error.status ?? 0);
}

/**
 * Sends a session message and, once the lead funnel linked a CRM contact, passes its id to the analytics
 * tracker identify, which refuses without analytics consent (website-analytics D-decision, option c).
 */
export async function sendSessionMessage(
  client: ChatbotClient,
  input: Parameters<ChatbotClient['send']>[0],
  options: ChatbotRequestOptions,
  onDelta: (text: string) => void
): Promise<ChatbotSendResult> {
  const result = await streamOrSend(client, input, options, onDelta);
  identifyWebsiteVisitor(result?.clientId);
  // A message is not a lead: the conversion is the send that created the CRM lead, once per conversation.
  if (result?.clientCreated === true) trackWebsiteConversion('chatbot_lead_created', { chatbot_id: client.chatbotId });
  return result;
}

async function streamOrSend(
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
