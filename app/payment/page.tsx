"use client";

import { useEffect, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

/* eslint-disable */

const Loader = () => <div>Loading Checkout...</div>;

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
                confirmParams: {},
                redirect: "if_required",
            });

            if (error) {
                console.error("Stripe error:", error.message);
                window.parent.postMessage({ type: 'custom_element_error_response', error: error.message }, '*');
                setIsProcessing(false);
                return;
            }

            if (paymentIntent?.status === 'succeeded') {
                // Notify GHL that payment succeeded
                window.parent.postMessage({
                    type: 'custom_element_success_response',
                    chargeId: paymentIntent.id,
                }, '*');

                // Optionally, notify your backend
                await axios.post('/api/stripe/payment-success', {
                    paymentIntentId: paymentIntent.id,
                });

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
                <span id="button-text">{isProcessing ? "Processing..." : "Pay now"}</span>
            </button>
        </form>
    );
};

export default function PaymentPage() {
    const [stripePromise, setStripePromise] = useState<any>(null);
    const [options, setOptions] = useState<StripeElementsOptions | null>(null);

    useEffect(() => {
        const handleGhlMessage = (event: MessageEvent) => {
            console.log("ghl_payment_event", event)
            // if (event.origin !== 'https://app.gohighlevel.com') return;

            if (event.data.type === 'payment_initiate_props') {
                const { publishableKey, amount, currency, contactId, locationId } = event.data;


                const test_key = "pk_test_51S9QRw44wSmYR5R4NvDcQ5WjLjSdz1oaco4Ff6e4DD6Q4lXIIOgrRltl1anBBfhjudKmi7Hph6I9tKGOD7o30yeo001RDTQHMx"

                // 1. Load Stripe with agency key
                const stripeInstance = loadStripe(publishableKey || test_key);
                setStripePromise(stripeInstance);

                // 2. Call your backend to create Payment Intent
                axios.post('/api/stripe/create-intent', {
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
                            error: 'Failed to initialize payment.'
                        }, '*');
                    });
            }
        };

        window.addEventListener('message', handleGhlMessage);
        window.parent.postMessage({ type: 'custom_provider_ready' }, '*');

        return () => window.removeEventListener('message', handleGhlMessage);
    }, []);

    // Wait until both stripe and options are ready
    if (!options || !stripePromise) return <Loader />;

    return (
        <Elements stripe={stripePromise} options={options}>
            <CheckoutForm />
        </Elements>
    );
}
