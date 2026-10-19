import { MoreflowChatbotError } from './errors';

/**
 * Lead consent for public chatbots. The public config lists the purposes the chatbot asks for
 * with the account's own text; a client shows that text verbatim and sends the visitor's decision
 * with a message. A required purpose must be granted before the chatbot accepts messages, and each
 * new thread is a new conversation that needs its own consent.
 */
export const chatbotLeadConsentPurposes = ['marketing_email', 'email_tracking'] as const;
export type ChatbotLeadConsentPurpose = (typeof chatbotLeadConsentPurposes)[number];

/** One purpose the chatbot asks the visitor about. */
export interface ChatbotLeadConsentRequest {
  purpose: ChatbotLeadConsentPurpose;
  /** The account-authored text. Show it verbatim; Moreflow does not author consent wording. */
  text: string;
  /** Identifies the text the visitor saw; send it back with the answer. */
  wordingVersion: string;
  /** When true, the chatbot refuses messages until the visitor grants this purpose. */
  required: boolean;
}

/** The visitor's decision for one requested purpose, sent with `send({ message, consent })`. */
export interface ChatbotLeadConsentAnswer {
  purpose: ChatbotLeadConsentPurpose;
  granted: boolean;
  wordingVersion: string;
}

export const chatbotConsentErrorCodes = {
  /** A required purpose is not granted; `details.required` lists the requests to show. */
  required: 'CHATBOT_CONSENT_REQUIRED',
  /** The account changed the text since the config was loaded; `details` is the current request. */
  wordingChanged: 'CHATBOT_CONSENT_WORDING_CHANGED',
  /** The answer names a purpose the chatbot does not ask for. */
  notRequested: 'CHATBOT_CONSENT_NOT_REQUESTED'
} as const;

function consentPurpose(value: unknown): ChatbotLeadConsentPurpose | undefined {
  return chatbotLeadConsentPurposes.find((purpose) => purpose === value);
}

function consentRequest(value: unknown): ChatbotLeadConsentRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const purpose = consentPurpose(record.purpose);
  const text = typeof record.text === 'string' ? record.text : '';
  const wordingVersion = typeof record.wordingVersion === 'string' ? record.wordingVersion : '';
  if (!purpose || !text || !wordingVersion) return null;
  return { purpose, text, wordingVersion, required: record.required === true };
}

/** Reads the requested purposes from the public config; malformed entries are dropped. */
export function normalizeChatbotLeadConsent(value: unknown): ChatbotLeadConsentRequest[] {
  return Array.isArray(value) ? value.flatMap((entry) => consentRequest(entry) ?? []) : [];
}

/**
 * Builds the answers for a message from the visitor's decisions, keyed by purpose. Purposes
 * without a decision are left out, so the chatbot may still ask about them in the conversation.
 */
export function chatbotLeadConsentAnswers(
  requests: readonly ChatbotLeadConsentRequest[],
  decisions: Partial<Record<ChatbotLeadConsentPurpose, boolean>>
): ChatbotLeadConsentAnswer[] {
  return requests.flatMap((request) => {
    const granted = decisions[request.purpose];
    return typeof granted === 'boolean'
      ? [{ purpose: request.purpose, granted, wordingVersion: request.wordingVersion }]
      : [];
  });
}

/** The required requests the answers do not grant: a client can block sending until this is empty. */
export function missingRequiredChatbotLeadConsent(
  requests: readonly ChatbotLeadConsentRequest[],
  answers: readonly ChatbotLeadConsentAnswer[] = []
): ChatbotLeadConsentRequest[] {
  return requests.filter(
    (request) =>
      request.required &&
      !answers.some(
        (answer) =>
          answer.purpose === request.purpose &&
          answer.granted &&
          answer.wordingVersion === request.wordingVersion
      )
  );
}

/**
 * The consent requests a consent error asks the client to show: the required requests for
 * `CHATBOT_CONSENT_REQUIRED`, the current request for `CHATBOT_CONSENT_WORDING_CHANGED`, otherwise none.
 */
export function chatbotLeadConsentFromError(error: unknown): ChatbotLeadConsentRequest[] {
  if (!(error instanceof MoreflowChatbotError)) return [];
  const details =
    error.details && typeof error.details === 'object' ? (error.details as Record<string, unknown>) : {};
  if (error.code === chatbotConsentErrorCodes.required) return normalizeChatbotLeadConsent(details.required);
  if (error.code === chatbotConsentErrorCodes.wordingChanged) {
    const current = consentRequest(details);
    return current ? [current] : [];
  }
  return [];
}
