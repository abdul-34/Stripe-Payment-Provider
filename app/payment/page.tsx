"use client";

import { useEffect, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

/* eslint-disable */

const Loader = () => <div>Loading Checkout...</div>;

// --- NEW/UPDATED ---
// CheckoutForm now takes a 'mode' prop to decide what to do
/* eslint-disable */
const CheckoutForm = () => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: "if_required",
            });

            if (error) {
                console.error("Stripe error:", error.message);
                window.parent.postMessage({ type: 'custom_element_error_response', error: { description: error.message } }, '*');
                setIsProcessing(false);
                return;
            }

            if (paymentIntent?.status === 'succeeded') {
                // Notify GHL that payment succeeded
                window.parent.postMessage({
                    type: 'custom_element_success_response',
                    chargeId: paymentIntent.id,
                }, '*');
            } else {
                window.parent.postMessage({ type: 'custom_element_error_response', error: { description: 'Payment not successful.' } }, '*');
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

/* eslint-disable */
export default function PaymentPage() {
    const [stripePromise, setStripePromise] = useState<any>(null);
    const [options, setOptions] = useState<StripeElementsOptions | null>(null);

    // --- NEW ---
    // Get the parent origin from your screenshot
    const ghlParentOrigin = "https://api.highlmpct.com";

    useEffect(() => {
        // --- 1. Set up the persistent "ready" message ---
        const intervalId = setInterval(() => {
            console.log("Sending 'custom_provider_ready' to parent...");
            window.parent.postMessage({
                type: 'custom_provider_ready',
                loaded: true,
                addCardOnFileSupported: true // From the new docs
            }, ghlParentOrigin); // Be specific about the target
        }, 300); // Send every 300ms

        // --- 2. Set up the safer message listener ---
        const handleGhlMessage = (event: MessageEvent) => {

            // --- CRITICAL: Filter by origin ---
            // This will stop all the red errors
            if (event.origin !== ghlParentOrigin) {
                return;
            }

            console.log("RECEIVED MESSAGE FROM GHL:", event.data);

            // Safety check
            if (typeof event.data !== 'object' || event.data === null || !event.data.type) {
                console.warn("GHL message is not a valid object with a 'type' property.");
                return;
            }

            // --- 3. Handle the event ---
            if (event.data.type === 'payment_initiate_props' || event.data.type === 'setup_initiate_props') {

                // We got the event! Stop the interval.
                clearInterval(intervalId);

                const {
                    publishableKey,
                    amount,
                    currency,
                    contact,
                    locationId,
                    mode
                } = event.data;

                const contactId = contact?.id;

                if (!publishableKey) {
                    console.error("FATAL: No publishableKey received from GHL.");
                    window.parent.postMessage({ type: 'custom_element_error_response', error: { description: 'Configuration error: publishableKey is missing.' } }, '*');
                    return;
                }

                if (!contactId) {
                    console.error("FATAL: No contactId received from GHL.");
                    window.parent.postMessage({ type: 'custom_element_error_response', error: { description: 'Configuration error: contactId is missing.' } }, '*');
                    return;
                }

                setStripePromise(loadStripe(publishableKey));

                axios.post('/api/stripe/create-intent', {
                    mode: mode,
                    amount,
                    currency,
                    contactId,
                    locationId
                })
                    .then(res => {
                        const { clientSecret } = res.data;
                        setOptions({
                            clientSecret,
                            appearance: { theme: 'stripe' }
                        });
                    })
                    .catch(err => {
                        console.error("Failed to create Payment Intent:", err);
                        window.parent.postMessage({
                            type: 'custom_element_error_response',
                            error: 'Failed to initialize payment (server error).'
                        }, '*');
                    });
            }
        };

        window.addEventListener('message', handleGhlMessage);

        // Cleanup function
        return () => {
            window.removeEventListener('message', handleGhlMessage);
            clearInterval(intervalId);
        };
    }, []); // Run only once

    // Wait until both stripe and options are ready
    if (!options || !stripePromise) return <Loader />;

    return (
        <Elements stripe={stripePromise} options={options}>
            <CheckoutForm />
        </Elements>
    );
}