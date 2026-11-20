import type { ChatbotClient, ChatbotRequestOptions } from './index';
import type { ChatbotSendResult } from './public-types';
/** Fall back only for a transport failure, preserving the same logical request id. */
export declare function canFallbackChatbotStream(error: unknown): boolean;
/**
 * Sends a session message and, once the lead funnel linked a CRM contact, passes its id to the analytics
 * tracker identify, which refuses without analytics consent (website-analytics D-decision, option c).
 */
export declare function sendSessionMessage(client: ChatbotClient, input: Parameters<ChatbotClient['send']>[0], options: ChatbotRequestOptions, onDelta: (text: string) => void): Promise<ChatbotSendResult>;
