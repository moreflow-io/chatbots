import type { ChatbotErrorCode } from './errors';
import { isRecord } from './internal/values';

interface ErrorCopy {
  /** German, addressing the visitor with "du". */
  de: string;
  /** German with "Sie", when it differs from the "du" text. */
  deFormal?: string;
  en: string;
}

// Visitor copy for a failed security check; the web widget shows the same text.
const challengeFailureCopy: ErrorCopy = {
  de: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuche es erneut.',
  deFormal: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  en: 'Security verification failed. Please try again.'
};

/** Visitor-facing copy never exposes developer messages or raw response bodies. */
const errorCopy = {
  ABORTED: { de: 'Die Anfrage wurde abgebrochen.', en: 'The request was cancelled.' },
  NETWORK_ERROR: {
    de: 'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.',
    deFormal: 'Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    en: 'The connection failed. Please try again.'
  },
  FETCH_UNAVAILABLE: {
    de: 'Der Chat kann in dieser Umgebung nicht verwendet werden.',
    en: 'This chat cannot be used in this environment.'
  },
  VALIDATION_ERROR: {
    de: 'Bitte überprüfe deine Eingabe.',
    deFormal: 'Bitte überprüfen Sie Ihre Eingabe.',
    en: 'Please check your entry.'
  },
  INVALID_RESPONSE: {
    de: 'Der Server hat unerwartet geantwortet. Bitte versuche es erneut.',
    deFormal: 'Der Server hat unerwartet geantwortet. Bitte versuchen Sie es erneut.',
    en: 'The server sent an unexpected response. Please try again.'
  },
  REQUEST_FAILED: {
    de: 'Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.',
    deFormal: 'Die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    en: 'The request failed. Please try again.'
  },
  STREAM_INCOMPLETE: {
    de: 'Die Antwort wurde unterbrochen. Bitte versuche es erneut.',
    deFormal: 'Die Antwort wurde unterbrochen. Bitte versuchen Sie es erneut.',
    en: 'The reply was interrupted. Please try again.'
  },
  THREAD_REQUIRED: {
    de: 'Bitte beginne zuerst ein Gespräch.',
    deFormal: 'Bitte beginnen Sie zuerst ein Gespräch.',
    en: 'Please start a conversation first.'
  },
  NOT_FOUND: { de: 'Dieser Chat ist nicht verfügbar.', en: 'This chat is unavailable.' },
  FORBIDDEN: { de: 'Diese Anfrage ist nicht erlaubt.', en: 'This request is not allowed.' },
  AUTH_ERROR: {
    de: 'Der Zugriff auf diesen Chat ist nicht möglich. Bitte lade die Seite neu.',
    deFormal: 'Der Zugriff auf diesen Chat ist nicht möglich. Bitte laden Sie die Seite neu.',
    en: 'This chat cannot be accessed. Please reload the page.'
  },
  CHATBOT_CONSENT_REQUIRED: {
    de: 'Bitte stimme den erforderlichen Einwilligungen zu, bevor du eine Nachricht sendest.',
    deFormal: 'Bitte stimmen Sie den erforderlichen Einwilligungen zu, bevor Sie eine Nachricht senden.',
    en: 'Please grant the required consent before sending a message.'
  },
  CHATBOT_CONSENT_WORDING_CHANGED: {
    de: 'Der Einwilligungstext hat sich geändert. Bitte überprüfe ihn und bestätige deine Auswahl erneut.',
    deFormal: 'Der Einwilligungstext hat sich geändert. Bitte überprüfen Sie ihn und bestätigen Sie Ihre Auswahl erneut.',
    en: 'The consent text has changed. Please review it and confirm your choices again.'
  },
  CHATBOT_CONSENT_NOT_REQUESTED: {
    de: 'Diese Einwilligung ist nicht mehr verfügbar. Bitte lade den Chat neu.',
    deFormal: 'Diese Einwilligung ist nicht mehr verfügbar. Bitte laden Sie den Chat neu.',
    en: 'This consent option is no longer available. Please reload the chat.'
  },
  POLICY_VALIDATION_FAILED: {
    de: 'Die Antwort konnte nicht angezeigt werden. Bitte formuliere deine Nachricht anders.',
    deFormal: 'Die Antwort konnte nicht angezeigt werden. Bitte formulieren Sie Ihre Nachricht anders.',
    en: 'The reply could not be displayed. Please rephrase your message.'
  },
  RATE_LIMIT: {
    de: 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.',
    deFormal: 'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
    en: 'Too many attempts. Please wait a moment and try again.'
  },
  IDEMPOTENCY_IN_PROGRESS: {
    de: 'Deine Nachricht wird noch verarbeitet. Bitte warte einen Moment und versuche es dann erneut.',
    deFormal: 'Ihre Nachricht wird noch verarbeitet. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
    en: 'Your message is still being processed. Please wait a moment and try again.'
  },
  IDEMPOTENCY_CONFLICT: {
    de: 'Diese Nachricht kann nicht erneut gesendet werden. Bitte lade den Chat neu und prüfe den Verlauf, bevor du eine neue Nachricht sendest.',
    deFormal: 'Diese Nachricht kann nicht erneut gesendet werden. Bitte laden Sie den Chat neu und prüfen Sie den Verlauf, bevor Sie eine neue Nachricht senden.',
    en: 'This message cannot be retried. Please reload the chat and check its history before sending a new message.'
  },
  INVALID_STATE: {
    de: 'Der Status deiner letzten Nachricht konnte nicht bestätigt werden. Bitte lade den Chat neu. Falls keine Antwort erscheint, kontaktiere den Betreiber, bevor du die Nachricht erneut sendest.',
    deFormal: 'Der Status Ihrer letzten Nachricht konnte nicht bestätigt werden. Bitte laden Sie den Chat neu. Falls keine Antwort erscheint, kontaktieren Sie den Betreiber, bevor Sie die Nachricht erneut senden.',
    en: 'The status of your last message could not be confirmed. Please reload the chat. If no reply appears, contact the chat operator before sending it again.'
  },
  TURNSTILE_TOKEN_REQUIRED: challengeFailureCopy,
  TURNSTILE_TOKEN_INVALID: challengeFailureCopy,
  TURNSTILE_ACTION_MISMATCH: challengeFailureCopy,
  TURNSTILE_HOSTNAME_NOT_ALLOWED: challengeFailureCopy,
  TURNSTILE_VERIFICATION_UNAVAILABLE: challengeFailureCopy,
  INTERNAL_ERROR: {
    de: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.',
    deFormal: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    en: 'An unexpected error occurred. Please try again.'
  }
} satisfies Record<ChatbotErrorCode, ErrorCopy>;

export interface DescribeChatbotErrorOptions {
  /** Defaults to German. */
  locale?: 'de' | 'en' | undefined;
  /** German uses "du" by default, or "Sie" when formal. */
  formality?: 'formal' | 'informal' | undefined;
}

export interface ChatbotErrorDescription {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds: number | undefined;
  /** The original error, retained for logging. */
  cause: unknown;
}

/** Describes a caught failure safely for visitors while retaining the original error. */
export function describeChatbotError(
  error: unknown,
  options: DescribeChatbotErrorOptions = {}
): ChatbotErrorDescription {
  const fields = isRecord(error) ? error : {};
  const code = typeof fields.code === 'string' && fields.code.trim() ? fields.code : 'REQUEST_FAILED';
  const retryable = fields.retryable === true;
  const copies: Readonly<Record<string, ErrorCopy>> = errorCopy;
  const known = code !== 'REQUEST_FAILED' && Object.hasOwn(copies, code) ? copies[code] : undefined;
  const copy =
    known ??
    (code === 'RATE_LIMITED' || fields.status === 429
      ? errorCopy.RATE_LIMIT
      : retryable
        ? errorCopy.NETWORK_ERROR
        : errorCopy.REQUEST_FAILED);
  const delay = fields.retryAfterSeconds;
  return {
    code,
    message: options.locale === 'en'
      ? copy.en
      : options.formality === 'formal' ? (copy.deFormal ?? copy.de) : copy.de,
    retryable,
    retryAfterSeconds: typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
      ? delay : undefined,
    cause: error
  };
}
