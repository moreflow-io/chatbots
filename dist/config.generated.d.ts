export type ChatbotPublicSettings = {
    welcomeMessage?: string | undefined;
    language?: ("de") | ("en") | undefined;
    metaPixelId?: string | undefined;
    metaEventChatStarted?: string | undefined;
    metaEventLeadCreated?: string | undefined;
    tiktokPixelId?: string | undefined;
    tiktokEventLeadCreated?: string | undefined;
};
export type ChatbotPublicEmbedSettings = {
    primaryColor?: string | undefined;
    widgetPosition?: ("bottom_right") | ("bottom_left") | undefined;
    teaser?: {
        enabled?: boolean | undefined;
        messages?: Array<{
            text: string;
        }> | undefined;
    } | undefined;
};
export type ChatbotPublicImageFields = {
    avatarUrl: (string) | (null);
    companyLogoUrl: (string) | (null);
};
export type ChatbotMessageRole = ("visitor") | ("assistant") | ("agent") | ("system");
