export type ChatbotChallengeTokenProvider = (input: {
    chatbotId: string;
    action: 'chatbot_message';
    signal?: AbortSignal | undefined;
}) => Promise<string | undefined>;
export declare function isChatbotChallengeError(error: unknown): boolean;
/** A new iframe per attempt means tokens are never cached, shared, or reused. */
export declare function createChatbotChallengeTokenProvider(options?: {
    baseUrl?: string | undefined;
    title?: string | undefined;
}): ChatbotChallengeTokenProvider;
type ChatbotChallengeOptions = {
    baseUrl?: string | undefined;
    challengeTitle?: string | undefined;
    challengeBaseUrl?: string | undefined;
    getChallengeToken?: ChatbotChallengeTokenProvider | undefined;
};
/** Remember enforcement for this page, never the single-use tokens themselves. */
export declare function createChatbotChallengeSession(options?: ChatbotChallengeOptions): {
    isRequired: (chatbotId: string) => boolean;
    require: (chatbotId: string) => void;
    getToken: (chatbotId: string, signal?: AbortSignal) => Promise<string | undefined>;
};
export declare function freshChatbotChallengeToken(options: ChatbotChallengeOptions, chatbotId: string, signal?: AbortSignal): Promise<string | undefined>;
export {};
