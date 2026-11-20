import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, type StorageLike } from '@moreflow/tracking';
import {
  chatbotAdsConsentMode,
  chatbotAdsConsentStorageKey,
  readChatbotAdsConsent,
  storeChatbotAdsConsent
} from './index';

describe('chatbot advertising consent mode', () => {
  it('follows the chosen source, and asks only a chatbot that reports leads to ad platforms', () => {
    const config = (adsTracking: boolean | undefined, adsConsentSource?: 'widget_prompt' | 'website_consent') => ({
      settings: { addressForm: 'formal' as const, ...(adsTracking === undefined ? {} : { adsTracking }) },
      embedSettings: adsConsentSource ? { adsConsentSource } : {}
    });
    expect(chatbotAdsConsentMode(config(true, 'widget_prompt'))).toBe('widget_prompt');
    expect(chatbotAdsConsentMode(config(true))).toBe('widget_prompt');
    expect(chatbotAdsConsentMode(config(false, 'widget_prompt'))).toBe('none');
    expect(chatbotAdsConsentMode(config(undefined))).toBe('none');
    expect(chatbotAdsConsentMode(config(true, 'website_consent'))).toBe('website_consent');
    expect(chatbotAdsConsentMode(config(false, 'website_consent'))).toBe('website_consent');
  });
});

describe('chatbot advertising consent answer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the answer per chatbot under the shared storage key', () => {
    const storage = createMemoryStorage();
    expect(readChatbotAdsConsent('bot-1', storage)).toBeNull();

    storeChatbotAdsConsent('bot-1', 'granted', storage);
    storeChatbotAdsConsent('bot-2', 'denied', storage);

    expect(chatbotAdsConsentStorageKey('bot-1')).toBe('moreflow_chat_ads_consent:bot-1');
    expect(storage.getItem('moreflow_chat_ads_consent:bot-1')).toBe('granted');
    expect(readChatbotAdsConsent('bot-1', storage)).toBe('granted');
    expect(readChatbotAdsConsent('bot-2', storage)).toBe('denied');
  });

  it('uses localStorage by default and ignores values that are no answer', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    storeChatbotAdsConsent('bot-1', 'denied');
    expect(storage.getItem('moreflow_chat_ads_consent:bot-1')).toBe('denied');
    storage.setItem('moreflow_chat_ads_consent:bot-1', 'true');
    expect(readChatbotAdsConsent('bot-1')).toBeNull();
  });

  it('treats blocked storage as not answered and never throws', () => {
    const blocked: StorageLike = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      }
    };
    expect(() => storeChatbotAdsConsent('bot-1', 'granted', blocked)).not.toThrow();
    expect(readChatbotAdsConsent('bot-1', blocked)).toBeNull();
  });
});
