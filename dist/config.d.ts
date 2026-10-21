import type { ChatbotPublicConfig, ChatbotPublicConfigResponse } from './public-types';
/** Converts public API records to one camel-case representation with camel-case precedence. */
export declare function normalizeChatbotConfig(value: unknown): ChatbotPublicConfig;
export declare function normalizeChatbotPublicConfig(value: unknown): ChatbotPublicConfigResponse;
