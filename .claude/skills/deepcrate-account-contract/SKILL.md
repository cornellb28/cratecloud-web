---
name: "deepcrate-account-contract"
description: Shared account and entitlement contract between the DeepCrate desktop app (cratecloud-v3) and website (deepcrate-web). Use whenever work touches plans, subscriptions, entitlements, Supabase accounts, Stripe-to-account mapping, or any change that must stay consistent across both repos, even if the user just says "accounts", "plan", or "billing". Identical copy lives in both repos.
---
 
# DeepCrate account contract (v2, 2026-10-05)
 
Identical copy in `cratecloud-v3` and `deepcrate-web`. If you change this file, say so explicitly so the other repo's copy is updated in the same sitting, and bump the version/date above.
 
## Decided
- **Supabase** (auth + Postgres) is the account system, one project shared by desktop and website. Login: email/password and Google OAuth.
- **Sign-in is optional.** The desktop app is fully usable signed out; an account is only needed for cloud sync and mobile. Never gate local features behind sign-in.
- **No intermediary API.** Desktop talks to Supabase directly; RLS scopes reads to the user's own rows.
- The **Stripe webhook** (Vercel serverless, in `deepcrate-web`) is the only server-side piece. It writes entitlements with the service role key and must not grow into a general API.
- Checkout and login return to the desktop app through its existing **custom protocol handler**.
- Desktop is free and ungated. Paid = cloud sync and mobile subscription tiers, **to be defined later**. Never invent plan names, prices, or limits.
## Entitlement record (PROPOSED, verify against the real migration)
One row per user: `user_id` (unique), `plan`, `status` (`active|trialing|past_due|canceled|none`), `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`, `updated_at`.
- RLS: SELECT own row only. No client INSERT/UPDATE/DELETE. Only the service role writes.
- A table of processed Stripe event IDs makes the webhook idempotent.
## Stripe to entitlement (PROPOSED)
- `checkout.session.completed`: link customer/subscription IDs via `client_reference_id` = Supabase `user_id`.
- `customer.subscription.created|updated`: set plan, status, period end from the subscription object.
- `customer.subscription.deleted`: status `canceled`.
- `invoice.payment_failed`: status `past_due`.
The subscription object is the source of truth, not event order.
## Round trip
Desktop opens the website in the system browser, then website auth/checkout, then redirect to `<custom-scheme>://auth/callback` (read the real scheme from the protocol handler), then desktop completes sign-in via PKCE/one-time code, then desktop re-reads its own entitlement row. Nothing in a deep link is proof of purchase. All redirect URLs must be on the Supabase allowlist.
 
## Hard rules
- Service role key and Stripe secret key never appear in the desktop repo, build, or prompts. Desktop gets only the Supabase URL and anon key.
- Only the webhook writes entitlements.
- Stripe **test mode** until the owner says go live.
- Owner's workflow: inspect first, no new dependencies without approval, confirm before touching any data layer, reuse existing infrastructure, explicit TODOs for deferred work.