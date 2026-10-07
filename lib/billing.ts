// lib/billing.ts — shared Stripe + Supabase helpers (server-side only)
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Service-role client: bypasses RLS. Never import this into client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const PLAN_TO_PRICE: Record<string, string | undefined> = {
  cloud_mobile: process.env.STRIPE_PRICE_ID_CLOUD_MOBILE,
  cloud_mobile_plus: process.env.STRIPE_PRICE_ID_CLOUD_MOBILE_PLUS,
};

const PRICE_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(PLAN_TO_PRICE)
    .filter(([, price]) => !!price)
    .map(([tier, price]) => [price!, tier])
);

// Shapes that differ between Stripe API versions. The SDK types only model
// the current one, so the version-dependent fields are read through these.
type SubscriptionRef = string | { id: string } | null | undefined;
type InvoiceSubscriptionFields = {
  parent?: { subscription_details?: { subscription?: SubscriptionRef } | null } | null;
  subscription?: SubscriptionRef;
};
type PeriodEndField = { current_period_end?: number | null };

// Newer Stripe API versions moved invoice.subscription under invoice.parent
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = invoice as unknown as InvoiceSubscriptionFields;
  const id = legacy.parent?.subscription_details?.subscription ?? legacy.subscription;
  if (!id) return null;
  return typeof id === "string" ? id : id.id;
}

/**
 * Pull the subscription fresh from Stripe and upsert it into Supabase.
 * Always syncing from the source means duplicate or out-of-order events
 * can't leave stale data behind, so this is safe to call repeatedly.
 */
export async function syncSubscription(subscriptionId: string, userIdHint?: string | null) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let userId = sub.metadata?.supabase_user_id || userIdHint || null;
  if (!userId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error(`No Supabase user for subscription ${subscriptionId}`);

  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  // Newer API versions put the period end on the item, older ones on the subscription
  const periodEnd: number | null =
    (item as unknown as PeriodEndField | undefined)?.current_period_end ??
    (sub as unknown as PeriodEndField).current_period_end ??
    null;

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      price_id: priceId,
      tier: priceId ? PRICE_TO_TIER[priceId] ?? null : null,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}