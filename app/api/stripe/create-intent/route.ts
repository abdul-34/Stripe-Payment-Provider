import { NextRequest, NextResponse } from 'next/server';
import { getStripeSecretKey, getOrCreateStripeCustomer } from '@/lib/db/payment';
import Stripe from 'stripe';

/* eslint-disable */

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // --- NEW/UPDATED ---
        const { mode, amount, currency, contactId, locationId } = body;

        if (!mode || !contactId || !locationId) {
            return NextResponse.json({ error: 'Missing required fields: mode, contactId, or locationId' }, { status: 400 });
        }
        
        const secretKey = await getStripeSecretKey(locationId);
        const stripe = new Stripe(secretKey);
        const stripeCustomerId = await getOrCreateStripeCustomer(contactId, locationId, stripe);

        // --- NEW/UPDATED ---
        // Handle both 'payment' and 'setup' modes
        if (mode === 'setup') {
            // Create a SetupIntent to save a card
            const setupIntent = await stripe.setupIntents.create({
                customer: stripeCustomerId,
                payment_method_types: ['card'],
                usage: 'off_session', // This is key for saving the card
            });
            return NextResponse.json({ clientSecret: setupIntent.client_secret });
        
        } else {
            // This is the existing logic for one-time payments
            if (!amount || !currency) {
                 return NextResponse.json({ error: 'Missing amount or currency for payment mode' }, { status: 400 });
            }
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: currency,
                customer: stripeCustomerId,
                automatic_payment_methods: { enabled: true },
            });
            return NextResponse.json({ clientSecret: paymentIntent.client_secret });
        }

    } catch (error: any) {
        console.error("Error creating intent:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}