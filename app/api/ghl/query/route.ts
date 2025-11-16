import { NextRequest, NextResponse } from 'next/server';
import {
    getOrCreateStripeCustomer,
    getStripeSecretKey,
    verifyGhlApiKey
    // We'll need to create this simple helper
} from '@/lib/db/payment';
import Stripe from 'stripe';

/* eslint-disable */

// --- NEW HELPER ---
// You can add this to lib/db/payment.ts or just use it here


export async function POST(req: NextRequest) {
    const body = await req.json();
    const { type, locationId, amount, transactionId, ...data } = body;

    const apiKey = req.headers.get('apiKey');
    if (!apiKey || !locationId || !type) {
        return NextResponse.json({ error: 'Unauthorized: Missing credentials' }, { status: 401 });
    }

    const isValid = await verifyGhlApiKey(locationId, apiKey);
    if (!isValid) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    let stripe: Stripe;
    try {
        const secretKey = await getStripeSecretKey(locationId);
        stripe = new Stripe(secretKey);
    } catch (error: any) {
        return NextResponse.json({ error: `Configuration error: ${error.message}` }, { status: 400 });
    }

    console.log(`Received GHL Query Event: ${type}`);

    // --- NEW/UPDATED ---
    // This is the fully expanded switch based on the official docs
    switch (type) {

        case 'verify': // --- UPDATED --- (from 'payment_verification')
            try {
                const { chargeId } = data; // 'chargeId' is in the data object
                const paymentIntent = await stripe.paymentIntents.retrieve(chargeId);

                if (paymentIntent.status === 'succeeded') {
                    return NextResponse.json({ success: true });
                } else {
                    return NextResponse.json({ failed: true, message: `Payment status: ${paymentIntent.status}` });
                }
            } catch (error: any) {
                return NextResponse.json({ failed: true, message: error.message });
            }

        case 'refund':
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: transactionId,
                    amount: amount,
                });
                // --- UPDATED --- (Return the snapshot as requested by docs)
                return NextResponse.json({ success: true, refundSnapshot: refund });
            } catch (error: any) {
                return NextResponse.json({ failed: true, message: error.message });
            }

        case 'list_payment_methods': // --- NEW ---
            try {
                const { contactId } = data;
                const stripeCustomerId = await getOrCreateStripeCustomer(contactId, locationId, stripe);
                if (!stripeCustomerId) {
                    return NextResponse.json([]); // Return empty array if no customer
                }

                const paymentMethods = await stripe.paymentMethods.list({
                    customer: stripeCustomerId,
                    type: 'card',
                });

                // Format the response exactly as GHL expects
                const formattedMethods = paymentMethods.data.map(pm => ({
                    id: pm.id,
                    type: 'card',
                    title: `${pm.card?.brand.toUpperCase()} ending in ${pm.card?.last4}`,
                    subTitle: `Expires ${pm.card?.exp_month}/${pm.card?.exp_year.toString().slice(-2)}`,
                    expiry: `${pm.card?.exp_month}/${pm.card?.exp_year.toString().slice(-2)}`,
                    customerId: stripeCustomerId,
                    imageUrl: 'https://play-lh.googleusercontent.com/2PS6w7uBztfuMys5fgodNkTwTOE6bLVB2cJYbu5GHlARAK36FzO5bUfMDP9cEJk__cE'
                }));

                return NextResponse.json(formattedMethods);
            } catch (error: any) {
                return NextResponse.json({ failed: true, message: error.message });
            }

        case 'charge_payment': // --- UPDATED ---
            try {
                const { paymentMethodId, contactId, currency } = data;
                const stripeCustomerId = await getOrCreateStripeCustomer(contactId, locationId, stripe);

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: currency,
                    payment_method: paymentMethodId,
                    customer: stripeCustomerId,
                    off_session: true,
                    confirm: true,
                });

                // --- UPDATED --- (Return the full snapshot GHL expects)
                return NextResponse.json({
                    success: true,
                    chargeId: paymentIntent.id,
                    message: paymentIntent.status === 'succeeded' ? 'Success' : 'Pending',
                    chargeSnapshot: {
                        id: paymentIntent.id,
                        status: paymentIntent.status, // 'succeeded', 'failed', 'pending'
                        amount: paymentIntent.amount,
                        chargeId: paymentIntent.id,
                        chargedAt: paymentIntent.created // unix timestamp
                    }
                });

            } catch (error: any) {
                return NextResponse.json({ failed: true, message: error.message });
            }

        case 'create_subscription': // --- NEW ---
            try {
                const { contactId, paymentMethodId, subscriptionId, startDate, currency, productDetails } = data;
                const stripeCustomerId = await getOrCreateStripeCustomer(contactId, locationId, stripe);
                if (!stripeCustomerId) {
                    return NextResponse.json({ failed: true, message: 'Stripe customer not found.' });
                }

                // 1. Set default payment method for the subscription
                await stripe.customers.update(stripeCustomerId, {
                    invoice_settings: { default_payment_method: paymentMethodId }
                });

                // 2. Get price details
                // TODO: You need robust logic to map GHL Products/Prices to Stripe Products/Prices
                const ghlPrice = productDetails[0].prices[0];
                const stripePriceId = "price_...YOUR_STRIPE_PRICE_ID"; // Placeholder!

                // 3. Calculate start date
                const billingCycleAnchor = new Date(startDate).getTime() / 1000;

                // 4. Create the subscription in Stripe
                const subscription: Stripe.Subscription = await stripe.subscriptions.create({
                    customer: stripeCustomerId,
                    items: [{ price: stripePriceId }],
                    billing_cycle_anchor: billingCycleAnchor,
                    proration_behavior: 'none',
                    metadata: {
                        ghlSubscriptionId: subscriptionId,
                        ghlLocationId: locationId
                    }
                });

                // 5. Format and return the exact response GHL wants
                return NextResponse.json({
                    success: true,
                    message: "Subscription created",
                    // No transaction object, as it starts in the future
                    transaction: null,
                    subscription: {
                        subscriptionId: subscription.id,
                        subscriptionSnapshot: {
                            id: subscription.id,
                            status: subscription.status, // 'scheduled', 'active', etc.
                            trialEnd: subscription.trial_end,
                            createdAt: subscription.created,
                            nextCharge: subscription?.trial_end || ""   // NEED MODIFICATION
                        }
                    }
                });
            } catch (error: any) {
                return NextResponse.json({ failed: true, message: error.message });
            }

        default:
            console.warn(`Unhandled event type: ${type}`);
            return NextResponse.json({ success: false, message: 'Unhandled event type' });
    }
}