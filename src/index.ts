#!/usr/bin/env node

/**
 * Strider Labs Airbnb MCP Server
 *
 * MCP server that gives AI agents the ability to search listings, check availability,
 * manage reservations, and book stays on Airbnb via browser automation.
 * https://striderlabs.ai
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  checkLoginStatus,
  initiateLogin,
  searchListings,
  getListing,
  checkAvailability,
  getPrice,
  saveListing,
  getSavedListings,
  bookListing,
  getReservations,
  cancelReservation,
  messageHost,
  getReviews,
  closeBrowser,
} from "./browser.js";
import { loadSessionInfo, clearAuthData, getConfigDir } from "./auth.js";

// Initialize server
const server = new Server(
  {
    name: "strider-airbnb",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "airbnb_status",
        description:
          "Check Airbnb login status and session info. Use this to verify authentication before performing other actions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "airbnb_login",
        description:
          "Initiate Airbnb login flow. Returns a URL and instructions for the user to complete login manually. After logging in, use airbnb_status to verify.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "airbnb_logout",
        description:
          "Clear saved Airbnb session and cookies. Use this to log out or reset authentication state.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "airbnb_search",
        description:
          "Search Airbnb listings by location, dates, and guest count. Returns listing titles, prices, ratings, and URLs.",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description:
                "Destination location (e.g., 'Paris, France', 'New York, NY', 'Miami Beach')",
            },
            checkIn: {
              type: "string",
              description: "Check-in date in YYYY-MM-DD format (e.g., '2025-07-01')",
            },
            checkOut: {
              type: "string",
              description: "Check-out date in YYYY-MM-DD format (e.g., '2025-07-07')",
            },
            adults: {
              type: "number",
              description: "Number of adult guests (default: 1)",
            },
            children: {
              type: "number",
              description: "Number of child guests (default: 0)",
            },
            infants: {
              type: "number",
              description: "Number of infants (default: 0)",
            },
            pets: {
              type: "number",
              description: "Number of pets (default: 0)",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results to return (default: 10, max: 50)",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "airbnb_get_listing",
        description:
          "Get detailed information about an Airbnb listing by its ID or URL. Returns title, price, amenities, host info, and house rules.",
        inputSchema: {
          type: "object",
          properties: {
            listingIdOrUrl: {
              type: "string",
              description:
                "Airbnb listing ID (e.g., '12345678') or full URL (e.g., 'https://www.airbnb.com/rooms/12345678')",
            },
          },
          required: ["listingIdOrUrl"],
        },
      },
      {
        name: "airbnb_check_availability",
        description:
          "Check whether an Airbnb listing is available for specific dates.",
        inputSchema: {
          type: "object",
          properties: {
            listingId: {
              type: "string",
              description: "Airbnb listing ID",
            },
            checkIn: {
              type: "string",
              description: "Check-in date in YYYY-MM-DD format",
            },
            checkOut: {
              type: "string",
              description: "Check-out date in YYYY-MM-DD format",
            },
            adults: {
              type: "number",
              description: "Number of adult guests (default: 1)",
            },
          },
          required: ["listingId", "checkIn", "checkOut"],
        },
      },
      {
        name: "airbnb_get_price",
        description:
          "Get full price breakdown for a listing including nightly rate, cleaning fee, service fee, taxes, and total.",
        inputSchema: {
          type: "object",
          properties: {
            listingId: {
              type: "string",
              description: "Airbnb listing ID",
            },
            checkIn: {
              type: "string",
              description: "Check-in date in YYYY-MM-DD format",
            },
            checkOut: {
              type: "string",
              description: "Check-out date in YYYY-MM-DD format",
            },
            adults: {
              type: "number",
              description: "Number of adult guests (default: 1)",
            },
            children: {
              type: "number",
              description: "Number of child guests (default: 0)",
            },
          },
          required: ["listingId", "checkIn", "checkOut"],
        },
      },
      {
        name: "airbnb_save_listing",
        description:
          "Save an Airbnb listing to your wishlist. Requires being logged in.",
        inputSchema: {
          type: "object",
          properties: {
            listingId: {
              type: "string",
              description: "Airbnb listing ID to save",
            },
            wishlistName: {
              type: "string",
              description:
                "Optional name of the wishlist to save to. If not provided, saves to the default wishlist.",
            },
          },
          required: ["listingId"],
        },
      },
      {
        name: "airbnb_get_saved",
        description:
          "View all saved listings and wishlists. Requires being logged in.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "airbnb_book",
        description:
          "Book an Airbnb listing. IMPORTANT: Set confirm=true only when you have explicit user confirmation. Without confirm=true, returns a price preview instead of booking.",
        inputSchema: {
          type: "object",
          properties: {
            listingId: {
              type: "string",
              description: "Airbnb listing ID to book",
            },
            checkIn: {
              type: "string",
              description: "Check-in date in YYYY-MM-DD format",
            },
            checkOut: {
              type: "string",
              description: "Check-out date in YYYY-MM-DD format",
            },
            adults: {
              type: "number",
              description: "Number of adult guests (default: 1)",
            },
            children: {
              type: "number",
              description: "Number of child guests (default: 0)",
            },
            confirm: {
              type: "boolean",
              description:
                "Set to true to actually initiate booking. If false or omitted, returns a preview only. NEVER set to true without explicit user confirmation.",
            },
          },
          required: ["listingId", "checkIn", "checkOut"],
        },
      },
      {
        name: "airbnb_get_reservations",
        description:
          "View upcoming or past Airbnb reservations. Requires being logged in.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["upcoming", "past", "all"],
              description: "Type of reservations to retrieve (default: 'upcoming')",
            },
          },
        },
      },
      {
        name: "airbnb_cancel_reservation",
        description:
          "Cancel an Airbnb reservation. IMPORTANT: Set confirm=true only with explicit user confirmation. Cancellation policies vary — always check refund terms first.",
        inputSchema: {
          type: "object",
          properties: {
            reservationId: {
              type: "string",
              description:
                "Reservation ID or confirmation code (e.g., 'HMXXXXXX')",
            },
            confirm: {
              type: "boolean",
              description:
                "Set to true to actually cancel. If false or omitted, returns a warning only. NEVER set to true without explicit user confirmation.",
            },
          },
          required: ["reservationId"],
        },
      },
      {
        name: "airbnb_message_host",
        description:
          "Send a message to an Airbnb host. Provide either a reservationId (for existing bookings) or a listingId (for pre-booking inquiries).",
        inputSchema: {
          type: "object",
          properties: {
            reservationId: {
              type: "string",
              description:
                "Reservation ID or confirmation code for an existing booking",
            },
            listingId: {
              type: "string",
              description:
                "Listing ID to contact the host before booking (pre-booking inquiry)",
            },
            message: {
              type: "string",
              description: "The message text to send to the host",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "airbnb_get_reviews",
        description:
          "Get guest reviews for an Airbnb listing.",
        inputSchema: {
          type: "object",
          properties: {
            listingId: {
              type: "string",
              description: "Airbnb listing ID",
            },
            maxResults: {
              type: "number",
              description:
                "Maximum number of reviews to return (default: 10, max: 50)",
            },
          },
          required: ["listingId"],
        },
      },
    ],
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "airbnb_status": {
        const sessionInfo = loadSessionInfo();
        const liveStatus = await checkLoginStatus();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  session: liveStatus,
                  savedSession: sessionInfo,
                  configDir: getConfigDir(),
                  message: liveStatus.isLoggedIn
                    ? `Logged in${
                        liveStatus.userName
                          ? ` as ${liveStatus.userName}`
                          : liveStatus.userEmail
                          ? ` as ${liveStatus.userEmail}`
                          : ""
                      }`
                    : "Not logged in. Use airbnb_login to authenticate.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_login": {
        const result = await initiateLogin();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  ...result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_logout": {
        clearAuthData();
        await closeBrowser();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Logged out. Session and cookies cleared.",
              }),
            },
          ],
        };
      }

      case "airbnb_search": {
        const {
          location,
          checkIn,
          checkOut,
          adults,
          children,
          infants,
          pets,
          maxResults = 10,
        } = args as {
          location: string;
          checkIn?: string;
          checkOut?: string;
          adults?: number;
          children?: number;
          infants?: number;
          pets?: number;
          maxResults?: number;
        };

        const listings = await searchListings({
          location,
          checkIn,
          checkOut,
          adults,
          children,
          infants,
          pets,
          maxResults: Math.min(maxResults, 50),
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  location,
                  checkIn,
                  checkOut,
                  count: listings.length,
                  listings,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_get_listing": {
        const { listingIdOrUrl } = args as { listingIdOrUrl: string };
        const listing = await getListing(listingIdOrUrl);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  listing,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_check_availability": {
        const { listingId, checkIn, checkOut, adults } = args as {
          listingId: string;
          checkIn: string;
          checkOut: string;
          adults?: number;
        };

        const result = await checkAvailability({
          listingId,
          checkIn,
          checkOut,
          adults,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  ...result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_get_price": {
        const { listingId, checkIn, checkOut, adults, children } = args as {
          listingId: string;
          checkIn: string;
          checkOut: string;
          adults?: number;
          children?: number;
        };

        const pricing = await getPrice({
          listingId,
          checkIn,
          checkOut,
          adults,
          children,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  listingId,
                  checkIn,
                  checkOut,
                  pricing,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_save_listing": {
        const { listingId, wishlistName } = args as {
          listingId: string;
          wishlistName?: string;
        };

        const result = await saveListing(listingId, wishlistName);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  message: result.message,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_get_saved": {
        const result = await getSavedListings();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  ...result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_book": {
        const {
          listingId,
          checkIn,
          checkOut,
          adults,
          children,
          confirm = false,
        } = args as {
          listingId: string;
          checkIn: string;
          checkOut: string;
          adults?: number;
          children?: number;
          confirm?: boolean;
        };

        const result = await bookListing({
          listingId,
          checkIn,
          checkOut,
          adults,
          children,
          confirm,
        });

        if ("requiresConfirmation" in result) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    requiresConfirmation: result.requiresConfirmation,
                    preview: result.preview,
                    note: "Call airbnb_book with confirm=true to initiate booking. IMPORTANT: Only do this after getting explicit user confirmation.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  confirmationCode: result.confirmationCode,
                  message: result.message,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_get_reservations": {
        const { type = "upcoming" } = args as {
          type?: "upcoming" | "past" | "all";
        };

        const reservations = await getReservations(type);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  type,
                  count: reservations.length,
                  reservations,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_cancel_reservation": {
        const { reservationId, confirm = false } = args as {
          reservationId: string;
          confirm?: boolean;
        };

        const result = await cancelReservation({ reservationId, confirm });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  message: result.message,
                  refundInfo: result.refundInfo,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_message_host": {
        const { reservationId, listingId, message } = args as {
          reservationId?: string;
          listingId?: string;
          message: string;
        };

        const result = await messageHost({ reservationId, listingId, message });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  message: result.message,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "airbnb_get_reviews": {
        const { listingId, maxResults = 10 } = args as {
          listingId: string;
          maxResults?: number;
        };

        const reviews = await getReviews(listingId, Math.min(maxResults, 50));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  listingId,
                  count: reviews.length,
                  reviews,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
              suggestion: errorMessage.toLowerCase().includes("login") ||
                errorMessage.toLowerCase().includes("auth")
                ? "Try running airbnb_login to authenticate"
                : errorMessage.toLowerCase().includes("captcha")
                ? "CAPTCHA encountered. Try again in a moment or use a different network."
                : errorMessage.toLowerCase().includes("timeout")
                ? "The page took too long to load. Try again."
                : undefined,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on server close
server.onclose = async () => {
  await closeBrowser();
};

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Strider Airbnb MCP server running");
  console.error(`Config directory: ${getConfigDir()}`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
