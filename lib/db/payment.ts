/* eslint-disable */
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { getGhlContact } from "../ghl";
import Stripe from "stripe";

interface StripeKeys {
  testPubKey: string;
  testSecKey: string;
  livePubKey: string;
  liveSecKey: string;
  testVerificationKey: string;
  liveVerificationKey: string;
}

export async function saveStripeKeysToDb(locationId: string, keys: StripeKeys) {
  const {
    testPubKey,
    testSecKey,
    livePubKey,
    liveSecKey,
    testVerificationKey,
    liveVerificationKey,
  } = keys;

  // Encrypt the secret keys before saving
  const encryptedTestSecKey = encrypt(testSecKey);
  const encryptedLiveSecKey = encrypt(liveSecKey);

  try {
    const config = await prisma.paymentConfig.upsert({
      where: { locationId },
      create: {
        locationId,
        testPubKey,
        testSecKey: encryptedTestSecKey,
        livePubKey,
        liveSecKey: encryptedLiveSecKey,
        testVerificationKey,
        liveVerificationKey,
      },
      update: {
        testPubKey,
        testSecKey: encryptedTestSecKey,
        livePubKey,
        liveSecKey: encryptedLiveSecKey,
        testVerificationKey,
        liveVerificationKey,
      },
    });
    return config;
  } catch (error: any) {
    console.error("Error saving payment config:", error);
    throw new Error("Failed to save payment configuration.");
  }
}

export async function getStripeSecretKey(locationId: string): Promise<string> {
  const config = await prisma.paymentConfig.findUnique({
    where: { locationId },
  });

  if (!config) {
    throw new Error("No payment config found for this location.");
  }

  // FOR NOW: We'll just use the test key.
  // In production, you'd check a 'mode' flag.
  if (!config.testSecKey) {
     throw new Error("No test secret key found.");
  }

  return decrypt(config.testSecKey);
}

export async function verifyGhlApiKey(locationId: string, apiKey: string): Promise<boolean> {
  const config = await prisma.paymentConfig.findUnique({
    where: { locationId },
    select: { testVerificationKey: true, liveVerificationKey: true }
  });

  if (!config) return false;

  // Check if the key matches either test or live
  return (
    apiKey === config.testVerificationKey ||
    apiKey === config.liveVerificationKey
  );
}
export async function getOrCreateStripeCustomer(
  ghlContactId: string,
  locationId: string,
  stripe: Stripe // Pass in the initialized Stripe instance
): Promise<string> {
  
  // 1. Check our database first
  const existingMapping = await prisma.customerMapping.findFirst({
    where: { ghlContactId },
  });

  if (existingMapping) {
    return existingMapping.stripeCustomerId;
  }

  // 2. No mapping found. Get GHL contact details.
  const ghlContact = await getGhlContact(ghlContactId, locationId);
  const email = ghlContact.email;
  const name = `${ghlContact.firstName || ''} ${ghlContact.lastName || ''}`.trim();

  if (!email) {
    throw new Error("Contact does not have an email address, cannot create Stripe customer.");
  }

  // 3. Check Stripe for an existing customer with this email
  const existingStripeCustomers = await stripe.customers.list({
    email: email,
    limit: 1,
  });

  let stripeCustomerId: string;

  if (existingStripeCustomers.data.length > 0) {
    // 4a. Customer EXISTS in Stripe. Use this one.
    stripeCustomerId = existingStripeCustomers.data[0].id;
  } else {
    // 4b. Customer does NOT exist. Create a new one.
    const newCustomer = await stripe.customers.create({
      email: email,
      name: name || undefined,
      metadata: {
        ghlContactId: ghlContactId,
        ghlLocationId: locationId,
      }
    });
    stripeCustomerId = newCustomer.id;
  }

  // 5. Save the new mapping to our database
  await prisma.customerMapping.create({
    data: {
      locationId: locationId,
      ghlContactId: ghlContactId,
      stripeCustomerId: stripeCustomerId,
    }
  });

  return stripeCustomerId;
}