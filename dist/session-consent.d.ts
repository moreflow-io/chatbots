import { type ChatbotLeadConsentRequest } from './consent';
import type { ChatbotSessionConsent } from './session-types';
export declare function sessionConsent(requests: readonly ChatbotLeadConsentRequest[], decisions: ChatbotSessionConsent['decisions'], confirmed: boolean, hasThread: boolean): ChatbotSessionConsent;
export declare function sessionConsentAnswers(state: Pick<ChatbotSessionConsent, 'requests' | 'decisions'>): import("./consent").ChatbotLeadConsentAnswer[];
