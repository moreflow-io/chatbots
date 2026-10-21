import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ChatbotClient } from './index';
import { createChatbotSession } from './session';
import type { ChatbotSession, ChatbotSessionOptions, ChatbotSessionSnapshot } from './session-types';

/**
 * Runs a headless chatbot session and subscribes React to its snapshots.
 * A new client, locale or formality creates a new session; other options are read at creation.
 */
export function useChatbot(
  client: ChatbotClient,
  options: ChatbotSessionOptions = {}
): { session: ChatbotSession; state: ChatbotSessionSnapshot } {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const { locale, formality } = options;
  const session = useMemo(
    () => createChatbotSession(client, { ...optionsRef.current, autoStart: false }),
    [client, locale, formality]
  );
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    void session.start();
    return () => session.dispose();
  }, [session]);

  return { session, state };
}

export type { ChatbotSession, ChatbotSessionOptions, ChatbotSessionSnapshot } from './session-types';
