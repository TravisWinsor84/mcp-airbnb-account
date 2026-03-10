/**
 * Strider Labs - Airbnb Browser Automation
 *
 * Playwright-based browser automation for Airbnb operations.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import {
  saveCookies,
  loadCookies,
  saveSessionInfo,
  type SessionInfo,
} from "./auth.js";

const AIRBNB_BASE_URL = "https://www.airbnb.com";
const DEFAULT_TIMEOUT = 30000;

// Singleton browser instance
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

export interface ListingResult {
  id: string;
  title: string;
  url: string;
  pricePerNight?: string;
  totalPrice?: string;
  rating?: string;
  reviewCount?: number;
  location?: string;
  imageUrl?: string;
  superhost?: boolean;
  type?: string;
  guests?: number;
  beds?: number;
  baths?: number;
}

export interface ListingDetails extends ListingResult {
  description?: string;
  amenities?: string[];
  hostName?: string;
  hostSince?: string;
  checkInTime?: string;
  checkOutTime?: string;
  cancellationPolicy?: string;
  rules?: string[];
  lat?: number;
  lng?: number;
}

export interface Reservation {
  id: string;
  listingTitle: string;
  listingUrl?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  totalPrice?: string;
  status: string;
  hostName?: string;
  confirmationCode?: string;
}

export interface Review {
  author: string;
  date: string;
  rating?: string;
  text: string;
}

/**
 * Random delay between actions to mimic human behavior
 */
async function randomDelay(min = 500, max = 2000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize browser with stealth settings
 */
async function initBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  if (browser && context && page) {
    return { browser, context, page };
  }

  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  });

  context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  // Load saved cookies if available
  const cookiesLoaded = await loadCookies(context);
  if (cookiesLoaded) {
    console.error("Loaded saved Airbnb cookies");
  }

  page = await context.newPage();

  // Mask webdriver detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  return { browser, context, page };
}

/**
 * Close browser and save state
 */
export async function closeBrowser(): Promise<void> {
  if (context) {
    await saveCookies(context);
  }
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
  }
}

/**
 * Check if user is logged in to Airbnb
 */
export async function checkLoginStatus(): Promise<SessionInfo> {
  const { page, context } = await initBrowser();

  try {
    await page.goto(AIRBNB_BASE_URL, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    // Check for CAPTCHA
    const captcha = await page.$(
      'iframe[src*="captcha"], [class*="captcha"], #captcha'
    );
    if (captcha) {
      return {
        isLoggedIn: false,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Airbnb shows user menu or login button
    const userMenuButton = await page.$(
      '[data-testid="cypress-headernav-profile"], [aria-label*="Account"], button[aria-haspopup="menu"]'
    );
    const loginButton = await page.$(
      'button:has-text("Log in"), a:has-text("Log in"), [data-testid="login-signup-button"]'
    );

    const isLoggedIn = userMenuButton !== null && loginButton === null;

    let userEmail: string | undefined;
    let userName: string | undefined;

    if (isLoggedIn && userMenuButton) {
      try {
        await userMenuButton.click();
        await randomDelay(500, 1000);

        // Try to get user name from dropdown
        const nameEl = await page.$(
          '[data-testid="user-display-name"], [class*="userName"], [class*="ProfileName"]'
        );
        if (nameEl) {
          userName = (await nameEl.textContent()) || undefined;
        }

        // Close menu
        await page.keyboard.press("Escape");
        await randomDelay(300, 600);
      } catch {
        // ignore menu interaction errors
      }
    }

    const sessionInfo: SessionInfo = {
      isLoggedIn,
      userEmail,
      userName: userName?.trim(),
      lastUpdated: new Date().toISOString(),
    };

    saveSessionInfo(sessionInfo);
    await saveCookies(context);

    return sessionInfo;
  } catch (error) {
    throw new Error(
      `Failed to check login status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Initiate login flow - returns URL and instructions
 */
export async function initiateLogin(): Promise<{
  loginUrl: string;
  instructions: string;
}> {
  const { page, context } = await initBrowser();

  try {
    await page.goto(`${AIRBNB_BASE_URL}/login`, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await saveCookies(context);

    return {
      loginUrl: `${AIRBNB_BASE_URL}/login`,
      instructions:
        "Please log in to Airbnb manually:\n" +
        "1. Open the URL in your browser\n" +
        "2. Log in with your Airbnb account (email, Google, Facebook, or Apple)\n" +
        "3. Complete any 2FA or verification steps\n" +
        "4. Once logged in, run 'airbnb_status' to verify the session\n\n" +
        "Note: For headless operation, log in using a visible browser first — " +
        "session cookies will be saved for future use.",
    };
  } catch (error) {
    throw new Error(
      `Failed to initiate login: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Search Airbnb listings
 */
export async function searchListings(params: {
  location: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  infants?: number;
  pets?: number;
  maxResults?: number;
}): Promise<ListingResult[]> {
  const { page, context } = await initBrowser();

  try {
    const {
      location,
      checkIn,
      checkOut,
      adults = 1,
      children = 0,
      infants = 0,
      pets = 0,
      maxResults = 10,
    } = params;

    // Build search URL
    const searchParams = new URLSearchParams({
      query: location,
      adults: String(adults),
    });
    if (checkIn) searchParams.set("checkin", checkIn);
    if (checkOut) searchParams.set("checkout", checkOut);
    if (children > 0) searchParams.set("children", String(children));
    if (infants > 0) searchParams.set("infants", String(infants));
    if (pets > 0) searchParams.set("pets", String(pets));

    const searchUrl = `${AIRBNB_BASE_URL}/s/${encodeURIComponent(location)}/homes?${searchParams.toString()}`;
    await page.goto(searchUrl, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    // Check for CAPTCHA
    const captcha = await page.$(
      'iframe[src*="captcha"], [class*="captcha"], #captcha'
    );
    if (captcha) {
      return [];
    }

    // Wait for listing cards
    await page
      .waitForSelector(
        '[data-testid="listing-card-title"], [class*="listingCard"], [itemprop="itemListElement"]',
        { timeout: 10000 }
      )
      .catch(() => {});

    await randomDelay();

    const listings = await page.evaluate(
      (max: number) => {
        const cards = document.querySelectorAll(
          '[data-testid="listing-card-title"], [class*="listingCard"], [itemprop="itemListElement"], [class*="CardContainer"]'
        );

        const results: Array<{
          id: string;
          title: string;
          url: string;
          pricePerNight?: string;
          totalPrice?: string;
          rating?: string;
          reviewCount?: number;
          location?: string;
          imageUrl?: string;
          superhost?: boolean;
          type?: string;
          guests?: number;
          beds?: number;
          baths?: number;
        }> = [];

        // Try a broader selector if specific ones fail
        const allCards =
          cards.length > 0
            ? cards
            : document.querySelectorAll(
                'a[href*="/rooms/"], div[id*="FMP-target"] a[href*="/rooms/"]'
              );

        allCards.forEach((card, idx) => {
          if (idx >= max) return;

          const linkEl =
            card.tagName === "A"
              ? (card as HTMLAnchorElement)
              : card.querySelector("a[href*='/rooms/']");
          const href = linkEl?.getAttribute("href") || "";
          const roomIdMatch = href.match(/\/rooms\/(\d+)/);
          const id = roomIdMatch ? roomIdMatch[1] : String(idx);

          const titleEl = card.querySelector(
            '[data-testid="listing-card-title"], [class*="title"], h3, [class*="listing-title"]'
          );
          const title = titleEl?.textContent?.trim() || "Airbnb Listing";

          const priceEl = card.querySelector(
            '[data-testid="price-availability-row"], [class*="price"], [class*="Price"], ._1y74zjx'
          );
          const priceText = priceEl?.textContent?.trim() || "";
          const priceMatch = priceText.match(/\$[\d,]+/);
          const pricePerNight = priceMatch ? priceMatch[0] : undefined;

          const ratingEl = card.querySelector(
            '[class*="rating"], [aria-label*="rating"], [class*="Rating"]'
          );
          const ratingText = ratingEl?.textContent?.trim() || "";
          const ratingMatch = ratingText.match(/[\d.]+/);
          const rating = ratingMatch ? ratingMatch[0] : undefined;

          const reviewMatch = ratingText.match(/\((\d+)\)/);
          const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : undefined;

          const imageEl = card.querySelector("img");
          const imageUrl = imageEl?.src || undefined;

          const superhostEl = card.querySelector(
            '[aria-label*="Superhost"], [class*="superhost"]'
          );
          const superhost = superhostEl !== null;

          const subtitleEl = card.querySelector(
            '[data-testid="listing-card-subtitle"], [class*="subtitle"]'
          );
          const subtitle = subtitleEl?.textContent?.trim() || "";

          const fullUrl = href.startsWith("http")
            ? href
            : href
            ? `https://www.airbnb.com${href}`
            : "";

          results.push({
            id,
            title,
            url: fullUrl,
            pricePerNight,
            rating,
            reviewCount,
            location: subtitle || undefined,
            imageUrl,
            superhost,
          });
        });

        return results;
      },
      Math.min(maxResults, 50)
    );

    await saveCookies(context);
    return listings;
  } catch (error) {
    throw new Error(
      `Failed to search listings: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get detailed listing info by ID or URL
 */
export async function getListing(
  idOrUrl: string
): Promise<ListingDetails> {
  const { page, context } = await initBrowser();

  try {
    let url: string;
    if (idOrUrl.startsWith("http")) {
      url = idOrUrl;
    } else {
      // Assume it's a listing ID
      url = `${AIRBNB_BASE_URL}/rooms/${idOrUrl}`;
    }

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    // Check for CAPTCHA
    const captcha = await page.$('iframe[src*="captcha"], #captcha');
    if (captcha) {
      throw new Error(
        "CAPTCHA detected. Please complete it manually and try again."
      );
    }

    const details = await page.evaluate(() => {
      const titleEl = document.querySelector(
        'h1, [data-section-id="TITLE_DEFAULT"] h1'
      );
      const title = titleEl?.textContent?.trim() || "Airbnb Listing";

      const priceEl = document.querySelector(
        '[class*="price"], [data-testid*="price"], ._tyxjp1'
      );
      const priceText = priceEl?.textContent?.trim() || "";
      const priceMatch = priceText.match(/\$[\d,]+/);
      const pricePerNight = priceMatch ? priceMatch[0] : undefined;

      const ratingEl = document.querySelector(
        '[class*="rating"] [class*="label"], [aria-label*="rated"]'
      );
      const rating = ratingEl?.textContent?.trim() || undefined;

      const reviewEl = document.querySelector(
        'button[class*="review"], [data-section-id="REVIEWS_DEFAULT"] h2'
      );
      const reviewText = reviewEl?.textContent?.trim() || "";
      const reviewMatch = reviewText.match(/(\d+)\s+review/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : undefined;

      const locationEl = document.querySelector(
        '[data-section-id="LOCATION_DEFAULT"] h2, [class*="pdp-neighborhood"]'
      );
      const location = locationEl?.textContent?.trim() || undefined;

      const descEl = document.querySelector(
        '[data-section-id="DESCRIPTION_DEFAULT"], [class*="description"]'
      );
      const description = descEl?.textContent?.trim().slice(0, 500) || undefined;

      const imageEl = document.querySelector(
        '[data-section-id="HERO_DEFAULT"] img, [class*="photo"] img'
      );
      const imageUrl = imageEl?.getAttribute("src") || undefined;

      // Amenities
      const amenityEls = document.querySelectorAll(
        '[data-section-id="AMENITIES_DEFAULT"] li, [class*="amenity"]'
      );
      const amenities: string[] = [];
      amenityEls.forEach((el) => {
        const text = el.textContent?.trim();
        if (text) amenities.push(text);
      });

      // Host info
      const hostEl = document.querySelector(
        '[data-section-id="HOST_PROFILE_DEFAULT"] h2, [class*="hostInfo"] h2'
      );
      const hostName = hostEl?.textContent?.trim().replace("Hosted by ", "") || undefined;

      // Room details (guests, beds, baths)
      const detailsEl = document.querySelector(
        '[data-section-id="OVERVIEW_DEFAULT"], [class*="overview"]'
      );
      const detailsText = detailsEl?.textContent || "";
      const guestsMatch = detailsText.match(/(\d+)\s+guest/);
      const bedsMatch = detailsText.match(/(\d+)\s+bed(?!room)/);
      const bathsMatch = detailsText.match(/(\d+(?:\.\d+)?)\s+bath/);

      // House rules
      const rulesEls = document.querySelectorAll(
        '[data-section-id="POLICIES_DEFAULT"] li, [class*="houseRule"]'
      );
      const rules: string[] = [];
      rulesEls.forEach((el) => {
        const text = el.textContent?.trim();
        if (text) rules.push(text);
      });

      const idMatch = window.location.pathname.match(/\/rooms\/(\d+)/);

      return {
        id: idMatch ? idMatch[1] : "",
        title,
        url: window.location.href,
        pricePerNight,
        rating,
        reviewCount,
        location,
        description,
        imageUrl,
        amenities: amenities.slice(0, 20),
        hostName,
        guests: guestsMatch ? parseInt(guestsMatch[1]) : undefined,
        beds: bedsMatch ? parseInt(bedsMatch[1]) : undefined,
        baths: bathsMatch ? parseFloat(bathsMatch[1]) : undefined,
        rules: rules.slice(0, 10),
      };
    });

    await saveCookies(context);
    return details;
  } catch (error) {
    throw new Error(
      `Failed to get listing: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Check availability for a listing on given dates
 */
export async function checkAvailability(params: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
}): Promise<{
  available: boolean;
  checkIn: string;
  checkOut: string;
  nights?: number;
  message?: string;
}> {
  const { page, context } = await initBrowser();

  try {
    const { listingId, checkIn, checkOut, adults = 1 } = params;
    const url = `${AIRBNB_BASE_URL}/rooms/${listingId}?checkin=${checkIn}&checkout=${checkOut}&adults=${adults}`;

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    const captcha = await page.$('iframe[src*="captcha"], #captcha');
    if (captcha) {
      throw new Error("CAPTCHA detected. Please complete it manually.");
    }

    const result = await page.evaluate(
      (params: { checkIn: string; checkOut: string }) => {
        // Check for unavailability indicators
        const unavailableEl = document.querySelector(
          '[data-testid="availability-row"], [class*="unavailable"], [class*="Unavailable"]'
        );
        const unavailableText = unavailableEl?.textContent?.toLowerCase() || "";
        const isUnavailable =
          unavailableText.includes("unavailable") ||
          unavailableText.includes("not available");

        // Check for booking button (means available)
        const bookButton = document.querySelector(
          '[data-testid="book-it-cta"], button[class*="book"], button:has-text("Reserve")'
        );

        // Calculate nights
        const checkInDate = new Date(params.checkIn);
        const checkOutDate = new Date(params.checkOut);
        const nights = Math.round(
          (checkOutDate.getTime() - checkInDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        return {
          available: !isUnavailable && bookButton !== null,
          nights: nights > 0 ? nights : undefined,
        };
      },
      { checkIn, checkOut }
    );

    await saveCookies(context);

    return {
      available: result.available,
      checkIn,
      checkOut,
      nights: result.nights,
      message: result.available
        ? `Listing is available for ${result.nights} nights`
        : "Listing is not available for these dates",
    };
  } catch (error) {
    throw new Error(
      `Failed to check availability: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get total price for a listing + dates
 */
export async function getPrice(params: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
}): Promise<{
  pricePerNight?: string;
  nights?: number;
  cleaningFee?: string;
  serviceFee?: string;
  taxes?: string;
  total?: string;
  currency?: string;
}> {
  const { page, context } = await initBrowser();

  try {
    const { listingId, checkIn, checkOut, adults = 1, children = 0 } = params;
    const url = `${AIRBNB_BASE_URL}/rooms/${listingId}?checkin=${checkIn}&checkout=${checkOut}&adults=${adults}&children=${children}`;

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay(1000, 2000);

    const captcha = await page.$('iframe[src*="captcha"], #captcha');
    if (captcha) {
      throw new Error("CAPTCHA detected. Please complete it manually.");
    }

    const pricing = await page.evaluate(() => {
      const extractPrice = (selector: string): string | undefined => {
        const el = document.querySelector(selector);
        if (!el) return undefined;
        const text = el.textContent || "";
        const match = text.match(/\$[\d,]+(?:\.\d{2})?/);
        return match ? match[0] : undefined;
      };

      // Price breakdown section
      const priceRows = document.querySelectorAll(
        '[data-testid="price-item"], [class*="priceBreakdown"] tr, [class*="price-item"]'
      );
      let pricePerNight: string | undefined;
      let cleaningFee: string | undefined;
      let serviceFee: string | undefined;
      let taxes: string | undefined;
      let nights: number | undefined;

      priceRows.forEach((row) => {
        const text = row.textContent?.toLowerCase() || "";
        const priceMatch = row.textContent?.match(/\$[\d,]+(?:\.\d{2})?/);
        const price = priceMatch ? priceMatch[0] : undefined;

        if (text.includes("night") && !text.includes("cleaning")) {
          pricePerNight = price;
          const nightMatch = text.match(/(\d+)\s+night/);
          if (nightMatch) nights = parseInt(nightMatch[1]);
        } else if (text.includes("cleaning")) {
          cleaningFee = price;
        } else if (text.includes("service")) {
          serviceFee = price;
        } else if (text.includes("tax")) {
          taxes = price;
        }
      });

      const totalEl = document.querySelector(
        '[data-testid="price-row-total"], [class*="totalPrice"], [class*="total"] strong'
      );
      const totalText = totalEl?.textContent || "";
      const totalMatch = totalText.match(/\$[\d,]+(?:\.\d{2})?/);
      const total = totalMatch ? totalMatch[0] : undefined;

      return { pricePerNight, nights, cleaningFee, serviceFee, taxes, total };
    });

    await saveCookies(context);
    return { ...pricing, currency: "USD" };
  } catch (error) {
    throw new Error(
      `Failed to get price: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Save a listing to wishlist
 */
export async function saveListing(
  listingId: string,
  wishlistName?: string
): Promise<{ success: boolean; message: string }> {
  const { page, context } = await initBrowser();

  try {
    await page.goto(`${AIRBNB_BASE_URL}/rooms/${listingId}`, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    // Click the save/heart button
    const saveButton = await page.$(
      'button[aria-label*="wishlist"], button[aria-label*="Save"], [data-testid="wish-list-button"]'
    );

    if (!saveButton) {
      throw new Error(
        "Could not find save button. You may need to be logged in."
      );
    }

    await saveButton.click();
    await randomDelay(500, 1000);

    // If a modal appears for naming wishlist
    if (wishlistName) {
      const createNewEl = await page.$(
        'button:has-text("Create new list"), [aria-label*="Create new"]'
      ).catch(() => null);
      if (createNewEl) {
        await createNewEl.click();
        await randomDelay(300, 600);
        const nameInput = await page.$('input[placeholder*="list name"], input[aria-label*="name"]').catch(() => null);
        if (nameInput) {
          await nameInput.fill(wishlistName);
          await randomDelay(200, 400);
          const saveBtn = await page.$('button:has-text("Create"), [data-testid="create-list-button"]').catch(() => null);
          if (saveBtn) await saveBtn.click();
        }
      }
    } else {
      // Select existing or confirm save
      const firstList = await page.$('[data-testid="wish-list-item"], button[class*="wishlist-item"]').catch(() => null);
      if (firstList) {
        await firstList.click();
        await randomDelay(300, 600);
      }
    }

    await saveCookies(context);

    return {
      success: true,
      message: `Listing ${listingId} saved to wishlist${wishlistName ? ` "${wishlistName}"` : ""}`,
    };
  } catch (error) {
    throw new Error(
      `Failed to save listing: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get saved listings / wishlists
 */
export async function getSavedListings(): Promise<{
  wishlists: Array<{
    name: string;
    count: number;
    imageUrl?: string;
    listings?: ListingResult[];
  }>;
}> {
  const { page, context } = await initBrowser();

  try {
    await page.goto(`${AIRBNB_BASE_URL}/wishlists`, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    const captcha = await page.$('iframe[src*="captcha"], #captcha');
    if (captcha) {
      throw new Error("CAPTCHA detected. Please complete it manually.");
    }

    const wishlists = await page.evaluate(() => {
      const cards = document.querySelectorAll(
        '[data-testid="wishlist-card"], [class*="wishlistCard"], [class*="WishlistCard"]'
      );
      const results: Array<{
        name: string;
        count: number;
        imageUrl?: string;
      }> = [];

      cards.forEach((card) => {
        const nameEl = card.querySelector(
          "[class*='title'], h3, [data-testid='wishlist-name']"
        );
        const countEl = card.querySelector(
          "[class*='count'], [data-testid='wishlist-count']"
        );
        const imgEl = card.querySelector("img");

        const name = nameEl?.textContent?.trim() || "Wishlist";
        const countText = countEl?.textContent || "0";
        const countMatch = countText.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0]) : 0;

        results.push({
          name,
          count,
          imageUrl: imgEl?.src || undefined,
        });
      });

      return results;
    });

    await saveCookies(context);
    return { wishlists };
  } catch (error) {
    throw new Error(
      `Failed to get saved listings: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Book a listing (requires explicit confirmation)
 */
export async function bookListing(params: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  confirm?: boolean;
}): Promise<
  | { requiresConfirmation: true; preview: object }
  | { success: true; confirmationCode: string; message: string }
> {
  const {
    listingId,
    checkIn,
    checkOut,
    adults = 1,
    children = 0,
    confirm = false,
  } = params;

  if (!confirm) {
    // Return preview without booking
    const price = await getPrice({ listingId, checkIn, checkOut, adults, children });
    return {
      requiresConfirmation: true,
      preview: {
        listingId,
        checkIn,
        checkOut,
        adults,
        children,
        pricing: price,
        message:
          "Booking not initiated. Call airbnb_book with confirm=true to proceed.",
      },
    };
  }

  const { page, context } = await initBrowser();

  try {
    const url = `${AIRBNB_BASE_URL}/rooms/${listingId}?checkin=${checkIn}&checkout=${checkOut}&adults=${adults}&children=${children}`;
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    // Click Reserve/Book button
    const reserveButton = await page.$(
      'button[data-testid="book-it-cta"], button:has-text("Reserve"), button:has-text("Book")'
    );

    if (!reserveButton) {
      throw new Error(
        "Could not find Reserve button. Listing may be unavailable or you may need to be logged in."
      );
    }

    await reserveButton.click();
    await randomDelay(1000, 2000);

    // Wait for booking/checkout page
    await page.waitForURL(/\/book\/|\/checkout/, {
      timeout: 15000,
    }).catch(() => {});

    await randomDelay(1000, 2000);

    // Click confirm/request to book
    const confirmButton = await page.$(
      'button[data-testid="confirm-booking"], button:has-text("Request to book"), button:has-text("Confirm and pay")'
    );

    if (!confirmButton) {
      throw new Error(
        "Reached booking page but could not find confirm button. Manual completion may be needed."
      );
    }

    await confirmButton.click();
    await randomDelay(2000, 3000);

    // Wait for confirmation
    await page
      .waitForURL(/\/reservation\/|\/confirmation\/|\/itinerary\//, {
        timeout: 30000,
      })
      .catch(() => {});

    // Extract confirmation code
    const confirmationCode = await page.evaluate(() => {
      const codeEl = document.querySelector(
        "[data-testid='confirmation-code'], [class*='confirmationCode'], [class*='reservation-code']"
      );
      return codeEl?.textContent?.trim() || null;
    });

    await saveCookies(context);

    return {
      success: true,
      confirmationCode: confirmationCode || "See your email for confirmation",
      message: `Booking confirmed for ${checkIn} - ${checkOut}. Confirmation: ${confirmationCode || "Check your email"}`,
    };
  } catch (error) {
    throw new Error(
      `Failed to book listing: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get reservations (upcoming or past)
 */
export async function getReservations(
  type: "upcoming" | "past" | "all" = "upcoming"
): Promise<Reservation[]> {
  const { page, context } = await initBrowser();

  try {
    const url =
      type === "past"
        ? `${AIRBNB_BASE_URL}/trips/v1/past`
        : `${AIRBNB_BASE_URL}/trips/v1/upcoming`;

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    const captcha = await page.$('iframe[src*="captcha"], #captcha');
    if (captcha) {
      throw new Error("CAPTCHA detected. Please complete it manually.");
    }

    // Check if redirected to login
    if (page.url().includes("/login")) {
      throw new Error("Login required. Use airbnb_login to authenticate.");
    }

    const reservations = await page.evaluate(() => {
      const cards = document.querySelectorAll(
        '[data-testid="trip-card"], [class*="tripCard"], [class*="TripCard"], [class*="reservation"]'
      );
      const results: Array<{
        id: string;
        listingTitle: string;
        listingUrl?: string;
        checkIn: string;
        checkOut: string;
        guests?: number;
        totalPrice?: string;
        status: string;
        hostName?: string;
        confirmationCode?: string;
      }> = [];

      cards.forEach((card, idx) => {
        const titleEl = card.querySelector(
          "[class*='title'], h3, [data-testid='trip-title']"
        );
        const title = titleEl?.textContent?.trim() || "Reservation";

        const linkEl = card.querySelector("a[href*='/reservation/']");
        const href = linkEl?.getAttribute("href") || "";
        const idMatch = href.match(/\/reservation\/([^/]+)/);

        const dateEl = card.querySelector(
          "[class*='date'], [data-testid='trip-dates']"
        );
        const dateText = dateEl?.textContent?.trim() || "";

        const statusEl = card.querySelector(
          "[class*='status'], [data-testid='trip-status']"
        );
        const status = statusEl?.textContent?.trim() || "Unknown";

        const priceEl = card.querySelector(
          "[class*='price'], [data-testid='trip-price']"
        );
        const priceMatch = priceEl?.textContent?.match(/\$[\d,]+/);

        const codeEl = card.querySelector("[class*='confirmation']");
        const confirmationCode = codeEl?.textContent?.trim() || undefined;

        results.push({
          id: idMatch ? idMatch[1] : String(idx),
          listingTitle: title,
          listingUrl: href ? `https://www.airbnb.com${href}` : undefined,
          checkIn: dateText.split("–")[0]?.trim() || "Unknown",
          checkOut: dateText.split("–")[1]?.trim() || "Unknown",
          status,
          totalPrice: priceMatch ? priceMatch[0] : undefined,
          confirmationCode,
        });
      });

      return results;
    });

    await saveCookies(context);
    return reservations;
  } catch (error) {
    throw new Error(
      `Failed to get reservations: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(params: {
  reservationId: string;
  confirm?: boolean;
}): Promise<{ success: boolean; message: string; refundInfo?: string }> {
  const { reservationId, confirm = false } = params;

  if (!confirm) {
    return {
      success: false,
      message:
        "Cancellation not initiated. Call airbnb_cancel_reservation with confirm=true to proceed. " +
        "Note: Cancellation policies vary — check your booking for refund details before confirming.",
    };
  }

  const { page, context } = await initBrowser();

  try {
    await page.goto(
      `${AIRBNB_BASE_URL}/reservation/itinerary?code=${reservationId}`,
      { waitUntil: "networkidle", timeout: DEFAULT_TIMEOUT }
    );
    await randomDelay();

    if (page.url().includes("/login")) {
      throw new Error("Login required. Use airbnb_login to authenticate.");
    }

    // Find and click cancel button
    const cancelButton = await page.$(
      'button:has-text("Cancel reservation"), a:has-text("Cancel reservation"), [data-testid="cancel-button"]'
    );

    if (!cancelButton) {
      throw new Error(
        "Could not find cancel button. The reservation may not be cancellable or may not exist."
      );
    }

    await cancelButton.click();
    await randomDelay(1000, 2000);

    // Handle confirmation dialog
    const confirmCancelButton = await page.$(
      'button:has-text("Confirm cancellation"), [data-testid="confirm-cancel"]'
    );
    if (confirmCancelButton) {
      await confirmCancelButton.click();
      await randomDelay(1000, 2000);
    }

    // Get refund info if displayed
    const refundEl = await page.$(
      "[class*='refund'], [data-testid='refund-amount']"
    );
    const refundInfo = refundEl
      ? (await refundEl.textContent()) || undefined
      : undefined;

    await saveCookies(context);

    return {
      success: true,
      message: `Reservation ${reservationId} cancelled successfully.`,
      refundInfo: refundInfo?.trim(),
    };
  } catch (error) {
    throw new Error(
      `Failed to cancel reservation: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Send a message to a host
 */
export async function messageHost(params: {
  reservationId?: string;
  listingId?: string;
  message: string;
}): Promise<{ success: boolean; message: string }> {
  const { reservationId, listingId, message } = params;

  if (!reservationId && !listingId) {
    throw new Error("Either reservationId or listingId is required.");
  }

  const { page, context } = await initBrowser();

  try {
    let messageUrl: string;
    if (reservationId) {
      messageUrl = `${AIRBNB_BASE_URL}/messaging/thread/${reservationId}`;
    } else {
      messageUrl = `${AIRBNB_BASE_URL}/rooms/${listingId}/contact_host`;
    }

    await page.goto(messageUrl, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    if (page.url().includes("/login")) {
      throw new Error("Login required. Use airbnb_login to authenticate.");
    }

    // Find message input
    const messageInput = await page.$(
      'textarea[placeholder*="message"], textarea[aria-label*="message"], [data-testid="message-input"] textarea'
    );

    if (!messageInput) {
      throw new Error(
        "Could not find message input. You may need to be logged in or the thread may not exist."
      );
    }

    await messageInput.click();
    await randomDelay(300, 600);
    await messageInput.fill(message);
    await randomDelay(500, 1000);

    // Send message
    const sendButton = await page.$(
      'button[type="submit"], button:has-text("Send"), [data-testid="send-button"]'
    );

    if (!sendButton) {
      throw new Error("Could not find send button.");
    }

    await sendButton.click();
    await randomDelay(1000, 2000);

    await saveCookies(context);

    return {
      success: true,
      message: "Message sent successfully to host.",
    };
  } catch (error) {
    throw new Error(
      `Failed to message host: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get reviews for a listing
 */
export async function getReviews(
  listingId: string,
  maxResults: number = 10
): Promise<Review[]> {
  const { page, context } = await initBrowser();

  try {
    await page.goto(`${AIRBNB_BASE_URL}/rooms/${listingId}`, {
      waitUntil: "networkidle",
      timeout: DEFAULT_TIMEOUT,
    });
    await randomDelay();

    // Scroll to reviews section to trigger lazy loading
    const reviewSection = await page.$(
      '[data-section-id="REVIEWS_DEFAULT"], [class*="review"]'
    );
    if (reviewSection) {
      await reviewSection.scrollIntoViewIfNeeded();
      await randomDelay(500, 1000);
    }

    const reviews = await page.evaluate(
      (max: number) => {
        const reviewEls = document.querySelectorAll(
          '[data-testid="review-card"], [class*="ReviewCard"], [class*="review-card"], [itemprop="review"]'
        );
        const results: Array<{
          author: string;
          date: string;
          rating?: string;
          text: string;
        }> = [];

        reviewEls.forEach((el, idx) => {
          if (idx >= max) return;

          const authorEl = el.querySelector(
            "[class*='author'], [itemprop='author'], h3"
          );
          const author = authorEl?.textContent?.trim() || "Anonymous";

          const dateEl = el.querySelector(
            "[class*='date'], time, [itemprop='datePublished']"
          );
          const date = dateEl?.textContent?.trim() || "Unknown date";

          const ratingEl = el.querySelector(
            "[class*='rating'], [aria-label*='star']"
          );
          const ratingText = ratingEl?.getAttribute("aria-label") || "";
          const ratingMatch = ratingText.match(/(\d+)/);
          const rating = ratingMatch ? ratingMatch[1] : undefined;

          const textEl = el.querySelector(
            "[class*='comment'], [itemprop='description'], [class*='review-text'], p"
          );
          const text = textEl?.textContent?.trim() || "";

          if (author || text) {
            results.push({ author, date, rating, text });
          }
        });

        return results;
      },
      Math.min(maxResults, 50)
    );

    await saveCookies(context);
    return reviews;
  } catch (error) {
    throw new Error(
      `Failed to get reviews: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Ensure browser cleanup on process exit
process.on("exit", () => {
  if (browser) {
    browser.close().catch(() => {});
  }
});

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
