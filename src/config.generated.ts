// Generated from the canonical chatbot operation output schemas by scripts/generate-chatbot-sdk-types.ts.
export type ChatbotPublicSettings = ({ welcomeMessage?: (string) | (null) | undefined; }) & (Record<string, unknown>);
export type ChatbotPublicEmbedSettings = ({ primaryColor?: string | undefined; teaser?: ({ enabled?: boolean | undefined; messages?: Array<({ text: string; }) & (Record<string, unknown>)> | undefined; }) & (Record<string, unknown>) | undefined; }) & (Record<string, unknown>);
export type ChatbotPublicImageFields = { avatarUrl: (string) | (null); companyLogoUrl: (string) | (null); };
export type ChatbotMessageRole = ("visitor") | ("assistant") | ("agent") | ("system");
