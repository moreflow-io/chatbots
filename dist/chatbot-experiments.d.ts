/**
 * The chatbot experiment of the current page view (docs/growth-loop.md Phase 2, docs/website-analytics.md §7.3):
 * the server assigns the visitor to a variant of the opener, the client keeps the assignment in memory for
 * the page view, records the exposure through the served tracker once, and sends the variant with the
 * visitor's messages. Nothing is stored, and nothing throws: a server, a missing tracker or a broken tracker
 * just gets no exposure.
 */
export type ChatbotPageExperiment = {
    experiment: string;
    variant: string;
};
export declare function chatbotPageVisitorKey(): string;
/** Keeps the assignment of a chatbot for the page view; null (no experiment) forgets it. */
export declare function rememberChatbotExperiment(chatbotId: string, experiment: ChatbotPageExperiment | null): void;
export declare function chatbotExperimentFor(chatbotId: string): ChatbotPageExperiment | undefined;
/** Reads the `experiment` of a public config response; anything that is not `{ key, variant }` strings is no assignment. */
export declare function experimentFromChatbotConfig(value: unknown): ChatbotPageExperiment | null;
/**
 * Records the exposure through the served tracker, once per page view and variant. Guarded: never throws.
 * Without a window (a server) or a tracker, nothing is recorded.
 */
export declare function trackChatbotExposure(chatbotId: string, experiment: ChatbotPageExperiment): void;
/** The page's assignments for a message: the chatbot's own first, then the tracker's; one entry per experiment key. */
export declare function mergeChatbotExperimentVariants(chatbotAssignment: ChatbotPageExperiment | undefined, pageAssignments: readonly ChatbotPageExperiment[]): ChatbotPageExperiment[];
