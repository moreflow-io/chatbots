import type { ChatbotClient } from './index';
import type { ChatbotSession, ChatbotSessionOptions } from './session-types';
/** A headless chat store. Layout, composer text, focus and teaser timing belong to the client. */
export declare function createChatbotSession(client: ChatbotClient, options?: ChatbotSessionOptions): ChatbotSession;
