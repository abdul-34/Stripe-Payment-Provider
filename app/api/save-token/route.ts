/* eslint-disable */

import { CreateNewIntegration, CreateNewProviderConfig } from "@/lib/ghl";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const data = await req.json();

        const {
            appId,
            access_token,
            refresh_token,
            userType,
            companyId,
            locationId,
            userId
        } = data;

        if (!locationId || !access_token) {
            return NextResponse.json(
                { error: "Missing required fields: locationId or access_token" },
                { status: 400 }
            );
        }


         let payload_provider = {
              name: "Stripe Provider",
              description: "Lorem ipsum dolor semit",
              paymentsUrl: `https://stripe-payment-provider.vercel.app?app_id=${appId}&location_id=${locationId}`,
              queryUrl: 'https://stripe-payment-provider.vercel.app/api/query',
              imageUrl:
                'https://play-lh.googleusercontent.com/2PS6w7uBztfuMys5fgodNkTwTOE6bLVB2cJYbu5GHlARAK36FzO5bUfMDP9cEJk__cE',
            }

            const create_provider = await CreateNewIntegration(
              {location_id: locationId,access_token: access_token},
              payload_provider
            )
            if (create_provider.success) {
              let payload_connect = {
                live: {
                  apiKey: "live_68fe8d962cd1bd6b1999e7db",
                  publishableKey: "live_key_68fe8d962cd1bd6b1999e7db",
                },
                test: {
                  apiKey: "test_68fe8d962cd1bd6b1999e7db",
                  publishableKey: "test_key_68fe8d962cd1bd6b1999e7db",
                },
              }
              await CreateNewProviderConfig({location_id: locationId,access_token: access_token}, payload_connect)
            }



        // Save or update the record
        const tokenRecord = await prisma.token.upsert({
            where: { locationId },
            update: {
                appId,
                accessToken: access_token,
                refreshToken: refresh_token,
                userType,
                companyId,
                userId,
                expiresAt: new Date(Date.now() + 23 * 3600 * 1000), // 23 hours from now
            },
            create: {
                appId,
                accessToken: access_token,
                refreshToken: refresh_token,
                userType,
                companyId,
                locationId,
                userId,
                expiresAt: new Date(Date.now() + 23 * 3600 * 1000), // 23 hours from now
            },
        });

        return NextResponse.json({
            success: true,
            message: "Token saved successfully",
            data: tokenRecord,
        });
    } catch (error: any) {
        console.error("Error saving token:", error);
        return NextResponse.json(
            { error: "Failed to save token", details: error.message },
            { status: 500 }
        );
    }
}
