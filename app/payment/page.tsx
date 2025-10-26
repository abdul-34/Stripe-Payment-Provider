"use client";

import { useEffect, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

/* eslint-disable */


// A simple loading spinner component
const Loader = () => <div>Loading Checkout...</div>;

// This is the actual checkout form
const CheckoutForm = ({ publishableKey }: { publishableKey: string }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);

        try {
            // 1. Confirm the payment with Stripe
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    // You could redirect here, but for iFrames, 'if_required' is better
                    // return_url: `${window.location.origin}/order-complete`,
                },
                redirect: "if_required", // Keeps the user in your iFrame
            });

            if (error) {
                // 2. Tell GHL it FAILED
                console.error("Stripe error:", error.message);
                window.parent.postMessage({ type: 'custom_element_error_response', error: error.message }, '*');
                setIsProcessing(false);
                return;
            }

            if (paymentIntent?.status === 'succeeded') {
                // 3. Tell GHL it SUCCEEDED!
                window.parent.postMessage({
                    type: 'custom_element_success_response',
                    chargeId: paymentIntent.id, // This is the 'transactionId' GHL will verify
                }, '*');
            } else {
                window.parent.postMessage({ type: 'custom_element_error_response', error: 'Payment not successful.' }, '*');
            }

        } catch (e: any) {
            window.parent.postMessage({ type: 'custom_element_error_response', error: e.message }, '*');
        }

        setIsProcessing(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <PaymentElement id="payment-element" />
            <button disabled={isProcessing || !stripe || !elements} id="submit" style={{ marginTop: '10px' }}>
                <span id="button-text">
                    {isProcessing ? "Processing..." : "Pay now"}
                </span>
            </button>
        </form>
    );
};

// This is the main page component that GHL loads
export default function PaymentPage() {
    const [stripePromise, setStripePromise] = useState<any>(null);
    const [options, setOptions] = useState<StripeElementsOptions | null>(null);

    useEffect(() => {
        // This listener waits for GHL to send the payment details
        const handleGhlMessage = (event: MessageEvent) => {
            // IMPORTANT: Add origin check in production!
            // if (event.origin !== 'https://app.gohighlevel.com') return;

            if (event.data.type === 'payment_initiate_props') {
                const {
                    publishableKey, // The pk_... key you saved
                    amount,
                    currency,
                    contactId,
                    locationId
                } = event.data;

                // 1. Load Stripe.js with the specific agency's publishable key
                setStripePromise(loadStripe(publishableKey));

                // 2. Call your *own* backend to get a client_secret from Stripe
                axios.post('/api/stripe/create-intent', { amount, currency, contactId, locationId })
                    .then(res => {
                        const { clientSecret } = res.data;
                        setOptions({ clientSecret, appearance: { theme: 'stripe' } });
                    })
                    .catch(err => {
                        console.error("Failed to create Payment Intent:", err);
                        // Tell GHL the iFrame failed to load
                        window.parent.postMessage({ type: 'custom_element_error_response', error: 'Failed to initialize payment.' }, '*');
                    });
            }
        };

        window.addEventListener('message', handleGhlMessage);

        // 3. Tell GHL the iFrame is ready to receive data
        window.parent.postMessage({ type: 'custom_provider_ready' }, '*');

        return () => window.removeEventListener('message', handleGhlMessage);
    }, []);

    // 4. Render the Stripe form once we have all the keys
    if (!options || !stripePromise) {
        return <Loader />;
    }

    return (
        <Elements stripe={stripePromise} options={options}>
            <CheckoutForm publishableKey={options.clientSecret!} />
        </Elements>
    );
}