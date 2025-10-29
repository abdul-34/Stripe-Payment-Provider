import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // To generate secure API keys

/* eslint-disable */


// --- You will need to build these database helper functions ---
import {
    saveStripeKeysToDb    // Securely saves/updates keys for a locationId
} from '@/lib/db/payment'; // (This is a placeholder for your actual DB logic)
import { getAccessToken } from '@/lib/ghl';
// -------------------------------------------------------------

const GHL_CONNECT_API = 'https://services.leadconnectorhq.com/payments/custom-provider/connect';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            locationId,
            testPubKey,
            testSecKey,
            livePubKey,
            liveSecKey
        } = body;

        if (!locationId || !testPubKey || !testSecKey || !livePubKey || !liveSecKey) {
            return NextResponse.json({ success: false, error: 'Missing required keys.' }, { status: 400 });
        }

        // 1. --- Generate *our* API keys for GHL ---
        // This is the "apiKey" GHL asks for. It's a key WE create to verify
        // that future requests from GHL (to our queryUrl) are legitimate.
        const testVerificationKey = uuidv4();
        const liveVerificationKey = uuidv4();

        // 2. --- Save keys to YOUR database (CRITICAL) ---
        // You MUST save the Stripe secret keys securely here.
        // You will need them in your queryUrl to actually make payments.
        // We also save the verification keys we just made.
        await saveStripeKeysToDb(locationId, {
            testPubKey,
            testSecKey, // <-- Encrypt this in a real app!
            testVerificationKey,
            livePubKey,
            liveSecKey, // <-- Encrypt this in a real app!
            liveVerificationKey,
        });

        // 3. --- Get the GHL Access Token we saved during install ---
        const accessToken = await getAccessToken(locationId);
        if (!accessToken?.accessToken) {
            return NextResponse.json({ success: false, error: 'Auth token not found.' }, { status: 401 });
        }

        console.log("AccessToken", accessToken)

        const headers = {
            'Authorization': `Bearer ${accessToken?.accessToken}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
        };

        // 4. --- Call GHL's API to register TEST mode ---
        const testConfigPayload = {
            "live": {
                "apiKey": liveVerificationKey,
                "publishableKey": livePubKey
            },
            "test": {
                "apiKey": testVerificationKey,
                "publishableKey": testPubKey
            }
        }

        console.log("test_payload", testConfigPayload)

        await axios.post(`${GHL_CONNECT_API}?locationId=${locationId}`, testConfigPayload, { headers });
        // 6. --- All done! Send success back to the frontend ---
        return NextResponse.json({ success: true, message: 'Configuration saved!' });

    } catch (error: any) {
        console.error('Error connecting config:', error.response?.data || error.message);
        return NextResponse.json({ success: false, error: 'Failed to save configuration.' }, { status: 500 });
    }
}