import type { ChatbotOperationTransport, CreateChatbotOperationTransportOptions } from './index';
export declare const chatbotOperationIds: {
    readonly getPublic: 'chatbots.embed.getPublic';
    readonly messagesList: 'chatbots.embed.messages.list';
    readonly messagesSend: 'chatbots.embed.messages.send';
    readonly messageRatingsList: 'chatbots.embed.messageRatings.list';
    readonly messageRatingsSet: 'chatbots.embed.messageRatings.set';
};
/** Normalizes both Moreflow operation envelopes and direct operation payloads. */
export declare function normalizeChatbotOperationPayload<T = unknown>(payload: unknown): T;
export declare function createChatbotOperationTransport(options?: CreateChatbotOperationTransportOptions): ChatbotOperationTransport;
