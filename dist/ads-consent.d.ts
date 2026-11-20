import type { StorageLike } from '@moreflow/tracking';
import type { ChatbotPublicConfig } from './public-types';
/** A visitor's answer to a chatbot's advertising consent prompt. */
export type ChatbotAdsConsentDecision = 'granted' | 'denied';
/**
 * How a chat client obtains the visitor's advertising consent for a loaded chatbot config:
 *
 * - `widget_prompt`: the chatbot reports leads to Meta, TikTok or ChatGPT Ads (`settings.adsTracking`)
 *   and the account chose the chat's own prompt (`embedSettings.adsConsentSource`, also when the
 *   server does not send it). Ask with an Ablehnen/Zulassen (Decline/Allow) prompt and let the
 *   visitor send only after answering; only Allow is consent, and only Allow lets the client read ad
 *   cookies, whatever the site's banner says.
 * - `website_consent`: the account chose the site's consent banner; the site's consent hook decides
 *   both the advertising consent and the ad cookie access.
 * - `none`: no ad platform receives this chat's leads; ask nothing and send `adsConsent: false`.
 *
 * In every mode the client sends the result as its `adsConsent` option, so the server reports a lead
 * to the ad platforms only with consent.
 */
export type ChatbotAdsConsentMode = 'widget_prompt' | 'website_consent' | 'none';
export declare function chatbotAdsConsentMode(chatbot: Pick<ChatbotPublicConfig, 'settings' | 'embedSettings'>): ChatbotAdsConsentMode;
/** Where a client that asks for advertising consent itself keeps the visitor's answer, per chatbot. */
export declare function chatbotAdsConsentStorageKey(chatbotId: string): string;
/**
 * The visitor's stored answer to this chatbot's advertising consent prompt (`localStorage`, or
 * `storage`), or `null` when they have not answered or storage is blocked. The hosted chat, the
 * script embed and generated custom chats share this answer, so a visitor is asked once per chatbot
 * and browser.
 */
export declare function readChatbotAdsConsent(chatbotId: string, storage?: StorageLike | undefined): ChatbotAdsConsentDecision | null;
/** Stores the visitor's answer; when storage is blocked, the caller's in-memory answer is all there is. */
export declare function storeChatbotAdsConsent(chatbotId: string, decision: ChatbotAdsConsentDecision, storage?: StorageLike | undefined): void;
