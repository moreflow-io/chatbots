# `@moreflow/chatbots`

Headless browser protocol helpers for native moreflow chatbot clients. The framework-neutral core contains no UI or styles; an optional React entry subscribes to the headless session.

The other public SDKs, the agent plugins, and the HTTP API are listed in the
[moreflow SDK overview](https://api.moreflow.io/v1/operations/docs/guide#sdks).

```ts
import { createChatbotClient } from '@moreflow/chatbots';

const chatbot = createChatbotClient({
  chatbotId: '00000000-0000-4000-8000-000000000001'
});

const config = await chatbot.getConfig();
const sent = await chatbot.send({ message: 'How can you help?' });
```

Requests go to `https://api.moreflow.io` unless you pass `baseUrl` (for example `https://dev-api.moreflow.io`, or `''` behind an optional same-origin proxy, see [Auth and CORS](#auth-and-cors)).

## Script tag

Pages without a bundler load the browser build, which exposes the same API as `window.MoreflowChatbots`:

```html
<script src="https://cdn.jsdelivr.net/npm/@moreflow/chatbots@0.5.0/dist/browser.js"></script>
<script>
  const chatbot = window.MoreflowChatbots.createChatbotClient({
    chatbotId: '00000000-0000-4000-8000-000000000001'
  });
</script>
```

Pin an exact version and change the URL deliberately on every upgrade. The host page's Content Security Policy must allow `https://cdn.jsdelivr.net` for scripts and `https://api.moreflow.io` for `connect-src`.

## Auth and CORS

The chatbot API needs no API token, and the client sends no cookies (`credentials: 'omit'`). Never put an API token in page source: anyone can read it there.

The chatbot must be active. Under **Allowed Domains** in the chatbot's settings, add the domains that may embed it (`example.com` also covers `www.example.com`). While the list is empty, any site can embed the chatbot; once it has an entry, the server compares the browser's `Origin` header (or `Referer`) with it on every call. A request without either header, such as one from your own server-side proxy, is not checked against the list. A domain that is not on the list, or a chatbot that is not active, gets `NOT_FOUND`, the same answer as an unknown chatbot id.

The browser calls `https://api.moreflow.io` directly. `getConfig()`, `send()`, `listMessages()` and the rating calls go to `/v1/operations/chatbots.embed.*`, and `sendStream()` posts to `/v1/chatbots/{chatbotId}/messages/stream`; both answer CORS requests from any site, including the browser's preflight, and the Allowed Domains check then runs on the real request. Use [`@moreflow/api`](https://github.com/moreflow-io/api#readme) only from server code; it is not for the browser.

You do not need a proxy. Route these requests through your own server only when your Content Security Policy cannot list `https://api.moreflow.io`, and know what it costs. Preserving per-visitor rate limiting would require forwarding the real client IP through infrastructure moreflow trusts. The public API currently rejects caller-supplied `CF-Connecting-IP` at Cloudflare and does not trust `X-Forwarded-For`, so all visitors share one rate limit at your server's IP. Forward the browser's `Origin` header unchanged, or the Allowed Domains check no longer protects anything: the server skips it for a request without `Origin` or `Referer`, and a proxy that sets a fixed `Origin` lets anyone who reaches it through. Never add an API token in the proxy; the public endpoints do not need one. Pass `baseUrl: ''` (or your proxy's URL) to send the requests there.

## Stored data

| Key | Storage | Lifetime | Purpose |
| --- | --- | --- | --- |
| `moreflow_chat_visitor_${chatbotId}` | `localStorage` | Until `forgetVisitor()` or the visitor clears site data | The visitor id, so a returning visitor continues the same conversation. Written on the first `send()`/`sendStream()`, not when the client is created. |
| `moreflow_chat_thread_${chatbotId}_${visitorId}` | `localStorage` | Until `clearThread()`/`reset()`, `forgetVisitor()`, or the visitor clears site data | The current thread id, adopted from the server's reply. |
| `moreflow:acquisition:v1` | `localStorage` (`sessionStorage` with `persistence: 'session'`) | Each touch for 90 days (`ttlDays`), until `clearAcquisitionTracking()`, or until the visitor clears site data | Acquisition values, written only with `acquisitionTracking` consent (see below). |
| `moreflow_chat_ads_consent:${chatbotId}` | `localStorage` | Until the visitor clears site data | The visitor's answer (`granted` or `denied`) to the chat's own advertising consent prompt, written only by `storeChatbotAdsConsent()` (see below). |

Pass `storage` to use your own `StorageLike` for the visitor and thread ids. When `localStorage` is blocked, they live in memory for the page. The package sets no cookies.

`client.visitorId` is available right away, but it is stored only once the visitor sends a message, so loading a page with the chatbot stores nothing. `forgetVisitor()` removes the stored visitor and thread ids and continues as a new visitor, for example behind a "Delete my chat" button; `reset()` only starts a new thread.

## Acquisition tracking and consent

`acquisitionTracking` is the visitor's tracking consent:

```ts
const chatbot = createChatbotClient({
  chatbotId: '00000000-0000-4000-8000-000000000001',
  acquisitionTracking: () => consentManager.hasMarketingConsent()
});
```

Without consent (the default, `false`, or a function returning `false`) every send carries only the UTM parameters (`utm_*`), Google campaign parameters (`gad_campaignid`, `gad_source`), and ad click ids (`gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `oppref`) of the current page URL. It reads no cookies, no referrer, user agent or screen size, writes no browser storage, and keeps nothing for a later page. `utm_campaignid` and `gad_campaignid` arrive as `utmCampaignId` and `gadCampaignId`; `gad_source` has no chatbot metadata field and is left out, and a send without any carries no metadata.

With `acquisitionTracking: true`, or a function that returns `true`, every send also carries Meta's `_fbp`/`_fbc` and TikTok's `_ttp` cookies, the referrer, the page URL, and the device type, captured with `@moreflow/tracking`. The first and last touch are kept in `localStorage` for 90 days, so a conversation in a later visit still carries an earlier ad click id. Reading those cookies and writing that storage needs the visitor's consent in the EU (§ 25 TDDDG in Germany), so tie the option to your consent banner. A function is asked on every send. Metadata you pass as `send({ metadata })` is always sent. The same option exists on `@moreflow/forms` and `@moreflow/meetings`.

One `configureAcquisitionTracking({ persistence, model, ttlDays })` call at startup (re-exported from `@moreflow/tracking`) applies to these captures and to the ones your own page makes, so a site that captures on every route change and enables `acquisitionTracking: true` here sends the same landing values without a wrapper. Pass `trackingCapture: { model: 'last-touch', persistence: 'local' }` to override capture options for this client, or `trackingCapture: () => myChatbotMetadata` to supply your own conversation metadata at send time. Both forms run only with consent; without it only a `location` in the options is read.

### Advertising consent

When `config.chatbot.settings.adsTracking` is `true`, Moreflow reports the chatbot's leads to Meta, TikTok or ChatGPT Ads (server-side conversions, plus the browser pixels in `metaPixelId`, `tiktokPixelId` and `openAiPixelId`). Ask the visitor for advertising consent before you load any of those pixels, and pass the answer as `adsConsent`:

```ts
const chatbot = createChatbotClient({
  chatbotId: '00000000-0000-4000-8000-000000000001',
  adsConsent: () => consentManager.hasAdvertisingConsent()
});
```

Every send then carries `metadata.adsConsent` (`true` only for `true` or a function returning `true`). The conversation keeps the latest value, and while it is `false` its lead is reported to none of those platforms. Without the option a send carries no consent signal and the lead is reported as before. The hosted chat page asks for this consent itself, and the visitor can chat only after answering.

The script embed (`chatbot-sdk.js`, the `mfChat('init', …)` snippet from the chatbot's share settings) follows `config.chatbot.embedSettings.adsConsentSource`, which the account picks per chatbot:

- `widget_prompt` (the default): when `settings.adsTracking` is `true`, the widget shows its own Ablehnen/Zulassen (Decline/Allow) prompt, and the visitor can chat only after answering. The answer is kept per chatbot in the browser; only Allow lets the widget read ad cookies.
- `website_consent`: the widget takes the consent from the site's consent banner through the snippet's `acquisitionTracking` hook (`hasTrackingConsent` in the generated code). Without a hook, or while it returns anything but `true`, the widget sends `adsConsent: false`.

A custom client follows the same setting; a server that does not send it means `widget_prompt`. `chatbotAdsConsentMode(config)` applies these rules to a loaded config, and `readChatbotAdsConsent(chatbotId)`/`storeChatbotAdsConsent(chatbotId, 'granted' | 'denied')` keep the answer to your own prompt in `localStorage` under `moreflow_chat_ads_consent:{chatbotId}`, the key the hosted chat and the script embed use, so a visitor is asked once per chatbot:

```ts
const config = await chatbot.loadConfig();
const mode = chatbotAdsConsentMode(config); // 'widget_prompt' | 'website_consent' | 'none'
let answer = readChatbotAdsConsent(config.id); // 'granted' | 'denied' | null; ask while null in 'widget_prompt'
const client = createChatbotClient({
  chatbotId: config.id,
  adsConsent: () =>
    mode === 'widget_prompt' ? answer === 'granted' : mode === 'website_consent' && consentManager.hasAdvertisingConsent()
});
```

The custom chat code the embed builder generates for a chatbot works this way.

## Sending

`getConfig()` normalizes public configuration to camel case. `send()` adopts the returned thread id and stores it. `sendStream()` provides the public SSE variant and adopts the thread id from its `message.complete` event.

`clearThread()`, `reset()` and `forgetVisitor()` abort sends still in flight, which then throw code `ABORTED`, and a reply that arrives anyway never stores the old thread id again.

`send()` and `sendStream()` take an optional second argument, `{ signal }`, to cancel the request. `sendStream()` yields events until `message.complete` or `message.error`, then releases the response body; stopping the loop early or aborting the signal releases it too. An aborted send throws a `MoreflowChatbotError` with code `ABORTED`. A stream that ends without either terminal event throws code `STREAM_INCOMPLETE`; the server may already have stored the message, so retry with the same explicit `clientMessageId` (the session does this automatically). `chatbotStreamErrorCodes` lists both codes.

## Errors

Every helper throws `MoreflowChatbotError`. Its `ChatbotErrorCode` includes `NOT_FOUND`, `CHATBOT_CONSENT_REQUIRED`, `RATE_LIMIT` or `STREAM_INCOMPLETE` and the SDK's own codes (`NETWORK_ERROR`, `ABORTED`, `VALIDATION_ERROR`, `INVALID_RESPONSE`, `FETCH_UNAVAILABLE`, `REQUEST_FAILED`). A newer server may send a code not in the union.

`isMoreflowError(error)`, exported by this package, recognizes the shared `Symbol.for('moreflow.error')` brand across separately bundled `@moreflow/forms`, `@moreflow/chatbots`, `@moreflow/meetings` and `@moreflow/api`. Use it to narrow an unknown caught value to this common error shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `code` | `string` | Stable failure code; branch on this, including newer server codes. |
| `message` | `string` | Developer explanation, using the server's message when available. |
| `status` | `number \| undefined` | HTTP status; `undefined` when no response arrived. |
| `retryable` | `boolean` | Whether the same request may succeed later: HTTP 408, 425, 429, 5xx, network failures or a server-declared retryable failure. Caller cancellation (`ABORTED`) is not retryable. |
| `recovery` | `{ operation, args?, requiredFields? } \| undefined` | The operation that resolves the failure, its known arguments and input still needed. |
| `details` | `Record<string, unknown>` | Structured server context; `{}` when absent. Operation `context` is merged into it. |
| `requestId` | `string \| undefined` | Server request id to quote when contacting support. |
| `responseBody` | `unknown` | Raw response body, unchanged. |

`isRetryableChatbotError(error)` checks `retryable` on a caught value.

## Lead consent

A chatbot can ask visitors for lead consent (marketing email, email tracking) with text the account writes itself. `getConfig()` lists those requests in `chatbot.leadConsent`, each with the `text` to show verbatim, a `wordingVersion` that identifies that text, and `required`. When a request is required, the chatbot refuses messages until the visitor grants it; the account can require either purpose.

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

Bug reports and feature requests are welcome in [this repository's issue tracker](https://github.com/moreflow-io/chatbots/issues). Development happens in the private moreflow monorepo alongside the server contract this package mirrors; each released version is synced here, so the published source always matches the npm release.

## Headless session and React widget

`createChatbotSession(client, { locale: 'de', formality: 'informal' })` owns config/history loading, welcome text, optimistic messages, consent, streaming and retries. Read `getSnapshot()`, subscribe with `subscribe(listener)`, and await `ready` for the initial load. Snapshots contain `status` (`loading`, `consent`, `ready`, `sending`, `error`), typed `config`, `messages` with `pending`/`failed`, `consent`, `error`, `hasMore` and `loadingMore`. `loadMore()` prepends older history; `reset()` aborts requests and starts a fresh thread. `dispose()` cancels requests without forgetting the visitor; `start()` resumes an unfinished load.

`send(text)` and `retry(messageId)` resolve with `status: 'sent' | 'consent_required' | 'error' | 'aborted' | 'ignored'`. A consent result includes `restoreText` for the composer. The consent controller exposes `setDecision(purpose, true | false | null)`, `acceptAll()` and `confirm()`. Unanswered purposes remain unanswered; explicit declines are sent as declines. Answers are attached only to the thread's first message. Changed wording clears decisions and asks again.

The session prefers streaming and falls back to `send()` for unavailable or interrupted streams. Both requests and manual retries reuse one `clientMessageId`; the server deduplicates by chatbot, visitor and message id, including when the first response carrying the thread id was lost. Low-level callers may pass `clientMessageId` explicitly and must retain it when retrying; a new id is generated when omitted. Do not reuse an id for different text. `loadConfig()` returns the normalized config directly; `getConfig()` retains its existing response envelope.

`describeChatbotError(error, { locale: 'de' | 'en', formality: 'formal' | 'informal' })` returns safe localized `message` (German "du" unless `formality` is `'formal'`; a session passes the chatbot's `settings.addressForm` when you set no `formality`), `code`, `retryable`, `retryAfterSeconds` and the original `cause`. HTTP `Retry-After` seconds and dates are respected in `retryAfterSeconds`; wait that long before offering another attempt.

Completed sends replay for 30 days through moreflow's shared operation idempotency store. `IDEMPOTENCY_IN_PROGRESS` means the original send is still running; the session surfaces a retryable, localized error with `retryAfterSeconds` (from HTTP or SSE details). Wait that delay before `retry(message.id)`. Known transient failures before a reply exists release their claim and reuse the persisted visitor message on retry. Provider failures that already produced a fallback reply replay that reply. A crashed request expires after the shared 10-minute pending lease into `INVALID_STATE`, rather than processing forever. If a reply was persisted before a later failure, `INVALID_STATE` points to thread history. The client retains a matching chatbot/visitor recovery pointer over JSON or SSE, so reloading can recover a first-send reply too; reconcile any remaining lead processing before sending again. These uncertain outcomes are never automatically repeated.

Install React 18+ only when using the optional `@moreflow/chatbots/react` entry. React is excluded from the core and script-tag bundles. This MPU West-style widget keeps composer text and presentation in React; the SDK handles the chat lifecycle:

```tsx
import { useMemo, useState } from 'react';
import { createChatbotClient } from '@moreflow/chatbots';
import { useChatbot } from '@moreflow/chatbots/react';

export function ChatWidget({ chatbotId }: { chatbotId: string }) {
  const client = useMemo(() => createChatbotClient({ chatbotId }), [chatbotId]);
  const { session, state } = useChatbot(client, { locale: 'de', formality: 'informal' });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const color = state.config?.embedSettings.primaryColor ?? '#be2a7c';
  const teaser = state.config?.embedSettings.teaser;

  async function send() {
    const message = text.trim();
    if (!message) return;
    setText('');
    const result = await session.send(message);
    if (result.status === 'consent_required') setText(result.restoreText);
    if (result.status === 'error') {
      setRetryAt(Date.now() + (result.error.retryAfterSeconds ?? 0) * 1000);
    }
  }

  return <aside style={{ accentColor: color }}>
    <button onClick={() => setOpen(!open)} aria-expanded={open}>Chat</button>
    {!open && teaser?.enabled && teaser.messages?.map((message, index) =>
      <p key={index}>{message.text}</p>)}
    {open && <section aria-label={state.config?.name ?? 'Chat'}>
      <header>
        {state.config?.avatarUrl && <img src={state.config.avatarUrl} alt="" width={32} />}
        <strong>{state.config?.name}</strong>
        <button onClick={() => session.reset()}>Neu starten</button>
      </header>
      {state.status === 'loading' && <p role="status">Chat wird geladen …</p>}
      {state.hasMore && <button disabled={state.loadingMore} onClick={() => session.loadMore()}>
        Frühere Nachrichten
      </button>}
      <ol aria-live="polite">
        {state.messages.map(message => <li key={message.id}>
          <strong>{message.role === 'visitor' ? 'Du' : state.config?.name}: </strong>
          {message.text || (message.pending ? '…' : '')}
          {message.failed && <button onClick={() => {
            if (Date.now() >= retryAt) void session.retry(message.id);
          }}>Erneut versuchen</button>}
        </li>)}
      </ol>
      {state.error && <p role="alert">{state.error.message}</p>}
      {state.status === 'error' && !state.config &&
        <button onClick={() => session.start()}>Erneut laden</button>}
      {state.consent.needed ? <fieldset>
        <legend>Einwilligung</legend>
        {state.consent.requests.map(request => <label key={request.purpose}>
          <input type="checkbox"
            checked={state.consent.decisions[request.purpose] === true}
            onChange={event => session.consent.setDecision(request.purpose, event.target.checked)} />
          {request.text}
        </label>)}
        <button onClick={() => session.consent.acceptAll()}>Allen zustimmen</button>
        <button disabled={state.consent.missing.length > 0}
          onClick={() => session.consent.confirm()}>Auswahl bestätigen</button>
      </fieldset> : <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <label>Nachricht
          <textarea value={text} onChange={event => setText(event.target.value)} />
        </label>
        <button disabled={!text.trim() || state.status === 'sending' || state.status === 'loading'}>
          Senden
        </button>
      </form>}
    </section>}
  </aside>;
}
```

### Bot challenges

Browser sends and streams start without a token and make no challenge request while
enforcement is disabled. On the first challenge refusal, they retry once and remember
that chatbot requires a challenge for this page session (across SDK clients and hosted
chat remounts). Every challenged attempt obtains a fresh `chatbot_message` token in a small iframe
served by the configured Moreflow API origin. The conversation stays in the customer
page; customer domains do not belong in `TURNSTILE_ALLOWED_HOSTNAMES`. Allow the API
origin in the customer page's `frame-src` CSP. For same-origin/custom message
proxies the challenge defaults to `https://api.moreflow.io`; set
`challengeBaseUrl: 'https://dev-api.moreflow.io'` when the proxy targets Development. The API's challenge iframe uses
`VITE_TURNSTILE_SITE_KEY` only when both operation challenge flags are enabled, and
reports disabled without loading Cloudflare otherwise. Its API hostname must be
authorized on the Cloudflare widget and in the server's exact hostname allowlist.

Headless/custom integrations can pass `getChallengeToken: async ({ chatbotId, action, signal }) => token`
to `createChatbotClient` or `createChatbotOperationTransport`. Return a newly solved
token for **each invocation**, or `undefined` when the server reports disabled.
Tokens go only in `x-captcha-response`, never business input. Direct HTTP integrations
using either the generic operation route, `/messages`, or `/messages/stream` must
follow the same rule, including a fresh token on manual retries.

The SDK re-challenges once on missing, invalid/expired/replayed, action-mismatched
or hostname-rejected tokens, including terminal SSE challenge errors. Repeated
rejection is surfaced to the caller. It does not resend after an ambiguous network
or generation failure; preserve `clientMessageId` for a deliberate retry.
