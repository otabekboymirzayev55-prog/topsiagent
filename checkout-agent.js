/**
 * checkout-agent.js
 *
 * Playwright browser agent powered by Claude Vision.
 *
 * Flow:
 *   1. Open product URL in stealth browser
 *   2. Screenshot → Claude Vision → decide next action
 *   3. Execute action (click, type, scroll, select)
 *   4. Repeat until order confirmed or max steps reached
 *
 * Claude Vision receives a screenshot + user context on every step,
 * then returns a structured action JSON — no hard-coded site logic needed.
 */

import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_STEPS     = 30;
const VIEWPORT      = { width: 1280, height: 800 };
const STEP_DELAY_MS = 800;

// ── Stealth launch options ───────────────────────────────────────────────────
const LAUNCH_OPTS = {
  headless: process.env.HEADLESS !== "false", // set HEADLESS=false to watch
  args: [
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--window-size=1280,800",
  ],
};

// ── System prompt for Claude Vision ─────────────────────────────────────────
const VISION_SYSTEM = `You are a browser automation agent completing an online purchase.
You receive a screenshot of the current browser state and must decide the single next action.

Respond with ONLY a valid JSON object (no markdown) in one of these shapes:

{ "action": "click",    "selector": "CSS or text description", "description": "why" }
{ "action": "type",     "selector": "CSS or text description", "text": "value to type", "description": "why" }
{ "action": "select",   "selector": "CSS or text description", "value": "option value", "description": "why" }
{ "action": "scroll",   "direction": "down", "amount": 300, "description": "why" }
{ "action": "wait",     "ms": 1500, "description": "why" }
{ "action": "done",     "orderId": "order number if visible or null", "description": "order is confirmed" }
{ "action": "error",    "description": "what went wrong and why we cannot continue" }

Rules:
- Prefer visible text selectors over CSS when possible: e.g. text="Add to Cart"
- Skip cookie banners, newsletter popups, or login walls by closing/dismissing them
- If a CAPTCHA appears, return { "action": "error", "description": "CAPTCHA detected" }
- Fill only the fields needed: shipping address, then payment, then confirm
- Never click anything that would navigate away from checkout
- When you see an order confirmation page, return "done" with the order ID`;

// ── Main agent function ───────────────────────────────────────────────────────
export async function checkoutAgent({ product, userProfile, emit }) {
  emit("step", { message: "Launching secure browser..." });

  const browser = await chromium.launch(LAUNCH_OPTS);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });

  // Hide automation signals
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  try {
    emit("step", { message: `Navigating to ${product.store}...` });
    await page.goto(product.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await delay(1500);

    const conversationHistory = [];
    let stepCount = 0;

    while (stepCount < MAX_STEPS) {
      // ── Screenshot ──────────────────────────────────────────────────────
      const screenshotBuffer = await page.screenshot({ fullPage: false });
      const base64Screenshot = screenshotBuffer.toString("base64");

      // ── Build context message ────────────────────────────────────────────
      const userMessage = {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64Screenshot }
          },
          {
            type: "text",
            text: buildContextPrompt(product, userProfile, stepCount)
          }
        ]
      };

      conversationHistory.push(userMessage);

      // ── Ask Claude Vision what to do ─────────────────────────────────────
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: VISION_SYSTEM,
        messages: conversationHistory
      });

      const raw = response.content.find(b => b.type === "text")?.text || "{}";
      const action = parseAction(raw);

      // Add assistant turn to history
      conversationHistory.push({ role: "assistant", content: response.content });

      emit("step", { message: `Step ${stepCount + 1}: ${action.description}`, action });

      // ── Execute action ───────────────────────────────────────────────────
      if (action.action === "done") {
        const orderId = action.orderId || generateOrderId();
        emit("success", { orderId, product });
        return { orderId };
      }

      if (action.action === "error") {
        throw new Error(action.description);
      }

      await executeAction(page, action);
      await delay(STEP_DELAY_MS);
      stepCount++;
    }

    throw new Error("Checkout agent reached max steps without confirming order");

  } finally {
    await browser.close();
  }
}

// ── Action executor ──────────────────────────────────────────────────────────
async function executeAction(page, action) {
  switch (action.action) {

    case "click": {
      const el = await resolveElement(page, action.selector);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await el.click({ timeout: 5000 });
      }
      break;
    }

    case "type": {
      const el = await resolveElement(page, action.selector);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await el.click({ clickCount: 3 }); // select all
        await el.type(action.text, { delay: 40 });
      }
      break;
    }

    case "select": {
      const el = await resolveElement(page, action.selector);
      if (el) await el.selectOption(action.value);
      break;
    }

    case "scroll": {
      const amount = action.direction === "up" ? -(action.amount || 300) : (action.amount || 300);
      await page.evaluate(y => window.scrollBy(0, y), amount);
      break;
    }

    case "wait": {
      await delay(action.ms || 1000);
      break;
    }
  }
}

// ── Element resolver — tries text first, then CSS ────────────────────────────
async function resolveElement(page, selector) {
  // Try text match
  if (!selector.startsWith("#") && !selector.startsWith(".") && !selector.includes("[")) {
    const textSelector = `text=${selector}`;
    const el = page.locator(textSelector).first();
    if (await el.count() > 0) return el;
  }
  // Fall back to CSS/XPath
  const el = page.locator(selector).first();
  if (await el.count() > 0) return el;
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildContextPrompt(product, profile, step) {
  return `
STEP: ${step + 1}
GOAL: Purchase "${product.title}" for $${product.price} from ${product.store}

USER PROFILE:
  Name:    ${profile.firstName} ${profile.lastName}
  Email:   ${profile.email}
  Phone:   ${profile.phone}
  Address: ${profile.address}, ${profile.city}, ${profile.state} ${profile.zip}, ${profile.country}
  Card:    ${profile.cardNumber} | Exp: ${profile.cardExpiry} | CVV: ${profile.cardCvv}

Look at the screenshot and decide the SINGLE best next action to complete this purchase.
Return ONLY the JSON action object.`.trim();
}

function parseAction(raw) {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { action: "error", description: "Could not parse action: " + raw };
  } catch {
    return { action: "error", description: "Invalid JSON from vision model" };
  }
}

function generateOrderId() {
  return "ORD-" + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
