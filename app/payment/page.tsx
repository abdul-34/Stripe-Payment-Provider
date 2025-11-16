"use client";

import { useEffect, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

const Loader = () => <div>Loading Checkout...</div>



const CheckoutForm = () => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: any) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: "if_required",
            });

            if (error) {
                window.parent.postMessage({
                    type: "custom_element_error_response",
                    error: { description: error.message }
                }, "*");

                setIsProcessing(false);
                return;
            }

            if (paymentIntent?.status === "succeeded") {
                window.parent.postMessage({
                    type: "custom_element_success_response",
                    chargeId: paymentIntent.id
                }, "*");
            }

        } catch (err: any) {
            window.parent.postMessage({
                type: "custom_element_error_response",
                error: { description: err.message }
            }, "*");
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement />
            <button disabled={!stripe || !elements || isProcessing}>
                {isProcessing ? "Processing..." : "Pay Now"}
            </button>
        </form>
    );
};

export default function PaymentPage() {
    const [stripePromise, setStripePromise] = useState<any>(null);
    const [options, setOptions] = useState<StripeElementsOptions | null>(null);

    useEffect(() => {
        // Continuously send ready message to GHL until props arrive
        const readyInterval = setInterval(() => {
            window.parent.postMessage({
                type: "custom_provider_ready",
                loaded: true,
                addCardOnFileSupported: true
            }, "*");
        }, 300);

        function safeParse(data: any) {
            try {
                return typeof data === "string" ? JSON.parse(data) : data;
            } catch {
                return null;
            }
        }

        const onMessage = async (event: MessageEvent) => {
            const parsed = safeParse(event.data);
            if (!parsed || !parsed.type) return;

            console.log("GOT EVENT:", parsed);

            if (parsed.type === "payment_initiate_props" || parsed.type === "setup_initiate_props") {
                clearInterval(readyInterval);

                const {
                    publishableKey,
                    amount,
                    currency,
                    contact,
                    locationId,
                    mode
                } = parsed;

                if (!publishableKey) {
                    window.parent.postMessage({
                        type: "custom_element_error_response",
                        error: { description: "Stripe publishableKey missing." }
                    }, "*");
                    return;
                }

                setStripePromise(loadStripe(publishableKey));

                try {
                    const res = await axios.post("/api/stripe/create-intent", {
                        mode,
                        amount,
                        currency,
                        contactId: contact?.id,
                        locationId
                    });

                    setOptions({
                        clientSecret: res.data.clientSecret,
                        appearance: { theme: "stripe" }
                    });

                } catch (err) {
                    window.parent.postMessage({
                        type: "custom_element_error_response",
                        error: { description: "Failed to create Stripe Intent." }
                    }, "*");
                }
            }
        };

        window.addEventListener("message", onMessage);

        return () => {
            clearInterval(readyInterval);
            window.removeEventListener("message", onMessage);
        };
    }, []);

    if (!stripePromise || !options) return <Loader />;

    return (
        <Elements stripe={stripePromise} options={options}>
            <CheckoutForm />
        </Elements>
    );
}
