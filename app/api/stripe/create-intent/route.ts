import { NextRequest, NextResponse } from 'next/server';
import { getStripeSecretKey } from '@/lib/db/payment'; // The helper we just made
import Stripe from 'stripe';

/* eslint-disable */


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, contactId, locationId } = body;

    if (!amount || !currency || !locationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get the agency's secret key from your DB
    const secretKey = await getStripeSecretKey(locationId);
    const stripe = new Stripe(secretKey);
    
    // TODO: You should create/retrieve a Stripe Customer ID
    // using the GHL contactId and save it.
    // const stripeCustomerId = await getOrCreateStripeCustomer(contactId, locationId);

    // 2. Create a Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount is in cents
      currency: currency,
      automatic_payment_methods: { enabled: true },
      // customer: stripeCustomerId,
    });

    // 3. Send the client_secret back to the frontend
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });

  } catch (error: any) {
    console.error("Error creating payment intent:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}