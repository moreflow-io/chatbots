import type { ChatbotClient } from './index';
import type { ChatbotSession, ChatbotSessionOptions, ChatbotSessionSnapshot } from './session-types';
/**
 * Runs a headless chatbot session and subscribes React to its snapshots.
 * A new client, locale or formality creates a new session; other options are read at creation.
 */
export declare function useChatbot(client: ChatbotClient, options?: ChatbotSessionOptions): {
    session: ChatbotSession;
    state: ChatbotSessionSnapshot;
};
export type { ChatbotSession, ChatbotSessionOptions, ChatbotSessionSnapshot } from './session-types';
