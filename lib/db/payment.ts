/* eslint-disable */
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

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