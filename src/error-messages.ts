import type { ChatbotErrorCode } from './errors';
import { isRecord } from './internal/values';

interface ErrorCopy {
  de: string;
  deInformal?: string;
  en: string;
}

/** Visitor-facing copy never exposes developer messages or raw response bodies. */
const errorCopy = {
  ABORTED: { de: 'Die Anfrage wurde abgebrochen.', en: 'The request was cancelled.' },
  NETWORK_ERROR: {
    de: 'Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    deInformal: 'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.',
    en: 'The connection failed. Please try again.'
  },
  FETCH_UNAVAILABLE: {
    de: 'Der Chat kann in dieser Umgebung nicht verwendet werden.',
    en: 'This chat cannot be used in this environment.'
  },
  VALIDATION_ERROR: {
    de: 'Bitte überprüfen Sie Ihre Eingabe.',
    deInformal: 'Bitte überprüfe deine Eingabe.',
    en: 'Please check your entry.'
  },
  INVALID_RESPONSE: {
    de: 'Der Server hat unerwartet geantwortet. Bitte versuchen Sie es erneut.',
    deInformal: 'Der Server hat unerwartet geantwortet. Bitte versuche es erneut.',
    en: 'The server sent an unexpected response. Please try again.'
  },
  REQUEST_FAILED: {
    de: 'Die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    deInformal: 'Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.',
    en: 'The request failed. Please try again.'
  },
  STREAM_INCOMPLETE: {
    de: 'Die Antwort wurde unterbrochen. Bitte versuchen Sie es erneut.',
    deInformal: 'Die Antwort wurde unterbrochen. Bitte versuche es erneut.',
    en: 'The reply was interrupted. Please try again.'
  },
  THREAD_REQUIRED: {
    de: 'Bitte beginnen Sie zuerst ein Gespräch.',
    deInformal: 'Bitte beginne zuerst ein Gespräch.',
    en: 'Please start a conversation first.'
  },
  NOT_FOUND: { de: 'Dieser Chat ist nicht verfügbar.', en: 'This chat is unavailable.' },
  FORBIDDEN: { de: 'Diese Anfrage ist nicht erlaubt.', en: 'This request is not allowed.' },
  AUTH_ERROR: {
    de: 'Der Zugriff auf diesen Chat ist nicht möglich. Bitte laden Sie die Seite neu.',
    deInformal: 'Der Zugriff auf diesen Chat ist nicht möglich. Bitte lade die Seite neu.',
    en: 'This chat cannot be accessed. Please reload the page.'
  },
  CHATBOT_CONSENT_REQUIRED: {
    de: 'Bitte stimmen Sie den erforderlichen Einwilligungen zu, bevor Sie eine Nachricht senden.',
    deInformal: 'Bitte stimme den erforderlichen Einwilligungen zu, bevor du eine Nachricht sendest.',
    en: 'Please grant the required consent before sending a message.'
  },
  CHATBOT_CONSENT_WORDING_CHANGED: {
    de: 'Der Einwilligungstext hat sich geändert. Bitte überprüfen Sie ihn und bestätigen Sie Ihre Auswahl erneut.',
    deInformal: 'Der Einwilligungstext hat sich geändert. Bitte überprüfe ihn und bestätige deine Auswahl erneut.',
    en: 'The consent text has changed. Please review it and confirm your choices again.'
  },
  CHATBOT_CONSENT_NOT_REQUESTED: {
    de: 'Diese Einwilligung ist nicht mehr verfügbar. Bitte laden Sie den Chat neu.',
    deInformal: 'Diese Einwilligung ist nicht mehr verfügbar. Bitte lade den Chat neu.',
    en: 'This consent option is no longer available. Please reload the chat.'
  },
  POLICY_VALIDATION_FAILED: {
    de: 'Die Antwort konnte nicht angezeigt werden. Bitte formulieren Sie Ihre Nachricht anders.',
    deInformal: 'Die Antwort konnte nicht angezeigt werden. Bitte formuliere deine Nachricht anders.',
    en: 'The reply could not be displayed. Please rephrase your message.'
  },
  RATE_LIMIT: {
    de: 'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
    deInformal: 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.',
    en: 'Too many attempts. Please wait a moment and try again.'
  },
  IDEMPOTENCY_IN_PROGRESS: {
    de: 'Ihre Nachricht wird noch verarbeitet. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
    deInformal: 'Deine Nachricht wird noch verarbeitet. Bitte warte einen Moment und versuche es dann erneut.',
    en: 'Your message is still being processed. Please wait a moment and try again.'
  },
  IDEMPOTENCY_CONFLICT: {
    de: 'Diese Nachricht kann nicht erneut gesendet werden. Bitte laden Sie den Chat neu und prüfen Sie den Verlauf, bevor Sie eine neue Nachricht senden.',
    deInformal: 'Diese Nachricht kann nicht erneut gesendet werden. Bitte lade den Chat neu und prüfe den Verlauf, bevor du eine neue Nachricht sendest.',
    en: 'This message cannot be retried. Please reload the chat and check its history before sending a new message.'
  },
  INVALID_STATE: {
    de: 'Der Status Ihrer letzten Nachricht konnte nicht bestätigt werden. Bitte laden Sie den Chat neu. Falls keine Antwort erscheint, kontaktieren Sie den Betreiber, bevor Sie die Nachricht erneut senden.',
    deInformal: 'Der Status deiner letzten Nachricht konnte nicht bestätigt werden. Bitte lade den Chat neu. Falls keine Antwort erscheint, kontaktiere den Betreiber, bevor du die Nachricht erneut sendest.',
    en: 'The status of your last message could not be confirmed. Please reload the chat. If no reply appears, contact the chat operator before sending it again.'
  },
  INTERNAL_ERROR: {
    de: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    deInformal: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.',
    en: 'An unexpected error occurred. Please try again.'
  }
} satisfies Record<ChatbotErrorCode, ErrorCopy>;

export interface DescribeChatbotErrorOptions {
  /** Defaults to German. */
  locale?: 'de' | 'en' | undefined;
  /** German uses "Sie" by default, or "du" when informal. */
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
      : options.formality === 'informal' ? (copy.deInformal ?? copy.de) : copy.de,
    retryable,
    retryAfterSeconds: typeof delay === 'number' && Number.isFinite(delay) && delay >= 0
      ? delay : undefined,
    cause: error
  };
}
