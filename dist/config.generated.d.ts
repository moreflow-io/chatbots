export type ChatbotPublicSettings = {
    welcomeMessage?: string | undefined;
    language?: ("de") | ("en") | undefined;
    addressForm: ("formal") | ("informal");
    metaPixelId?: string | undefined;
    metaEventChatStarted?: string | undefined;
    metaEventLeadCreated?: string | undefined;
    tiktokPixelId?: string | undefined;
    tiktokEventLeadCreated?: string | undefined;
    openAiPixelId?: string | undefined;
    adsTracking?: boolean | undefined;
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
    adsConsentSource?: ("widget_prompt") | ("website_consent") | undefined;
};
export type ChatbotPublicImageFields = {
    avatarUrl: (string) | (null);
    companyLogoUrl: (string) | (null);
};
export type ChatbotMessageRole = ("visitor") | ("assistant") | ("agent") | ("system");
