
import axios from "axios";
import { prisma } from "@/lib/prisma";

/* eslint-disable */

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

export interface GHLAuth {
    access_token: string;
    locationId: string;
}

export interface ContactData {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    contactId?: string;
    message?: string;
    conversationId?: string;
}

export interface CustomFieldsData {
    id: any;
    field_value: string;
}

export interface updateContactData {
    contactId: string;
    customFields: CustomFieldsData[];
}

export interface ApiResponse<T> {
    success: boolean;
    status: number;
    data: T | string | null;
}
/* -------------------------------------------------------------------------- */
/*                         SEARCH CONTACTs                          */
/* -------------------------------------------------------------------------- */

export const searchContacts = async (
    ghl: GHLAuth
): Promise<ApiResponse<any>> => {
    const searchData = {
        locationId: ghl.locationId,
        pageLimit: 100

    };

    try {
        const result = await axios.post(
            "https://services.leadconnectorhq.com/contacts/search",
            searchData,
            {
                headers: {
                    Authorization: `Bearer ${ghl.access_token}`,
                    Version: "2021-07-28",
                    Accept: "application/json",
                },
            }
        );

        return {
            success: true,
            status: 200,
            data: result.data?.contacts || [],
        };
    } catch (error: any) {
        console.error("searchContactByPhone error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};
/* -------------------------------------------------------------------------- */
/*                         SEARCH CONTACT BY PHONE                            */
/* -------------------------------------------------------------------------- */

export const searchContactByPhone = async (
    ghl: GHLAuth,
    data: ContactData
): Promise<ApiResponse<any>> => {
    const searchData = {
        locationId: ghl.locationId,
        pageLimit: 100,
        filters: [
            {
                group: "AND",
                filters: [
                    {
                        field: "phone",
                        operator: "eq",
                        value: `+92${data.id}`,
                    },
                ],
            },
        ],
    };

    try {
        const result = await axios.post(
            "https://services.leadconnectorhq.com/contacts/search",
            searchData,
            {
                headers: {
                    Authorization: `Bearer ${ghl.access_token}`,
                    Version: "2021-07-28",
                    Accept: "application/json",
                },
            }
        );

        return {
            success: true,
            status: 200,
            data: result.data?.contacts?.[0] || null,
        };
    } catch (error: any) {
        console.error("searchContactByPhone error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};

/* -------------------------------------------------------------------------- */
/*                              UPSERT CONTACT                                */
/* -------------------------------------------------------------------------- */

export const upsertContact = async (
    ghl: GHLAuth,
    data: ContactData
): Promise<ApiResponse<any>> => {
    const contactData = {
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        email: data.email,
        locationId: ghl.locationId,
        phone: `+92${data.id}`,
    };

    try {
        const result = await axios.post(
            "https://services.leadconnectorhq.com/contacts/upsert",
            contactData,
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Version: "2021-07-28",
                    Authorization: `Bearer ${ghl.access_token}`,
                },
            }
        );

        return {
            success: true,
            status: 200,
            data: result.data?.contact || null,
        };
    } catch (error: any) {
        console.error("upsertContact error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};

/* -------------------------------------------------------------------------- */
/*                              UPDATE CONTACT                                */
/* -------------------------------------------------------------------------- */

export const updateContact = async (
    ghl: GHLAuth,
    data: updateContactData
): Promise<ApiResponse<any>> => {
    // console.log("updateContact data:", data);
    try {
        const result = await axios.put(
            `https://services.leadconnectorhq.com/contacts/${data.contactId}`,
            { customFields: data?.customFields },
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Version: "2021-07-28",
                    Authorization: `Bearer ${ghl.access_token}`,
                },
            }
        );

        // console.log("updateContact result:", result.data);

        return {
            success: true,
            status: 200,
            data: result.data?.contact || null,
        };
    } catch (error: any) {
        console.error("updateContact error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};

/* -------------------------------------------------------------------------- */
/*                         ADD MESSAGE TO CONVERSATION                        */
/* -------------------------------------------------------------------------- */

export const addMessageToConversation = async (
    ghl: GHLAuth,
    data: ContactData
): Promise<ApiResponse<any>> => {
    const messageData = {
        type: "Custom",
        contactId: data.contactId,
        message: data.message,
        conversationId: data.conversationId,
        conversationProviderId: "68f4b8c5a90a31716dae7442", // static for now
    };

    try {
        const result = await axios.post(
            "https://services.leadconnectorhq.com/conversations/messages/inbound",
            messageData,
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Version: "2021-07-28",
                    Authorization: `Bearer ${ghl.access_token}`,
                },
            }
        );

        return {
            success: true,
            status: 200,
            data: result.data || null,
        };
    } catch (error: any) {
        console.error("addMessageToConversation error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};

/* -------------------------------------------------------------------------- */
/*                           UPDATE MESSAGE STATUS                            */
/* -------------------------------------------------------------------------- */

export const updateMessageStatus = async (
    ghl: GHLAuth,
    messageId: string
): Promise<ApiResponse<any>> => {
    try {
        const result = await axios.put(
            `https://services.leadconnectorhq.com/conversations/messages/${messageId}/status`,
            { status: "read" },
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Version: "2021-07-28",
                    Authorization: `Bearer ${ghl.access_token}`,
                },
            }
        );

        return {
            success: true,
            status: 200,
            data: result.data || null,
        };
    } catch (error: any) {
        console.error("updateMessageStatus error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};
export const searchConversation = async (
    ghl: GHLAuth,
    contactId: string,
    limit = 100, // Default limit per page
) => {
    let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: `https://services.leadconnectorhq.com/conversations/search`,
        params: {
            locationId: ghl?.locationId,
            limit: limit,
            contactId: contactId || "",
        },
        headers: {
            Accept: "application/json",
            Authorization: "Bearer " + ghl?.access_token,
            Version: "2021-04-15", // Version confirmed as header from docs
        },
    };



    try {
        const response = await axios.request(config);
        // Based on your screenshot, 'conversations' is an array directly in response.data, and 'total' is also directly in response.data
        return {
            success: true,
            status: 200,
            data: response?.data?.conversations || [],
            total: response?.data?.total || 0,
            // We might need to return a 'nextCursor' if the API provides an explicit one,
            // but 'startAfterDate' logic implies we extract it from the last item.
        };
    } catch (error: any) {
        console.error("Error in searchConversation:", error.response ? error.response.data : error.message);
        return {
            success: false,
            status: error.response ? error.response.status : 500,
            data: error.response ? error.response.data : error.message,
            total: 0
        };
    }
};
/* -------------------------------------------------------------------------- */
/*                            CREATE CONVERSATION                             */
/* -------------------------------------------------------------------------- */

export const createConversation = async (
    ghl: GHLAuth,
    contactId: string
): Promise<ApiResponse<any>> => {
    const payload = {
        locationId: ghl.locationId,
        contactId,
    };

    try {
        const response = await axios.post(
            "https://services.leadconnectorhq.com/conversations/",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${ghl.access_token}`,
                    Version: "2021-07-28",
                },
            }
        );

        return {
            success: true,
            status: 200,
            data: response.data?.conversation || null,
        };
    } catch (error: any) {
        console.error("createConversation error:", error.response?.data || error.message);
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
        };
    }
};

export const setupCustomFields = async (
    location_id: string,
    custom_field_names: Array<{ key: string; field_value?: string }>,
    access_token: string
) => {
    let folderId;

    // CHECK IF FOLDER EXISTS
    const folder_check = await axios.get(
        `https://services.leadconnectorhq.com/locations/${location_id}/customFields/search?documentType=folder&model=contact&query=Aimfox&includeStandards=true`,
        {
            headers: {
                Authorization: `Bearer ${access_token}`,
                Version: "2021-07-28",
                Accept: "application/json",
            },
        }
    );

    console.log("Folder Check Response:", folder_check?.data);

    folderId = folder_check?.data?.customFieldFolders?.[0]?._id;

    // IF FOLDER NOT FOUND, CREATE NEW FOLDER
    if (folder_check?.data?.customFieldFolders?.length < 0 || !folderId) {
        const custom_field_folder_options = {
            method: "POST",
            url: `https://services.leadconnectorhq.com/locations/${location_id}/customFields`,
            headers: {
                Authorization: `Bearer ${access_token}`,
                Version: "2021-07-28",
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            data: {
                name: "Aimfox",
                documentType: "folder",
                model: "contact",
            },
        };

        const custom_field_folder = await axios.request(custom_field_folder_options);
        folderId = custom_field_folder?.data?.customFieldFolder?.id;
    }

    // CREATE CUSTOM FIELDS IN FOLDER
    const custom_fields_created = [];

    for (const field of custom_field_names) {
        const { key, field_value } = field;

        // CHECK IF FIELD ALREADY EXISTS
        const all_fields = await axios.get(
            `https://services.leadconnectorhq.com/locations/${location_id}/customFields/search?parentId=${folderId}&documentType=field&model=all&query=&includeStandards=true`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Version: "2021-07-28",
                    Accept: "application/json",
                },
            }
        );

        const fieldAlreadyExists = all_fields?.data?.customFields?.find(
            (f: { name: string }) => f.name === key
        );

        if (fieldAlreadyExists) {
            custom_fields_created.push({
                id: fieldAlreadyExists._id,
                field_value: field_value ?? "",
            });
            continue;
        }

        // CREATE THE CUSTOM FIELD
        try {
            const fieldRes = await axios.post(
                `https://services.leadconnectorhq.com/locations/${location_id}/customFields`,
                {
                    name: key,
                    fieldKey: "",
                    dataType: "TEXT",
                    documentType: "field",
                    showInForms: true,
                    model: "contact",
                    parentId: folderId,
                    description: "",
                },
                {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        Version: "2021-07-28",
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                }
            );

            custom_fields_created.push({
                id: fieldRes?.data?.customField?.id,
                field_value: field_value ?? "",
            });
        } catch (error: any) {
            console.error(`Error creating field ${key}: ${error.response?.data || error.message}`);
            // Continue with next field even if one fails
            continue;
        }
    }

    return custom_fields_created.map((field) => ({
        id: field.id,
        field_value: String(field.field_value ?? ""),
    }));
}

export const getAccessToken = async (locationId: string) => {
  // Fetch the agency or location token from DB
  const tokenRecord = await prisma.token.findFirst({
    where: { locationId },
  });

  if (!tokenRecord) return null;

  return tokenRecord

};
/**
 * Fetches a GHL Contact's details using their ID.
 * We need this to get the contact's email and name.
 */
export async function getGhlContact(contactId: string, locationId: string): Promise<any> {
  // Use our helper to get a valid token
  const accessToken = await getAccessToken(locationId);
  if (!accessToken) {
    throw new Error("Could not retrieve access token for GHL.");
  }

  const options = {
    method: 'GET',
    url: `https://services.leadconnectorhq.com/contacts/${contactId}`,
    headers: {
      Authorization: `Bearer ${accessToken?.accessToken}`,
      Version: '2021-07-28', // Use a stable GHL API version
      Accept: 'application/json'
    }
  };

  try {
    const response = await axios.request(options);
    return response.data.contact;
  } catch (error: any) {
    console.error("Error fetching GHL contact:", error.response?.data || error.message);
    throw new Error("Failed to fetch contact details from GHL.");
  }
}