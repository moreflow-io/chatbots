# Changelog

All notable changes to `@moreflow/chatbots` are documented in this file.

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

- Initial release: headless browser protocol helpers for Moreflow public chatbots.
- `createChatbotClient` and `createChatbotOperationTransport` for the public chatbot operations (`chatbots.embed.getPublic`, `messages.list`, `messages.send`, `messageRatings.list`, `messageRatings.set`), including SSE message streaming and retry-aware error handling.
- Visitor and thread identity helpers (`createChatbotIdentity`, storage-key helpers) with resilient browser storage.
- Config and payload normalizers plus branded account and client id helpers at the package boundary.
