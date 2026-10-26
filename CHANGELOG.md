# Changelog

All notable changes to `@moreflow/chatbots` are documented in this file.

## Unreleased

## 0.4.1

- The public config types add the optional `settings.widgetPosition` (`'bottom_right' | 'bottom_left'`), which the server already returns.

## 0.4.0

- The public config now carries only what a chat client renders. `settings` lists `welcomeMessage`, `language`, `metaPixelId`, `metaEventChatStarted`, `metaEventLeadCreated`, `tiktokPixelId` and `tiktokEventLeadCreated`; `embedSettings` lists `primaryColor` and `teaser`; `leadFields` entries carry `key`, `label`, `type` and `required`. The server no longer returns `accountId`, `description`, `avatarStorageId`, the embed allowlist, or any other stored setting, so `funnelSettings` and `supportSettings` are always empty objects. `ChatbotPublicSettings` and `ChatbotPublicEmbedSettings` no longer accept arbitrary keys.

- Add `typesVersions` so the `@moreflow/chatbots/react` types resolve under `moduleResolution: "node"` (node10) as well as `node16` and `bundler`; before, consumers on node10 got TS2307 and had to switch to `bundler`.
- Email tracking consent can now be required, like marketing email consent. A send without that grant is refused with `CHATBOT_CONSENT_REQUIRED`, and `chatbotLeadConsentFromError(error)` returns the email tracking request to show.

## 0.3.0

- **Breaking — requires the next minor release:** replace `apiBaseUrl` with `baseUrl`; replace `trackingOptions` or `metadataCapture` with `trackingCapture`. The latter accepts built-in capture options or a callback returning conversation metadata, and always obeys `acquisitionTracking`. No old option aliases remain.

- Export `isMoreflowError(error)` using the shared `Symbol.for('moreflow.error')` brand. Migrate catch handlers that need common fields across separately bundled public SDKs from package-specific `instanceof` checks to this guard. Package-specific error classes remain available; document the common error table, now also used by `@moreflow/api`.

- Add `createChatbotSession` with config/history lifecycle, optimistic message state, consent recovery, cancellation, pagination, stream fallback and idempotent retries.
- Add optional `@moreflow/chatbots/react` `useChatbot`; React stays out of core/browser bundles.
- Generate typed public display settings and message roles from server output schemas; add `loadConfig()` while retaining `getConfig()`.
- Add de/en, Sie/du `describeChatbotError` and HTTP/SSE retry-delay support, including pending/uncertain-send guidance. Matching history recovery pointers retain the thread after a failed first send.

- Fix: `clearThread()`, `reset()` and `forgetVisitor()` abort sends still in flight (they throw `ABORTED`), and a reply that arrives anyway is ignored. Previously a reply to a message sent before the reset stored its thread id again, so the "new" conversation continued the old thread, or attached it to the new visitor after `forgetVisitor()`.
- The `origin` transport option is deprecated and no longer sent. The API always took the embedding origin from the request's `Origin`/`Referer` header and overwrote the body value, so the option never had an effect. A request without either header, such as one from a server-side proxy, is not checked against the allowed domains.
- Use `trackingCapture` for the built-in metadata capture; fields you leave out follow `configureAcquisitionTracking()` from `@moreflow/tracking`. Re-export `configureAcquisitionTracking`, `clearAcquisitionTracking` and the `AcquisitionTrackingConfig` type. Captured landing values stay stable across route changes, and server-side calls no longer share stored values between requests.
- Breaking: the client no longer attaches acquisition metadata on its own. Pass `acquisitionTracking: true`, or a function that returns `true` once the visitor consented, to capture UTM parameters, ad click ids, Meta's `_fbp`/`_fbc` cookies, referrer, page URL and device on every send. Reading those cookies and writing `sessionStorage` needs consent in the EU. A `trackingCapture` override runs only while `acquisitionTracking` is on; `send({ metadata })` is always sent. Export the `AcquisitionTrackingSetting` type. The same option exists on `@moreflow/forms` and `@moreflow/meetings`.
- The visitor id is written to `localStorage` on the first `send()`/`sendStream()` instead of when the client is created, so loading a page with the chatbot stores nothing. `client.visitorId` is available right away.
- Add `forgetVisitor()`: removes the stored visitor and thread ids and continues as a new visitor. `createChatbotIdentity()` gains `persistVisitor()` and `forgetVisitor()`.
- README: add Auth and CORS, Stored data, and Acquisition tracking and consent sections.
- `send()` and `sendStream()` (and the transport's `call()`, `sendMessage()` and `streamMessage()`) accept `{ signal }` to cancel a request. An aborted request throws a `MoreflowChatbotError` with code `ABORTED` instead of a retryable `NETWORK_ERROR`.
- `sendStream()` releases the response body when the loop stops early, the signal aborts, or a `message.complete`/`message.error` event arrives. Previously the reader stayed open.
- A stream that ends without `message.complete` or `message.error` now throws code `STREAM_INCOMPLETE` (not retryable) instead of ending silently. `chatbotStreamErrorCodes` lists the new codes.
- Requests no longer send the development-only `ngrok-skip-browser-warning` header.
- Breaking: requests go to `https://api.moreflow.io` by default. Previously the client called relative URLs on the page's own origin unless `apiBaseUrl` was set. Pass `baseUrl: ''` for a same-origin proxy.
- `baseUrl` is the only API origin option name across the moreflow SDKs.
- Add a script-tag build: `dist/browser.js` (also `@moreflow/chatbots/browser`, and the package's jsDelivr/unpkg entry) exposes the API as `window.MoreflowChatbots`.
- `MoreflowChatbotError` has the same shape as the `@moreflow/forms` and `@moreflow/meetings` errors: `code` (always set), `message`, `retryable`, typed `recovery: { operation, args }` (previously dropped), `details` (now always an object, including an operation's context), `status`, `requestId` and `responseBody`. `ChatbotErrorCode` lists the known codes.
- A missing `chatbotId` or `fetch` and an unreadable config response throw `MoreflowChatbotError` (`VALIDATION_ERROR`, `FETCH_UNAVAILABLE`, `INVALID_RESPONSE`) instead of a plain `Error`. Failures the server marks retryable are `retryable`.
- Blocked browser storage falls back to memory for the session through `@moreflow/tracking`, so the visitor and thread ids survive within the page.

## 0.2.0

- Lead consent: `getConfig()` returns `chatbot.leadConsent`, the consent purposes the chatbot asks for (`marketing_email`, `email_tracking`), each with the account-authored `text` to show verbatim, a `wordingVersion`, and `required`.
- `send()` and `sendStream()` accept `consent`, the visitor's answers (`{ purpose, granted, wordingVersion }`). Send it with the first message of a thread; a new thread needs consent again.
- When a chatbot requires consent, a message without the grant is refused with a `MoreflowChatbotError` whose code is `CHATBOT_CONSENT_REQUIRED`; stale wording is refused with `CHATBOT_CONSENT_WORDING_CHANGED`. `chatbotConsentErrorCodes` lists the codes.
- New helpers: `normalizeChatbotLeadConsent`, `chatbotLeadConsentAnswers`, `missingRequiredChatbotLeadConsent` and `chatbotLeadConsentFromError`, plus the `ChatbotLeadConsentRequest`, `ChatbotLeadConsentAnswer` and `ChatbotLeadConsentPurpose` types.
- The README documents the consent contract. Existing exports are unchanged.

## 0.1.2

- Documentation-only release: remove internal maintainer release instructions from the README shown on the npm package page; no code changes.

## 0.1.1

- Rename the package to `@moreflow/chatbots`, matching the public `moreflow-io/chatbots` repository. Earlier changelog entries were written under the working name `@moreflow/chatbot`; no version was ever published under that name.
- Depend on `@moreflow/tracking` instead of `@moreflow/forms` for acquisition tracking; the tracking re-exports (`captureAcquisitionTracking`, `createMemoryStorage`, `StorageLike`) are unchanged.
- Derive the conversation metadata tracking fields from the shared `AcquisitionTracking` shape without changing the wire format.

## 0.1.0

- Initial release: headless browser protocol helpers for moreflow public chatbots.
- `createChatbotClient` and `createChatbotOperationTransport` for the public chatbot operations (`chatbots.embed.getPublic`, `messages.list`, `messages.send`, `messageRatings.list`, `messageRatings.set`), including SSE message streaming and retry-aware error handling.
- Visitor and thread identity helpers (`createChatbotIdentity`, storage-key helpers) with resilient browser storage.
- Config and payload normalizers plus branded account and client id helpers at the package boundary.
