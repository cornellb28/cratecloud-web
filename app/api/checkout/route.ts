// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { stripe, supabaseAdmin, PLAN_TO_PRICE } from "@/lib/billing";

// POST { plan: "cloud_mobile" | "cloud_mobile_plus" }
// Header: Authorization: Bearer <Supabase access token>
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { plan } = await req.json();
  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // Plan changes on an existing subscription go through the billing portal, not a second checkout
  if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
    return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      // Reuse the Stripe customer if this user subscribed before, so we never create duplicates
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.email }),
      // Lets subscription events map back to the user even before checkout.session.completed lands
      subscription_data: { metadata: { supabase_user_id: user.id } },
      // TODO: once the desktop protocol handler is wired, deep-link back into the app on success
      success_url: `${siteUrl}/account?checkout=success`,
      cancel_url: `${siteUrl}/pricing?checkout=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}