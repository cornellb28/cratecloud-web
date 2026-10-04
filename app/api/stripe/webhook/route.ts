// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe, syncSubscription, invoiceSubscriptionId } from "@/lib/billing";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text(); // raw body required for signature verification
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(subId, session.client_reference_id);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub.id);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const subId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
        if (subId) await syncSubscription(subId);
        // TODO (payment_failed): email the user to update their card
        break;
      }
    }
  } catch (err) {
    // A 500 makes Stripe retry, which is what we want if Supabase or Stripe hiccuped
    console.error(`Failed handling ${event.type} (${event.id}):`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}