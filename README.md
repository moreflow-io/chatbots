# `@moreflow/chatbots`

Headless browser protocol helpers for native Moreflow chatbot clients. The package contains no UI, React, styles, or rendering code.

```ts
import { createChatbotClient } from '@moreflow/chatbots';

const chatbot = createChatbotClient({
  chatbotId: '00000000-0000-4000-8000-000000000001',
  apiBaseUrl: 'https://api.moreflow.io'
});

const config = await chatbot.getConfig();
const sent = await chatbot.send({ message: 'How can you help?' });
```

The client preserves the public SDK storage contract:

- `moreflow_chat_visitor_${chatbotId}` for a visitor id;
- `moreflow_chat_thread_${chatbotId}_${visitorId}` for the adopted thread id.

`getConfig()` normalizes public configuration to camel case. `send()` captures acquisition attribution through `@moreflow/tracking`, adopts the returned thread id, and persists it. `sendStream()` provides the public SSE variant and adopts the thread id from its `message.complete` event.

## Lead consent

A chatbot can ask visitors for lead consent (marketing email, email tracking) with text the account writes itself. `getConfig()` lists those requests in `chatbot.leadConsent`, each with the `text` to show verbatim, a `wordingVersion` that identifies that text, and `required`. When a request is required, the chatbot refuses messages until the visitor grants it; only marketing email consent can be required.

Render one checkbox per request and send the visitor's choices with the message:

```ts
import {
  chatbotLeadConsentAnswers,
  chatbotLeadConsentFromError,
  missingRequiredChatbotLeadConsent
} from '@moreflow/chatbots';

const { chatbot: config } = await chatbot.getConfig();
const consent = chatbotLeadConsentAnswers(config.leadConsent, { marketing_email: true });

if (missingRequiredChatbotLeadConsent(config.leadConsent, consent).length === 0) {
  await chatbot.send({ message: 'How can you help?', consent });
}
```

- Send `consent` with the first message of a thread. Later messages in the same thread need no consent; a new thread (`clearThread()` / `reset()`) is a new conversation and needs it again.
- A granted answer is recorded on the lead with the conversation as evidence and the `wordingVersion` as the wording the visitor saw. A declined answer records nothing, and the chatbot does not ask that purpose again in the conversation. A purpose without an answer may still be asked in the conversation.
- A refused message throws a `MoreflowChatbotError` with code `CHATBOT_CONSENT_REQUIRED` (a required purpose is not granted) or `CHATBOT_CONSENT_WORDING_CHANGED` (the account changed the text since the config was loaded). `chatbotLeadConsentFromError(error)` returns the requests to show again; `chatbotConsentErrorCodes` lists the codes.

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/chatbots/issues). Development happens in the private Moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.
