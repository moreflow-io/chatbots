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

## Issues and contributing

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/chatbots/issues). Development happens in the private Moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.
