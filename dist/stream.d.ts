import { MoreflowChatbotError } from './errors';
import type { ChatbotSendResult } from './index';
/**
 * The public chatbot SSE stream: `message.start`, `message.delta`, then exactly one terminal
 * `message.complete` or `message.error`.
 */
export type ChatbotStreamEvent = {
    type: 'message.start';
    data: Record<string, unknown>;
} | {
    type: 'message.delta';
    delta: string;
    data: Record<string, unknown>;
} | {
    type: 'message.complete';
    result: ChatbotSendResult;
    data: Record<string, unknown>;
} | {
    type: 'message.error';
    error: MoreflowChatbotError;
    data: Record<string, unknown>;
};
export declare function parseSse(response: Response, signal: AbortSignal | undefined): AsyncGenerator<ChatbotStreamEvent>;
