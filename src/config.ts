import { normalizeChatbotLeadConsent } from './consent';
import { MoreflowChatbotError } from './errors';
import { type CanonicalChatbotRecord, chatbotAccountId } from './index';
import { isRecord, stringValue } from './internal/values';
import type { ChatbotPublicConfig, ChatbotPublicConfigResponse, ChatbotPublicEmbedSettings } from './public-types';

function normalizeEmbedSettings(record: Record<string, unknown>): ChatbotPublicEmbedSettings {
  const teaser = isRecord(record.teaser) ? record.teaser : undefined;
  return {
    ...record,
    primaryColor: typeof record.primaryColor === 'string' ? record.primaryColor : undefined,
    teaser: teaser ? {
      ...teaser,
      enabled: teaser.enabled === true,
      messages: Array.isArray(teaser.messages) ? teaser.messages.filter(isRecord).flatMap((message) =>
        typeof message.text === 'string' ? [{ ...message, text: message.text }] : []) : []
    } : undefined
  };
}

function camelCaseKey(key: string): string {
  return key.replace(/_([a-z0-9])/giu, (_match, character: string) => character.toUpperCase());
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue);
  if (!isRecord(value)) return value;

  const normalized: CanonicalChatbotRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (camelCaseKey(key) === key) normalized[key] = normalizeCanonicalValue(entry);
  }
  for (const [key, entry] of Object.entries(value)) {
    const canonicalKey = camelCaseKey(key);
    if (!(canonicalKey in normalized)) normalized[canonicalKey] = normalizeCanonicalValue(entry);
  }
  return normalized;
}

function invalidResponse(message: string, responseBody: unknown): MoreflowChatbotError {
  return new MoreflowChatbotError({ message, code: 'INVALID_RESPONSE', responseBody });
}

/** Converts public API records to one camel-case representation with camel-case precedence. */
export function normalizeChatbotConfig(value: unknown): ChatbotPublicConfig {
  const record = normalizeCanonicalValue(value);
  if (!isRecord(record)) throw invalidResponse('Public chatbot configuration must be an object.', value);

  const rawSettings = isRecord(record.settings) ? record.settings : {};
  const settings = { ...rawSettings, welcomeMessage: typeof rawSettings.welcomeMessage === 'string' ? rawSettings.welcomeMessage : undefined };
  const embedSettings = isRecord(record.embedSettings) ? record.embedSettings : {};
  const leadFields = Array.isArray(record.leadFields) ? record.leadFields.filter(isRecord) : [];
  const funnelSettings = isRecord(record.funnelSettings) ? record.funnelSettings : {};
  const supportSettings = isRecord(record.supportSettings) ? record.supportSettings : {};
  const accountId = stringValue(record.accountId);
  const description = stringValue(record.description);
  const avatarStorageId = stringValue(record.avatarStorageId);

  return {
    ...record,
    id: stringValue(record.id) ?? '',
    name: stringValue(record.name) ?? '',
    mode: stringValue(record.mode) ?? '',
    ...(accountId ? { accountId: chatbotAccountId(accountId) } : {}),
    ...(description ? { description } : {}),
    settings: { ...settings, ...(typeof settings.welcomeMessage === 'string' ? { welcomeMessage: settings.welcomeMessage } : {}) },
    embedSettings: normalizeEmbedSettings(embedSettings),
    leadFields,
    funnelSettings,
    supportSettings,
    ...(avatarStorageId ? { avatarStorageId } : {}),
    avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : null,
    companyLogoUrl: typeof record.companyLogoUrl === 'string' ? record.companyLogoUrl : null,
    leadConsent: normalizeChatbotLeadConsent(record.leadConsent)
  };
}

export function normalizeChatbotPublicConfig(value: unknown): ChatbotPublicConfigResponse {
  if (!isRecord(value)) throw invalidResponse('Public chatbot response must be an object.', value);
  return {
    chatbot: normalizeChatbotConfig(value.chatbot),
    ...(isRecord(value.trace) ? { trace: value.trace } : {})
  };
}
