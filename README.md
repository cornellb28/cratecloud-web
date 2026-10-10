# deepcrated-web

The payments and account website for DeepCrated. Next.js 16 (App Router) on
Vercel, sharing one Supabase project with the `cratecloud-v3` desktop app.

**The desktop app is free and gates nothing.** This site sells the one paid
thing that exists: the cloud sync / mobile subscription. It is also the only
place a Stripe secret or a Supabase service-role key is allowed to live.

## How the two halves fit

```
Desktop (Electron)                    Website (this repo)
──────────────────                    ───────────────────
Supabase anon key                     Supabase anon key   (user reads)
reads entitlements  ◄── RLS ──────►   Supabase SERVICE ROLE (webhook writes)
own-row SELECT only                   Stripe secret key
                                             │
     deepcrated://checkout-complete  ◄───────┘ after checkout
```

Neither half calls the other. They meet at one Postgres row:
`public.entitlements`, one per account, created at signup by a database
trigger. Its migrations live in the **desktop** repo at
`cratecloud-v3/supabase/migrations/` — that is still the source of truth for
the schema. This repo only reads and writes it.

The Stripe webhook is the sole writer of `plan` and `status`. There is
deliberately no INSERT or UPDATE policy for authenticated users: a client
that could set its own `plan` is not an entitlement, it's a suggestion.

## Setup

```bash
cp .env.local.example .env.local   # then fill it in — see the comments
npm install
npm run dev
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the same
pair the desktop app uses (`MAIN_VITE_`-prefixed in `cratecloud-v3/.env`).
Everything else is new and server-only.

### Supabase dashboard

Authentication → URL Configuration → **Redirect URLs** must include this
site's callback alongside the desktop's:

```
http://localhost:3000/auth/callback
https://<your-vercel-url>/auth/callback
https://deepcrated.com/auth/callback     # once the domain exists
deepcrated://auth-callback               # already there, for the desktop
```

The Google Cloud Console redirect URI does **not** change — it points at
Supabase's `/auth/v1/callback`, not at either of ours.

### Stripe

Three products (Sync $10, Library $19, Touring $55 per month), each with a
monthly and an annual recurring price (annual = 10x monthly: $100 / $190 / $550),
in **test mode** until told otherwise. Put the six **price** ids (`price_…`, not
`prod_…`) in `STRIPE_PRICE_SYNC`, `STRIPE_PRICE_SYNC_ANNUAL`,
`STRIPE_PRICE_LIBRARY`, `STRIPE_PRICE_LIBRARY_ANNUAL`, `STRIPE_PRICE_TOURING` and
`STRIPE_PRICE_TOURING_ANNUAL`. The mapping lives in `lib/price-map.ts`. A price
id the webhook does not recognise is logged and ignored; it never grants access.

TODO(live-mode): create the six LIVE-mode prices and swap them into Production
before launch.

Configure the Customer Portal at Settings → Billing → Customer portal, and
list all three products, with both their monthly and annual prices, under "Products" — otherwise upgrades are not offered and
the portal looks broken for reasons no code change will fix.

### The webhook, locally

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints its **own** signing secret. There are three different values in
play — local, test-mode dashboard, live-mode dashboard — and mixing them up
is the most common way this breaks.

Exercise every path:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

Then do it for real with test card `4242 4242 4242 4242`, and a failing one
with `4000 0000 0000 0341`.

## The four events

| Event | Writes |
|---|---|
| `checkout.session.completed` | `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `plan`, `status`, `current_period_end`, `cancel_at_period_end` |
| `customer.subscription.updated` | same, minus the customer link — **sole writer of `status`** |
| `customer.subscription.deleted` | `plan='free'`, `status='canceled'`, clears subscription/price/period; **keeps** `stripe_customer_id` |
| `invoice.payment_failed` | **nothing** — notification only |

`customer.subscription.created` is deliberately unhandled: it would race
`checkout.session.completed` for the same row.

Response codes are load-bearing, because Stripe retries non-2xx for three
days: **400** bad signature (never retry), **500** transient DB failure (do
retry), **200** handled, ignored, or unresolvable.

## Two Stripe API gotchas, already handled

Both were verified against `stripe@22.6.2` / API `2026-08-26.dahlia`:

1. `current_period_end` has been **removed from `Subscription`** and lives on
   the subscription *item*. See `periodEndISO()` in `lib/stripe.ts`. Reading
   the old field gives `undefined` and a silently null renew date.
2. `subscription` has been **removed from `Invoice`** — it is now at
   `invoice.parent.subscription_details.subscription`.

If you bump `STRIPE_API_VERSION`, re-check both.

## The entitlement rule

One place, `isEntitled()` in `lib/plans.ts`:

```
entitled = status in ('active','trialing')
           or (status = 'past_due' and current_period_end > now())
```

It cannot live in the database — it depends on `current_period_end` as well
as `status`, which no check constraint can express. The `past_due` grace is
what stops a retryable card from cutting a DJ off mid-set.

## Security

- `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` are **server-only** and
  must never appear in `cratecloud-v3`. `lib/supabase/admin.ts` carries
  `server-only` so an accidental client import is a build failure.
- On Vercel, scope **live** keys to Production only. Preview deployments get
  their environment too; use Stripe test keys there and turn on deployment
  protection.
- User-facing reads (`/dashboard`, `/account`) go through the **anon** client
  with the user's session so RLS scopes them. The service role is for the
  webhook and the checkout route's customer lookup, and nothing else.
- The browser sends a tier **key**, never a price id. If it could name a
  price it could name a cheaper one.

## Deploying

Vercel, root directory = repo root. Nothing here needs anything Vercel does
not do natively.

Once `deepcrated.com` is registered, update in this order:
`NEXT_PUBLIC_SITE_URL` → Supabase Redirect URLs → the Stripe webhook endpoint
URL (**which issues a new signing secret** — update `STRIPE_WEBHOOK_SECRET`
in the same deploy or every event 400s).

Until then, the `*.vercel.app` URL works for all of it.
