import type { ChatbotMessageRole, ChatbotPublicEmbedSettings, ChatbotPublicImageFields, ChatbotPublicSettings } from './config.generated';
import type { ChatbotLeadConsentRequest } from './consent';
import type { CanonicalChatbotRecord, ChatbotAccountId, ChatbotClientId } from './index';
export type { ChatbotMessageRole, ChatbotPublicEmbedSettings, ChatbotPublicSettings } from './config.generated';
export type ChatbotPublicConfig = CanonicalChatbotRecord & {
    id: string;
    name: string;
    mode: string;
    accountId?: ChatbotAccountId | undefined;
    description?: string | undefined;
    settings: ChatbotPublicSettings;
    embedSettings: ChatbotPublicEmbedSettings;
    leadFields: CanonicalChatbotRecord[];
    funnelSettings: CanonicalChatbotRecord;
    supportSettings: CanonicalChatbotRecord;
    avatarStorageId?: string | undefined;
    avatarUrl?: ChatbotPublicImageFields['avatarUrl'] | undefined;
    companyLogoUrl?: ChatbotPublicImageFields['companyLogoUrl'] | undefined;
    /** The lead consent purposes the chatbot asks for; empty when it asks for none. */
    leadConsent: ChatbotLeadConsentRequest[];
};
export interface ChatbotPublicConfigResponse {
    chatbot: ChatbotPublicConfig;
    trace?: Record<string, unknown> | undefined;
}
export interface ChatbotMessage {
    id: string;
    role: ChatbotMessageRole;
    text: string;
    status?: string | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    [key: string]: unknown;
}
export interface ChatbotMessagesPage {
    items: ChatbotMessage[];
    hasMore: boolean;
    nextCursor?: string | undefined;
    trace?: Record<string, unknown> | undefined;
}
export interface ChatbotMessageRating {
    chatbotId: string;
    threadId: string;
    messageId: string;
    visitorId: string;
    rating: 'up' | 'down' | null;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    [key: string]: unknown;
}
export interface ChatbotSendResult {
    threadId?: string | undefined;
    response?: string | undefined;
    assistantMessageId?: string | undefined;
    conversationId?: string | undefined;
    success?: boolean | undefined;
    clientCreated?: boolean | undefined;
    clientId?: ChatbotClientId | undefined;
    [key: string]: unknown;
}
