import {
  type ChatbotLeadConsentRequest,
  chatbotLeadConsentAnswers,
  missingRequiredChatbotLeadConsent
} from './consent';
import type { ChatbotSessionConsent } from './session-types';

export function sessionConsent(
  requests: readonly ChatbotLeadConsentRequest[],
  decisions: ChatbotSessionConsent['decisions'],
  confirmed: boolean,
  hasThread: boolean
): ChatbotSessionConsent {
  return {
    requests,
    decisions,
    confirmed,
    needed: !hasThread && requests.length > 0 && !confirmed,
    missing: hasThread ? [] : missingRequiredChatbotLeadConsent(requests, sessionConsentAnswers({ requests, decisions }))
  };
}

export function sessionConsentAnswers(state: Pick<ChatbotSessionConsent, 'requests' | 'decisions'>) {
  return chatbotLeadConsentAnswers(state.requests, Object.fromEntries(
    Object.entries(state.decisions).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
  ));
}
