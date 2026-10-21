import {
  abortedError,
  MoreflowChatbotError,
  operationError,
  streamIncompleteError
} from './errors';
import type { ChatbotSendResult } from './index';
import { isRecord, stringValue } from './internal/values';

/**
 * The public chatbot SSE stream: `message.start`, `message.delta`, then exactly one terminal
 * `message.complete` or `message.error`.
 */
export type ChatbotStreamEvent =
  | { type: 'message.start'; data: Record<string, unknown> }
  | { type: 'message.delta'; delta: string; data: Record<string, unknown> }
  | { type: 'message.complete'; result: ChatbotSendResult; data: Record<string, unknown> }
  | { type: 'message.error'; error: MoreflowChatbotError; data: Record<string, unknown> };

function parseSseEvent(raw: string): ChatbotStreamEvent | null {
  const lines = raw.split('\n');
  const event = stringValue(
    lines.find((line) => line.startsWith('event:'))?.slice('event:'.length)
  );
  const dataText = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');
  let data: Record<string, unknown> = {};
  if (dataText) {
    try {
      const parsed = JSON.parse(dataText);
      if (isRecord(parsed)) data = parsed;
    } catch {
      // Ignore malformed event payloads rather than introducing presentation behavior here.
    }
  }

  if (event === 'message.start') return { type: event, data };
  if (event === 'message.delta') return { type: event, delta: stringValue(data.delta) ?? '', data };
  if (event === 'message.complete') return { type: event, result: data, data };
  if (event === 'message.error') {
    return {
      type: event,
      error: operationError({ responseBody: data }),
      data
    };
  }
  return null;
}

function isTerminalStreamEvent(event: ChatbotStreamEvent): boolean {
  return event.type === 'message.complete' || event.type === 'message.error';
}

export async function* parseSse(
  response: Response,
  signal: AbortSignal | undefined
): AsyncGenerator<ChatbotStreamEvent> {
  if (!response.body) {
    throw new MoreflowChatbotError({
      message: 'The chatbot streaming response did not include a body.',
      code: 'INVALID_RESPONSE',
      retryable: true
    });
  }

  const reader = response.body.getReader();
  const cancelOnAbort = () => {
    reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener('abort', cancelOnAbort, { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    if (signal?.aborted) throw abortedError(signal);
    while (true) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch (cause) {
        if (signal?.aborted) throw abortedError(signal);
        throw streamIncompleteError(cause);
      }
      if (signal?.aborted) throw abortedError(signal);
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/gu, '\n');
      const records = buffer.split('\n\n');
      buffer = records.pop() ?? '';
      for (const record of records) {
        const event = parseSseEvent(record);
        if (!event) continue;
        yield event;
        if (isTerminalStreamEvent(event)) return;
      }
    }
    buffer += decoder.decode().replace(/\r\n/gu, '\n');
    const event = buffer.trim() ? parseSseEvent(buffer) : null;
    if (event) yield event;
    if (!event || !isTerminalStreamEvent(event)) throw streamIncompleteError();
  } finally {
    signal?.removeEventListener('abort', cancelOnAbort);
    // Releases the connection when the consumer stops early, aborts, or a terminal event arrives.
    reader.cancel().catch(() => undefined);
  }
}
