# Which hosted notification providers fit Cadence?

Research for [#5](https://github.com/piratetorben/cohort-005-project/issues/5), part of [#4](https://github.com/piratetorben/cohort-005-project/issues/4).
All sources accessed **2026-11-09**. Facts only. This document does not pick a provider.

## Constraints being checked

- In-app channel only. The provider owns the feed and the read state. Cadence keeps no notifications table and only triggers from the Node server.
- Hosted, with a usable free tier.
- Official React in-app feed component, plus a headless option.
- Secure user identification for the feed, server-side triggering from Node, real-time updates, and a fit with React Router SSR.

## Comparison

| | Knock | Novu Cloud | MagicBell | Courier | SuprSend |
|---|---|---|---|---|---|
| **Free tier volume** | 10,000 messages/mo, unlimited seats. No hard cap: Knock contacts you when you go over [1] | 10,000 workflow runs/mo, 20 workflows, 2 envs, 3 team members, 24h activity retention [2] | 1,000 deliveries/mo, 1 project [3] | 10,000 sends/mo [4] | 10,000 notifications/mo [5] |
| **Gated on free** | Knock branding cannot be removed. i18n, SSO and audit logs are Enterprise [1] | Novu branding cannot be removed (Pro+) [2] | Only the project count is stated as gated [3] | AI translation, EU data residency and RBAC are paid [4] | Feed carries SuprSend branding. Batching/digest, user preferences, i18n, throttling, webhooks and multi-tenant are gated [5] |
| **First paid tier** | Starter $250/mo, 50k messages [1] | Pro from $30/mo, 30k+ runs [2] | Startup $249/mo, 50k deliveries [3] | Business, pay-as-you-go $0.005/send [4] | Essentials $100/mo, 50k notifications [5] |
| **Prebuilt React feed** | `@knocklabs/react`: `NotificationFeedPopover`, `NotificationFeed`, `NotificationIconButton` [6] | `@novu/react`: `<Inbox />`, built from Bell, Notifications and Preferences parts [8] | `@magicbell/react`: `Inbox`, `FloatingInbox` inside `ContextProvider` [11] | `@trycourier/courier-react` v9: `CourierInbox`, `CourierInboxPopupMenu`, `CourierToast` [15] | `@suprsend/react`: drop-in inbox/feed components [17][18] |
| **Headless option** | `useKnockClient`, `useNotifications`, `useNotificationStore` from `@knocklabs/react-core` (a dependency of `@knocklabs/react`) [7][npm] | Headless hooks in `@novu/react`, or framework-agnostic `@novu/js` [8] | No headless hooks package documented. The `magicbell-js` user client is the closest equivalent [11][13] | `useCourier()` hook exposes `inbox`, `toast` and `preferences` for custom UI [15] | `@suprsend/react-core`: `SuprSendProvider` + `SuprSendFeedProvider` hooks [18] |
| **Node triggering** | `@knocklabs/node` (Apache-2.0, v1.41) [npm] | `@novu/api`: `novu.trigger({ workflowId, to, payload })`. The older `@novu/node` has been deprecated since 2025-03-20 [10][npm] | `magicbell-js/project-client`: `client.broadcasts.createBroadcast(...)` [13] | `@trycourier/courier` v10: `client.send.message({ message: { to: { user_id }, template, data } })`, fully typed [16] | `@suprsend/node-sdk`: `supr_client.workflows.trigger(new WorkflowTriggerRequest(...))`, with idempotency key and bulk trigger [20] |
| **Feed user auth** | "Enhanced security mode": RS256 JWT, `sub` = user id, signed with a dashboard signing key. Node helper is `signUserToken` (`@knocklabs/node/lib/tokenSigner`). With the mode off, the public key can act as any user [9] | HMAC-SHA256(secretKey, subscriberId) → `subscriberHash` prop. Opt-in toggle; the Inbox refuses to load when the toggle is on and the hash is missing. No plan restriction stated [12] | User JWT, HS256 with the project secret key. Claims are `api_key` plus `user_external_id` and/or `user_email`. Always required [14] | Backend calls `POST /auth/issue-token` (`client.auth.issueToken({ scope, expires_in })`). The scope string includes `user_id:<id> inbox:read:messages inbox:write:events`. Omitting the expiry gives a non-expiring token, and the SDKs do not refresh tokens [19] | ES256 JWT (`entity_type: "subscriber"`, `entity_id`, `exp`, `iat`, optional tenant `scope`) signed with a dashboard key. Required in Enhanced Security Mode. The older HMAC flow is EOL [21][17] |
| **Real-time** | Socket connection. Can disconnect inactive tabs [7] | Docs say unread counts and actions stay in sync. Transport not named [8] | WebSocket realtime client [13] | WebSocket, opt-in via `inbox.listenForUpdates()` [15] | Not stated on the pages read |
| **SSR / React Router** | No SSR guidance in docs [6][7] | Next.js quickstart puts `'use client'` on the Inbox file. No SSR guidance [22] | No SSR guidance [11] | Docs say the Inbox "render[s] client-side only". `'use client'` is needed in Next.js [15] | No SSR guidance found |
| **Self-host escape hatch** | None found | Yes. Open source, dual-licensed `LICENSE-MIT` + `LICENSE-ENTERPRISE`. Some Cloud features are missing in self-host [23][24] | None found | None found | None found |

[npm] = npm registry metadata (`npm view <pkg>`), checked 2026-11-09.

## What this means for React Router SSR

None of the five vendors documents SSR rendering of the feed. Every feed is a browser-side, socket-backed widget. The Next.js docs (Courier, Novu) treat it as a client component. In Cadence the practical pattern is the same for all five:

1. Mint the user credential in a route `loader` on the Node server: the JWT, HMAC or token.
2. Pass it to the client.
3. Mount the provider/feed client-only, for example behind a hydration check or a `lazy` client boundary.

This is an inference from the docs, not something any vendor documents for React Router.

Courier is the one vendor whose credential costs an extra network round trip: `issue-token` is an API call. Knock, Novu, MagicBell and SuprSend sign the credential locally, with no network call [9][12][14][21].

## Shortlist (2–3, unranked)

1. **Knock**
   - 10k messages/mo free with no hard cap.
   - The most complete React story: prebuilt feed, a separate headless `react-core` package, and toasts.
   - Locally signed RS256 user tokens with a Node helper.
   - Costs: Knock branding stays on free, and the paid step is steep ($250/mo).
2. **Novu Cloud**
   - 10k runs/mo free and the cheapest paid step ($30/mo).
   - `<Inbox />` plus headless `@novu/react`/`@novu/js`.
   - Simple HMAC `subscriberHash`.
   - The only one with a self-host escape hatch (MIT core).
   - Costs: Novu branding on free, 24h activity retention, and a 20-workflow cap.
3. **Courier**
   - 10k sends/mo free and then pure pay-as-you-go, with no monthly floor.
   - Prebuilt inbox, a `useCourier()` hook, and explicit client-only/SSR docs.
   - Costs: auth needs a server API call per token, the token has no auto-refresh, and the Inbox is not listed in the free plan's features (unverified either way) [4].

Not shortlisted:

- **MagicBell**: only 1,000 deliveries/mo free and no documented headless hooks package.
- **SuprSend**: its free tier gates user preferences and digest/batching, the feed is branded, and real-time and SSR are undocumented on the pages read. It would still meet the bare constraints.

## Facts the choice hinges on

- **Is a branded feed acceptable on the free tier?** Knock, Novu and SuprSend all brand the free feed. Courier and MagicBell's pricing pages do not mention branding [1][2][3][4][5].
- **Paid price when Cadence outgrows free:** Novu $30/mo, SuprSend $100/mo, MagicBell $249/mo, Knock $250/mo. Courier has no floor and charges $0.005/send.
- **Is a self-host exit wanted?** Only Novu has one.
- **Auth model:**
  - A local JWT/HMAC sign in the loader: Knock, Novu, MagicBell, SuprSend.
  - A server-to-vendor token call that Cadence must refresh: Courier.
  - For Knock and Novu, secure identification is an opt-in toggle. It must be switched on, or anyone holding the public key can read any user's feed [9][12].
- **Is a headless path needed** for Cadence's UI? Knock, Novu, Courier and SuprSend document one. MagicBell does not.
- **Open questions** none of the pages answered, worth a quick check in the decision ticket:
  - Is Knock's enhanced security mode available on the free plan?
  - Is Courier Inbox included in the free Developer plan?
  - What real-time transport do Novu and SuprSend use?

## Sources (accessed 2026-11-09)

1. Knock pricing: https://knock.app/pricing
2. Novu pricing: https://novu.co/pricing
3. MagicBell pricing: https://www.magicbell.com/pricing
4. Courier pricing: https://www.courier.com/pricing
5. SuprSend pricing: https://www.suprsend.com/pricing
6. Knock React overview: https://docs.knock.app/in-app-ui/react/overview
7. Knock React feed / headless: https://docs.knock.app/in-app-ui/react/feed, https://docs.knock.app/in-app-ui/react/headless/feed
8. Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
9. Knock security & authentication: https://docs.knock.app/in-app-ui/security-and-authentication
10. Novu TypeScript server SDK: https://docs.novu.co/platform/sdks/server/typescript
11. MagicBell React library: https://www.magicbell.com/docs/libraries/magicbell-react
12. Novu Inbox production prep (HMAC): https://docs.novu.co/platform/inbox/prepare-for-production
13. MagicBell JS (project/user client, realtime): https://www.magicbell.com/docs/libraries/magicbell-js
14. MagicBell user JWT: https://www.magicbell.com/docs/api/authentication/user
15. Courier React SDK: https://www.courier.com/docs/sdk-libraries/courier-react-web
16. Courier Node SDK: https://www.courier.com/docs/sdk-libraries/node
17. SuprSend React inbox: https://docs.suprsend.com/docs/inbox-react
18. SuprSend React SDK / headless: https://docs.suprsend.com/docs/react-headless, https://www.npmjs.com/package/@suprsend/react-core
19. Courier authenticate users: https://www.courier.com/docs/in-app/authenticate-users
20. SuprSend Node workflow trigger: https://docs.suprsend.com/docs/node-trigger-workflow-from-api
21. SuprSend client authentication: https://docs.suprsend.com/docs/client-authentication
22. Novu Next.js quickstart: https://docs.novu.co/platform/quickstart/nextjs
23. Novu self-hosting overview: https://docs.novu.co/community/self-hosting-novu/overview
24. Novu repo licence files (`LICENSE-MIT`, `LICENSE-ENTERPRISE`): https://github.com/novuhq/novu
