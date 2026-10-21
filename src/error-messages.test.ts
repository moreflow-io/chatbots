import { describe, expect, it, vi } from 'vitest';
import { describeChatbotError } from './error-messages';
import { type ChatbotErrorCode, MoreflowChatbotError, operationError } from './errors';

// Exhaustive so introducing a known code also requires localized copy and coverage.
const everyCode: Record<ChatbotErrorCode, true> = {
  ABORTED: true,
  NETWORK_ERROR: true,
  FETCH_UNAVAILABLE: true,
  VALIDATION_ERROR: true,
  INVALID_RESPONSE: true,
  REQUEST_FAILED: true,
  STREAM_INCOMPLETE: true,
  THREAD_REQUIRED: true,
  NOT_FOUND: true,
  FORBIDDEN: true,
  AUTH_ERROR: true,
  CHATBOT_CONSENT_REQUIRED: true,
  CHATBOT_CONSENT_WORDING_CHANGED: true,
  CHATBOT_CONSENT_NOT_REQUESTED: true,
  POLICY_VALIDATION_FAILED: true,
  RATE_LIMIT: true,
  IDEMPOTENCY_IN_PROGRESS: true,
  IDEMPOTENCY_CONFLICT: true,
  INVALID_STATE: true,
  INTERNAL_ERROR: true
};

describe('describeChatbotError', () => {
  it('localizes every known code without displaying developer text', () => {
    for (const code of Object.keys(everyCode)) {
      const error = new MoreflowChatbotError({ message: 'Private developer detail.', code });
      const de = describeChatbotError(error, { locale: 'de' });
      const en = describeChatbotError(error, { locale: 'en' });
      for (const result of [de, en]) {
        expect(result.code).toBe(code);
        expect(result.message, code).not.toContain('Private developer');
        expect(result.message.length, code).toBeGreaterThan(10);
        expect(result.cause).toBe(error);
      }
      expect(de.message, code).not.toBe(en.message);
      if (code !== 'REQUEST_FAILED') {
        expect(en.message, code).not.toBe(describeChatbotError(null, { locale: 'en' }).message);
      }
    }
  });

  it('defaults to German Sie and switches to du for informal German', () => {
    const error = new MoreflowChatbotError({ message: 'Private detail.', code: 'NETWORK_ERROR' });
    expect(describeChatbotError(error).message).toBe(
      'Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
    );
    expect(describeChatbotError(error, { locale: 'de', formality: 'informal' }).message).toBe(
      'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.'
    );
    expect(describeChatbotError(error, { locale: 'en', formality: 'informal' }).message).toBe(
      'The connection failed. Please try again.'
    );
    for (const code of Object.keys(everyCode)) {
      const error = new MoreflowChatbotError({ message: 'Private detail.', code });
      expect(describeChatbotError(error, { formality: 'informal' }).message, code).not.toMatch(/\bSie\b|\bIhre\b/u);
    }
  });

  it('keeps retry metadata and the caught error as cause', () => {
    const error = new MoreflowChatbotError({
      message: 'Private detail.', code: 'RATE_LIMIT', retryable: true, retryAfter: '30', cause: new Error('root')
    });
    expect(describeChatbotError(error, { locale: 'en' })).toEqual({
      code: 'RATE_LIMIT',
      message: 'Too many attempts. Please wait a moment and try again.',
      retryable: true,
      retryAfterSeconds: 30,
      cause: error
    });
  });

  it('safely falls back for arbitrary failures and future server codes', () => {
    for (const error of [null, undefined, 'Private detail.', new Error('Private detail.'), [], { code: '' }]) {
      expect(describeChatbotError(error, { locale: 'en' })).toEqual({
        code: 'REQUEST_FAILED', message: 'The request failed. Please try again.',
        retryable: false, retryAfterSeconds: undefined, cause: error
      });
    }
    for (const code of ['NEW_SERVER_ERROR', '__proto__', 'constructor', 'toString']) {
      expect(describeChatbotError({ code, message: 'Private detail.' }, { locale: 'en' })).toMatchObject({
        code, message: 'The request failed. Please try again.'
      });
    }
    expect(describeChatbotError({ code: 'NEW_SERVER_ERROR', retryable: true }, { locale: 'en' }).message)
      .toBe('The connection failed. Please try again.');
    expect(describeChatbotError({ code: 'REQUEST_FAILED', retryable: true }, { locale: 'en' }).message)
      .toBe('The connection failed. Please try again.');
    for (const error of [{ code: 'NEW_SERVER_ERROR', status: 429 }, { code: 'REQUEST_FAILED', status: 429 }, { code: 'RATE_LIMITED' }]) {
      expect(describeChatbotError(error, { locale: 'en' }).message)
        .toBe('Too many attempts. Please wait a moment and try again.');
    }
  });

  it('drops invalid structural retry metadata', () => {
    for (const retryAfterSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY, '30']) {
      expect(describeChatbotError({ retryAfterSeconds, retryable: 'yes' })).toMatchObject({
        retryable: false, retryAfterSeconds: undefined
      });
    }
  });
});

describe('chatbot Retry-After', () => {
  it('reads HTTP delay seconds, including zero', () => {
    for (const [header, seconds] of [['30', 30], [' 120 ', 120], ['0', 0]] as const) {
      expect(new MoreflowChatbotError({ message: 'Rate limited.', retryAfter: header }).retryAfterSeconds).toBe(seconds);
    }
  });

  it('reads an HTTP date relative to construction time, rounds up and clamps past dates', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-20T10:00:00.250Z'));
    try {
      expect(new MoreflowChatbotError({ message: 'Rate limited.', retryAfter: 'Tue, 20 Oct 2026 10:00:31 GMT' }).retryAfterSeconds).toBe(31);
      expect(new MoreflowChatbotError({ message: 'Rate limited.', retryAfter: 'Tue, 20 Oct 2026 09:00:00 GMT' }).retryAfterSeconds).toBe(0);
    } finally {
      now.mockRestore();
    }
  });

  it('ignores missing and malformed header values', () => {
    for (const retryAfter of [undefined, '', ' ', '-1', '1.5', 'not a date', 'Infinity', '999999999999999999999']) {
      expect(new MoreflowChatbotError({ message: 'Rate limited.', retryAfter }).retryAfterSeconds).toBeUndefined();
    }
  });

  it('reads structured operation retry delays when SSE has no Retry-After header', () => {
    const error = operationError({ responseBody: { error: {
      code: 'IDEMPOTENCY_IN_PROGRESS', context: { retryAfterSeconds: 19 }
    } } });
    expect(describeChatbotError(error, { locale: 'en' })).toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS', retryable: true, retryAfterSeconds: 19,
      message: 'Your message is still being processed. Please wait a moment and try again.'
    });
    expect(new MoreflowChatbotError({
      message: 'Processing', retryAfter: '5', details: { retryAfterSeconds: 19 }
    }).retryAfterSeconds).toBe(5);
    for (const retryAfterSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY, '19']) {
      expect(new MoreflowChatbotError({
        message: 'Processing', details: { retryAfterSeconds }
      }).retryAfterSeconds).toBeUndefined();
    }
  });

  it('preserves Retry-After through operationError', () => {
    const error = operationError({ responseBody: { error: { code: 'RATE_LIMIT' } }, status: 429, retryAfter: '45' });
    expect(error).toMatchObject({ code: 'RATE_LIMIT', retryable: true, retryAfterSeconds: 45 });
    expect(describeChatbotError(error).retryAfterSeconds).toBe(45);
  });
});
