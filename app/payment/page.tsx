"use client";

import { useEffect, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

/* eslint-disable */

const Loader = () => <div>Loading Checkout...</div>;

// --- NEW/UPDATED ---
// CheckoutForm now takes a 'mode' prop to decide what to do
const CheckoutForm = ({ mode }: { mode: 'payment' | 'setup' }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;
        setIsProcessing(true);

        try {
            if (mode === 'setup') {
                // --- NEW ---
                // This is for "Add Payment Method"
                const { error } = await stripe.confirmSetup({
                    elements,
                    redirect: "if_required",
                });

                if (error) {
                    console.error("Stripe Setup error:", error.message);
                    window.parent.postMessage({ type: 'custom_element_error_response', error: { description: error.message } }, '*');
                    setIsProcessing(false);
                    return;
                }

                // On success, just send the success event
                window.parent.postMessage({ type: 'custom_element_success_response' }, '*');

            } else {
                // --- EXISTING LOGIC ---
                // This is for a one-time payment
                const { error, paymentIntent } = await stripe.confirmPayment({
                    elements,
                    redirect: "if_required",
                });

                if (error) {
                    console.error("Stripe Payment error:", error.message);
                    window.parent.postMessage({ type: 'custom_element_error_response', error: { description: error.message } }, '*');
                    setIsProcessing(false);
                    return;
                }

                if (paymentIntent?.status === 'succeeded') {
                    // We MUST send the chargeId for verification
                    window.parent.postMessage({
                        type: 'custom_element_success_response',
                        chargeId: paymentIntent.id,
                    }, '*');
                } else {
                    window.parent.postMessage({ type: 'custom_element_error_response', error: { description: 'Payment not successful.' } }, '*');
                }
            }

        } catch (e: any) {
            window.parent.postMessage({ type: 'custom_element_error_response', error: { description: e.message } }, '*');
        }

        setIsProcessing(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <PaymentElement id="payment-element" />
            <button disabled={isProcessing || !stripe || !elements} id="submit" style={{ marginTop: '10px' }}>
                <span id="button-text">{isProcessing ? "Processing..." : "Pay now"}</span>
            </button>
        </form>
    );
};


export default function PaymentPage() {
    const [stripePromise, setStripePromise] = useState<any>(null);
    const [options, setOptions] = useState<StripeElementsOptions & { mode?: 'payment' | 'setup' } | null>(null);
    const [isGhlReady, setIsGhlReady] = useState(false);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isGhlReady) {
                clearInterval(intervalId);
                return;
            }

            // --- NEW/UPDATED ---
            // Send the full ready event as per the new docs
            window.parent.postMessage({
                type: 'custom_provider_ready',
                loaded: true,
                addCardOnFileSupported: true // We support saving cards!
            }, '*');
        }, 200);

        const handleGhlMessage = (event: MessageEvent) => {
            console.log("ghl_payment_event", event);

            if (typeof event.data !== 'object' || event.data === null || !event.data.type) {
                return;
            }

            // --- NEW/UPDATED ---
            // We now handle TWO types of events
            if (event.data.type === 'payment_initiate_props' || event.data.type === 'setup_initiate_props') {
                setIsGhlReady(true);
                clearInterval(intervalId);

                const {
                    publishableKey,
                    amount,
                    currency,
                    contact, // Get the contact object
                    locationId,
                    mode // This will be 'payment' or 'setup'
                } = event.data;

                const contactId = contact?.id;

                if (!contactId) {
                    console.error("No Contact ID provided");
                    window.parent.postMessage({ type: 'custom_element_error_response', error: { description: 'Contact ID is missing.' } }, '*');
                    return;
                }

                setStripePromise(loadStripe(publishableKey));

                // Call our backend to create either a PaymentIntent or a SetupIntent
                axios.post('/api/stripe/create-intent', {
                    mode: mode, // 'payment' or 'setup'
                    amount,
                    currency,
                    contactId,
                    locationId
                })
                    .then(res => {
                        const { clientSecret } = res.data;
                        setOptions({
                            clientSecret,
                            mode: mode, // Pass the mode to the Elements options
                            appearance: { theme: 'stripe' }
                        });
                    })
                    .catch(err => {
                        console.error("Failed to create Intent:", err);
                        window.parent.postMessage({ type: 'custom_element_error_response', error: { description: 'Failed to initialize payment.' } }, '*');
                    });
            }
        };

        window.addEventListener('message', handleGhlMessage);

        return () => {
            window.removeEventListener('message', handleGhlMessage);
            clearInterval(intervalId);
        };
    }, [isGhlReady]);

    if (!options || !stripePromise) return <Loader />;

    return (
        <Elements stripe={stripePromise} options={options}>
            {/* Pass the mode to our form */}
            <CheckoutForm mode={options.mode!} />
        </Elements>
    );
}