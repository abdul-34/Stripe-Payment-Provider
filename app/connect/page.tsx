"use client";

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import SsoHandler from '@/lib/ssoHandler';


/* eslint-disable */

function ConnectForm() {
  // Get the locationId from the URL (e.g., /connect?locationId=...)
  const searchParams = useSearchParams();

  // Form state
  const [testPubKey, setTestPubKey] = useState('');
  const [testSecKey, setTestSecKey] = useState('');
  const [livePubKey, setLivePubKey] = useState('');
  const [liveSecKey, setLiveSecKey] = useState('');
  const { SSO, checkSSO } = SsoHandler();

  const [ssodata, setssodata] = useState<any>({ companyId: 'demo', activeLocation: 'demo' });
  const [loader, setloader] = useState(false);


  console.log("ssoData", ssodata)


  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Please enter your Stripe API keys to activate.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // if (!locationId) {
    //   setMessage("Error: No Location ID found. Please reinstall the app.");
    //   return;
    // }

    setLoading(true);
    setMessage("Saving configuration...");

    try {
      const response = await axios.post('/api/ghl/connect-keys', {
        locationId: ssodata?.activeLocation,
        testPubKey,
        testSecKey,
        livePubKey,
        liveSecKey,
      });

      if (response.data.success) {
        setMessage("Success! Your payment provider is now configured. You can close this tab.");
      } else {
        throw new Error(response.data.error || "An unknown error occurred.");
      }
    } catch (error: any) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  const sso = {
    app_id: "68fe8d962cd1bd6b1999e7db",
    key: process.env.NEXT_PUBLIC_SSO_KEY!,

  }


  useEffect(() => {
    checkSSO(sso);
  }, []);
  useEffect(() => {
    if (SSO != '' && SSO != undefined) {
      var data = JSON.parse(SSO);
      setssodata(data);
      setloader(false);
    }
  }, [SSO]);

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: 'auto' }}>
      <h1>Configure Your Stripe Provider</h1>
      <p>{message}</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h3>Test Mode</h3>
        <input
          type="text"
          placeholder="Stripe Publishable Key (Test) - pk_test_..."
          value={testPubKey}
          onChange={(e) => setTestPubKey(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <input
          type="password"
          placeholder="Stripe Secret Key (Test) - sk_test_..."
          value={testSecKey}
          onChange={(e) => setTestSecKey(e.target.value)}
          required
          style={{ padding: '10px' }}
        />

        <h3>Live Mode</h3>
        <input
          type="text"
          placeholder="Stripe Publishable Key (Live) - pk_live_..."
          value={livePubKey}
          onChange={(e) => setLivePubKey(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <input
          type="password"
          placeholder="Stripe Secret Key (Live) - sk_live_..."
          value={liveSecKey}
          onChange={(e) => setLiveSecKey(e.target.value)}
          required
          style={{ padding: '10px' }}
        />

        <button type="submit" disabled={loading} style={{ padding: '15px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}>
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
}

// Next.js requires a Suspense boundary when using useSearchParams
export default function ConnectPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConnectForm />
    </Suspense>
  );
}