"use client"
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import qs from 'qs';


/* eslint-disable */


const Index = () => {
    const [message, setMessage] = useState("Installation in Progress")
    const hasRun = useRef(false); // Prevent double execution
    const app_id = "68fe8d962cd1bd6b1999e7db"


    const GHL_PROVIDER_API = 'https://api.gohighlevel.com/payments/custom-provider/provider';


    const SaveAppToken = async () => {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');


        if (!code) {
            console.log('No authorization code found.');
            return;
        }


        const data = qs.stringify({
            grant_type: 'authorization_code',
            client_id: process.env.NEXT_PUBLIC_GHL_CLIENT_ID!,
            client_secret: process.env.NEXT_PUBLIC_GHL_CLIENT_SECRET!,
            code: code,
            refresh_token: '',
        });

        const config = {
            method: 'post',
            url: 'https://services.leadconnectorhq.com/oauth/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            data: data
        };


        const ghl_reponse = await axios.request(config);

        if (!ghl_reponse?.data) {
            console.error('Token request error:', ghl_reponse);
            setMessage("Error while installing the App")
        }


        // /
        const { access_token, locationId, refresh_token, userType, companyId, userId } = ghl_reponse.data;

        // 2. --- THIS IS THE STEP YOU ASKED FOR ---
        // Create the Public Provider Config
        const providerConfig = {
            name: "My Custom Stripe Provider",
            description: "A learning project for GHL Payments",
            imageUrl: `${process.env.NEXT_PUBLIC_DOMAIN_URL!}/logo.png`, // URL to your app's logo
            locationId: locationId,

            // Here you tell GHL what your app's API URLs are
            queryUrl: `${process.env.NEXT_PUBLIC_DOMAIN_URL!}/api/ghl/query`,     // Your backend API
            paymentsUrl: `${process.env.NEXT_PUBLIC_DOMAIN_URL!}/payment`          // Your frontend iFrame
        };


        try {
            await axios.post(GHL_PROVIDER_API, providerConfig, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Version': '2021-06-01' // Use a valid GHL API version
                }
            });
        } catch (error: any) {
            console.error('Error creating public provider config:', error.response?.data || error.message);
            // You might still want to proceed even if this fails, or handle it
        }


        // SAVE TOKEN IN DB
        const response = await axios.post('/api/save-token', {
            appId: app_id,
            access_token: access_token,
            refresh_token: refresh_token,
            userType: userType,
            companyId: companyId,
            locationId: locationId,
            userId: userId,
            is_bulk_installed: ghl_reponse?.data?.isBulkInstallation
        });





        if (!response?.data?.success) {
            setMessage("Error while installing the App")
            throw new Error(`Error while saving token ${response}`);

        }



        setMessage("App Installed successfully")


    }
    useEffect(() => {
        if (!hasRun.current) {
            hasRun.current = true;
            SaveAppToken();
        }
    }, []);

    return <div className='flex w-full h-[100vh] justify-center items-center'>
        <h1 className='text-3xl font-bold'>{message}</h1>
    </div>;
};

export default Index;
