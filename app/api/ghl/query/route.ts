import { NextRequest, NextResponse } from 'next/server';
import { getStripeSecretKey, verifyGhlApiKey } from '@/lib/db/payment';
import Stripe from 'stripe';

/**
 * Main GHL Payment Provider Webhook
 * This handles all server-to-server requests from GHL.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, locationId, amount, transactionId, ...data } = body;
  
  // --- 1. SECURITY CHECK ---
  // Get the 'apiKey' GHL sends in the headers
  const apiKey = req.headers.get('apiKey');
  if (!apiKey || !locationId) {
    return NextResponse.json({ error: 'Unauthorized: Missing credentials' }, { status: 401 });
  }

  const isValid = await verifyGhlApiKey(locationId, apiKey);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  // --- 2. GET STRIPE KEY ---
  // We are now authenticated. Let's get the agency's key to do work.
  let stripe: Stripe;
  try {
    const secretKey = await getStripeSecretKey(locationId);
    stripe = new Stripe(secretKey);
  } catch (error: any) {
    return NextResponse.json({ error: `Configuration error: ${error.message}` }, { status: 400 });
  }

  // --- 3. HANDLE GHL EVENTS ---
  console.log(`Received GHL Query Event: ${type}`);
  
  switch (type) {
    
    /**
     * GHL asks: "The iFrame said this payment was successful. Is it true?"
     */
    case 'payment_verification':
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
        
        if (paymentIntent.status === 'succeeded') {
          return NextResponse.json({ success: true });
        } else {
          return NextResponse.json({ failed: true, message: `Payment status: ${paymentIntent.status}` });
        }
      } catch (error: any) {
        return NextResponse.json({ failed: true, message: error.message });
      }

    /**
     * GHL asks: "Please refund this transaction."
     */
    case 'refund':
      try {
        const refund = await stripe.refunds.create({
          payment_intent: transactionId,
          amount: amount, // GHL sends the amount to refund
        });
        // You MUST return the full refund object snapshot
        return NextResponse.json({ success: true, refundSnapshot: refund });
      } catch (error: any) {
        return NextResponse.json({ failed: true, message: error.message });
      }
      
    /**
     * GHL asks: "Charge this customer's saved card (off-session)."
     */
    case 'charge_payment':
      try {
        const { paymentMethodId, contactId, currency } = body;
        // TODO: You need logic to get the Stripe Customer ID
        // const stripeCustomerId = await getStripeCustomer(contactId, locationId);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: currency,
          payment_method: paymentMethodId,
          // customer: stripeCustomerId,
          off_session: true, // Mark as off-session
          confirm: true,     // Attempt to charge immediately
        });

        // You MUST return a detailed charge snapshot
        return NextResponse.json({
          success: true,
          chargeSnapshot: paymentIntent,
          chargeId: paymentIntent.id
        });
        
      } catch (error: any) {
        // Handle failed off-session payments (e.g., card declined)
        return NextResponse.json({ failed: true, message: error.message });
      }

    // ... Handle other cases like 'list_payment_methods', 'create_subscription', etc.

    default:
      console.warn(`Unhandled event type: ${type}`);
      return NextResponse.json({ success: false, message: 'Unhandled event type' });
  }
}