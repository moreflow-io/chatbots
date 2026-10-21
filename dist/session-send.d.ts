import type { ChatbotClient, ChatbotRequestOptions } from './index';
import type { ChatbotSendResult } from './public-types';
/** Fall back only for a transport failure, preserving the same logical request id. */
export declare function canFallbackChatbotStream(error: unknown): boolean;
export declare function sendSessionMessage(client: ChatbotClient, input: Parameters<ChatbotClient['send']>[0], options: ChatbotRequestOptions, onDelta: (text: string) => void): Promise<ChatbotSendResult>;
