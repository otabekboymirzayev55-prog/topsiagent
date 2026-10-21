import { randomUUID } from "node:crypto";
import { trustedRetailUrl } from "./search-agent.js";
import { canonicalRetailUrl, directProductPage } from "./gemini-search.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const minute = 60_000;
const hour = 60 * minute;
const maxPageBytes = 1024 * 1024;
const fail = (status, code, message, extra = {}) => Object.assign(new Error(message), { status, code, ...extra });

export function priceWatchCapabilities(env = process.env) {
  const configured = Number(env.PRICE_WATCH_INTERVAL_MS);
  const intervalMs = Number.isFinite(configured) && configured >= hour && configured <= 24 * hour ? configured : 6 * hour;
  return { automaticEnabled: env.PRICE_WATCH_ENABLED !== "false", intervalHours: intervalMs / hour, manualCheck: true };
}

export function savedProductUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || !trustedRetailUrl(value)) return null;
  try {
    if (new URL(value).port && new URL(value).port !== "443") return null;
    const url = canonicalRetailUrl(value);
    return url && url.length <= 2048 && directProductPage(url) ? url : null;
  } catch { return null; }
}

function amount(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d{1,4})?$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number < 1e12 ? number : null;
}
function priceValue(price, currency) {
  const value = amount(price);
  return value !== null && typeof currency === "string" && /^[A-Z]{3}$/.test(currency.trim())
    ? { price: value, currency: currency.trim() } : null;
}
function typeIs(value, name) { return (Array.isArray(value) ? value : [value]).some(type => typeof type === "string" && type.split(/[\/#]/).at(-1) === name); }
function productNodes(value, found = [], depth = 0) {
  if (!value || typeof value !== "object" || depth > 12 || found.length > 30) return found;
  if (Array.isArray(value)) { for (const item of value) productNodes(item, found, depth + 1); }
  else {
    if (typeIs(value["@type"], "Product")) found.push(value);
    // Only graph/main-entity containers can designate the page's main product;
    // do not traverse recommendation/item-list widgets to guess a price.
    for (const key of ["@graph", "mainEntity", "mainEntityOfPage"]) productNodes(value[key], found, depth + 1);
  }
  return found;
}
function offerPrices(offers) {
  return (Array.isArray(offers) ? offers : [offers]).flatMap(offer => {
    if (!offer || typeof offer !== "object") return [];
    if (/\/(?:OutOfStock|Discontinued|SoldOut)$/.test(String(offer.availability || ""))) return [];
    if (offer.priceValidUntil) {
      const until = /^\d{4}-\d{2}-\d{2}$/.test(offer.priceValidUntil) ? `${offer.priceValidUntil}T23:59:59.999Z` : offer.priceValidUntil;
      if (!Number.isFinite(Date.parse(until)) || Date.parse(until) < Date.now()) return [];
    }
    if (typeIs(offer["@type"], "AggregateOffer")) {
      const low = amount(offer.lowPrice), high = amount(offer.highPrice);
      const exact = low !== null && low === high ? priceValue(low, offer.priceCurrency) : null;
      return exact ? [exact] : [];
    }
    const value = priceValue(offer.price, offer.priceCurrency);
    return value ? [value] : [];
  });
}
function unambiguousPrice(values) {
  const unique = new Map(values.map(value => [`${value.currency}:${value.price}`, value]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    result[match[1].toLowerCase()] = (match[2] ?? match[3]).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
  return result;
}

const variantKeys = new Set(["skuid", "sku", "variant", "variantid", "variation", "variationid", "var"]);
function pageIdentity(value, base) {
  try {
    const url = new URL(value, base);
    const variants = [...url.searchParams.entries()].filter(([key]) => variantKeys.has(key.toLowerCase()))
      .map(([key, value]) => [key.toLowerCase(), value]).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
    return { path: `${url.protocol}//${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`, variants: JSON.stringify(variants), hasVariant: variants.length > 0 };
  } catch { return null; }
}
function sameProduct(first, second) { return first && second && first.path === second.path && first.variants === second.variants; }

export function structuredProductPrice(html, pageUrl) {
  if (typeof html !== "string" || Buffer.byteLength(html) > maxPageBytes) return null;
  const products = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attrs(match[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try { productNodes(JSON.parse(match[2].trim()), products); } catch { /* Invalid structured data is not evidence of a price. */ }
  }
  const target = pageIdentity(pageUrl);
  if (!target) return null;
  const candidates = products.flatMap(product => {
    const declared = product.url ?? product["@id"];
    const identity = typeof declared === "string" ? pageIdentity(declared, pageUrl) : null;
    // An explicitly different Product is never a fallback for the main page.
    if (declared !== undefined && (!identity || identity.path !== target.path)) return [];
    const offers = (Array.isArray(product.offers) ? product.offers : [product.offers]).filter(Boolean);
    if (sameProduct(identity, target) || (declared === undefined && products.length === 1 && !target.hasVariant)) {
      return offers.filter(offer => {
        const offerUrl = offer.url ?? offer["@id"];
        return offerUrl === undefined || sameProduct(pageIdentity(offerUrl, pageUrl), target);
      });
    }
    // A generic Product URL can describe several SKUs. A matching offer URL
    // must explicitly identify the requested variant before its price is used.
    if (target.hasVariant) return offers.filter(offer => {
      const offerUrl = offer.url ?? offer["@id"];
      return typeof offerUrl === "string" && sameProduct(pageIdentity(offerUrl, pageUrl), target);
    });
    return [];
  });
  if (candidates.length) {
    const value = unambiguousPrice(offerPrices(candidates));
    if (value) return { ...value, source: "jsonld" };
    // A declared Product with ambiguous offers must not be overridden by a
    // cheaper meta price for an unknown variant.
    return null;
  }
  if (products.length || target.hasVariant) return null;
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => attrs(match[0]));
  const properties = name => meta.filter(item => (item.property || item.name || item.itemprop || "").toLowerCase() === name).map(item => item.content);
  const prices = properties("product:price:amount"), currencies = properties("product:price:currency");
  const value = prices.length === 1 && currencies.length === 1 ? priceValue(prices[0], currencies[0]) : null;
  return value ? { ...value, source: "meta" } : null;
}

export async function fetchVerifiedPrice(value, request = fetch) {
  let current = savedProductUrl(value);
  if (!current) throw fail(400, "INVALID_PRODUCT_URL", "Only a supported retailer product page can be checked.");
  const originalHost = new URL(current).hostname.replace(/^www\./, "");
  const originalIdentity = pageIdentity(current);
  const started = Date.now();
  for (let redirects = 0; redirects < 3; redirects++) {
    let response;
    try {
      response = await request(current, { redirect: "manual", signal: AbortSignal.timeout(Math.max(1, 10000 - (Date.now() - started))),
        headers: { accept: "text/html,application/xhtml+xml" } });
    } catch { throw fail(422, "PRICE_UNAVAILABLE", "The store did not return a verifiable price."); }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      let next;
      try { next = location && savedProductUrl(new URL(location, current).href); } catch { /* Invalid redirect. */ }
      if (!next || new URL(next).hostname.replace(/^www\./, "") !== originalHost || !sameProduct(pageIdentity(next), originalIdentity))
        throw fail(422, "PRICE_UNAVAILABLE", "The store redirected away from this product.");
      current = next; continue;
    }
    if (!response.ok) throw fail(422, "PRICE_UNAVAILABLE", "The store did not return a verifiable price.");
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw fail(422, "PRICE_UNAVAILABLE", "The store did not return a product page.");
    if (Number(response.headers.get("content-length")) > maxPageBytes) throw fail(422, "PRICE_UNAVAILABLE", "The store page is too large to check.");
    let html = "";
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          bytes += chunk.byteLength;
          if (bytes > maxPageBytes) { await reader.cancel(); throw new Error("Page too large"); }
          chunks.push(Buffer.from(chunk));
        }
        html = Buffer.concat(chunks).toString("utf8");
      } catch { throw fail(422, "PRICE_UNAVAILABLE", "The store page could not be checked."); }
    } else html = await response.text();
    const price = structuredProductPrice(html, current);
    if (!price) throw fail(422, "PRICE_UNAVAILABLE", "The store has no unambiguous structured product price.");
    return price;
  }
  throw fail(422, "PRICE_UNAVAILABLE", "The store redirected too many times.");
}

const publicProduct = row => ({ id: row.id, title: row.title, store: row.store, url: row.url,
  price: row.last_price === null ? null : Number(row.last_price), currency: row.currency,
  baselinePrice: row.baseline_price === null ? null : Number(row.baseline_price), trackingEnabled: row.tracking_enabled,
  status: row.status, lastCheckedAt: row.last_checked_at, lastError: row.last_error, createdAt: row.created_at });
function dbFailure(error) {
  return fail(503, ["42P01", "42883", "PGRST205", "PGRST202"].includes(error?.code) ? "SAVED_PRODUCTS_SETUP_REQUIRED" : "SAVED_PRODUCTS_UNAVAILABLE",
    "Saved products are temporarily unavailable.");
}
function checked(result) { if (result.error) throw dbFailure(result.error); return result.data; }

export function createSavedProductsService({ db, request = fetch, now = () => Date.now(), env = process.env }) {
  const capabilities = () => priceWatchCapabilities(env);
  async function owned(userId, id) {
    if (!uuid.test(id || "")) throw fail(400, "INVALID_ID", "Invalid saved product id.");
    const row = checked(await db.from("saved_products").select("*").eq("id", id).eq("user_id", userId).maybeSingle());
    if (!row) throw fail(404, "SAVED_PRODUCT_NOT_FOUND", "Saved product not found.");
    return row;
  }
  async function updateOwned(userId, id, values, lease) {
    let query = db.from("saved_products").update({ ...values, updated_at: new Date(now()).toISOString() }).eq("id", id).eq("user_id", userId);
    if (lease) query = query.eq("checking_until", lease);
    const row = checked(await query.select("*").maybeSingle());
    if (!row) throw fail(409, "CHECK_IN_PROGRESS", "The product changed during this check.");
    return row;
  }
  async function checkPrice(userId, id, { cooldownMs = 5 * minute } = {}) {
    const row = await owned(userId, id);
    const timestamp = now();
    const retryAt = Math.max(Date.parse(row.last_checked_at || "") + cooldownMs || 0, Date.parse(row.checking_until || "") || 0);
    if (retryAt > timestamp) throw fail(429, "PRICE_CHECK_COOLDOWN", "Please wait before checking this product again.", { retryAfterSeconds: Math.ceil((retryAt - timestamp) / 1000) });
    const lease = new Date(timestamp + 30_000).toISOString();
    let claim = db.from("saved_products").update({ checking_until: lease }).eq("id", id).eq("user_id", userId);
    claim = row.checking_until ? claim.eq("checking_until", row.checking_until) : claim.is("checking_until", null);
    claim = row.last_checked_at ? claim.eq("last_checked_at", row.last_checked_at) : claim.is("last_checked_at", null);
    if (!checked(await claim.select("id").maybeSingle())) throw fail(409, "CHECK_IN_PROGRESS", "This product is already being checked.");
    let verified;
    try { verified = await fetchVerifiedPrice(row.url, request); }
    catch (error) {
      const product = await updateOwned(userId, id, { checking_until: null, last_checked_at: new Date(timestamp).toISOString(), last_error: "PRICE_UNAVAILABLE", status: "price_unavailable" }, lease);
      throw fail(422, "PRICE_UNAVAILABLE", "The current price could not be verified. Tracking has not been newly enabled.", { product: publicProduct(product) });
    }
    // Persist the price and any drop alert together. A failed alert insert must
    // not silently consume the old price and lose the notification.
    const applied = checked(await db.rpc("apply_saved_product_price", { p_user_id: userId, p_id: id, p_lease: lease,
      p_price: verified.price, p_currency: verified.currency, p_checked_at: new Date(timestamp).toISOString() }));
    if (!applied?.row) throw fail(409, "CHECK_IN_PROGRESS", "The product changed during this check.");
    return { product: publicProduct(applied.row), priceDrop: Boolean(applied.price_drop) };
  }
  return {
    capabilities,
    async list(userId) { return { products: checked(await db.from("saved_products").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100)).map(publicProduct), priceTracking: capabilities() }; },
    async save(userId, input) {
      const url = savedProductUrl(input?.url);
      if (!url || typeof input?.title !== "string" || !input.title.trim() || input.title.length > 200)
        throw fail(400, "INVALID_PRODUCT", "A supported product page and title are required.");
      const existing = checked(await db.from("saved_products").select("*").eq("user_id", userId).eq("url", url).maybeSingle());
      if (existing) return { product: publicProduct(existing), existing: true };
      const countResult = await db.from("saved_products").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (countResult.error) throw dbFailure(countResult.error);
      if (countResult.count >= 100) throw fail(409, "SAVED_PRODUCTS_LIMIT", "You can save up to 100 products.");
      const values = { id: randomUUID(), user_id: userId, title: input.title.trim(), store: new URL(url).hostname.replace(/^www\./, ""), url };
      const result = await db.from("saved_products").insert(values).select("*").single();
      if (result.error?.code === "23505") {
        const duplicate = checked(await db.from("saved_products").select("*").eq("user_id", userId).eq("url", url).maybeSingle());
        if (duplicate) return { product: publicProduct(duplicate), existing: true };
      }
      return { product: publicProduct(checked(result)), existing: false };
    },
    checkPrice,
    async setTracking(userId, id, enabled) {
      if (typeof enabled !== "boolean") throw fail(400, "INVALID_TRACKING_STATE", "trackingEnabled must be true or false.");
      const row = await owned(userId, id);
      if (enabled && !capabilities().automaticEnabled)
        throw fail(503, "AUTOMATIC_TRACKING_NOT_CONFIGURED", "Automatic price tracking is not enabled. Manual price checks are available.");
      if (enabled) {
        // A fresh verified price is required when enabling. Reuse a successful
        // recent check rather than spending another store request immediately.
        const fresh = row.last_price !== null && row.currency && !row.last_error && now() - Date.parse(row.last_checked_at || "") < 5 * minute;
        if (!fresh) await checkPrice(userId, id);
      }
      return { product: publicProduct(await updateOwned(userId, id, { tracking_enabled: enabled, status: enabled ? "active" : "paused" })), priceTracking: capabilities() };
    },
    async remove(userId, id) {
      await owned(userId, id);
      checked(await db.from("saved_products").delete().eq("id", id).eq("user_id", userId));
      return { ok: true };
    },
    async notifications(userId) {
      const rows = checked(await db.from("price_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50));
      return { notifications: rows.map(row => ({ id: row.id, savedProductId: row.saved_product_id, title: row.title, url: row.url,
        previousPrice: Number(row.previous_price), price: Number(row.price), currency: row.currency, createdAt: row.created_at, readAt: row.read_at })) };
    },
    async dismiss(userId, id) {
      if (!uuid.test(id || "")) throw fail(400, "INVALID_ID", "Invalid notification id.");
      const row = checked(await db.from("price_notifications").update({ read_at: new Date(now()).toISOString() }).eq("id", id).eq("user_id", userId).select("id").maybeSingle());
      if (!row) throw fail(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
      return { ok: true };
    },
    async runBatch() {
      const config = capabilities();
      if (!config.automaticEnabled) return { checked: 0 };
      const before = new Date(now() - config.intervalHours * hour).toISOString();
      const rows = checked(await db.from("saved_products").select("id,user_id").eq("tracking_enabled", true).or(`last_checked_at.is.null,last_checked_at.lt.${before}`).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(10));
      let count = 0;
      for (const row of rows) {
        try { await checkPrice(row.user_id, row.id, { cooldownMs: config.intervalHours * hour }); count++; }
        catch (error) { if (![409, 422, 429].includes(error.status)) throw error; }
      }
      return { checked: count };
    }
  };
}

export function registerSavedProductRoutes(app, { db, requireAuth, request, env = process.env }) {
  const service = createSavedProductsService({ db, request, env });
  const handler = action => async (req, res) => {
    try { res.json(await action(req)); }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : "Saved products are temporarily unavailable.",
      code: error.code || "SAVED_PRODUCTS_UNAVAILABLE", ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}), ...(error.product ? { product: error.product } : {}) }); }
  };
  app.get("/api/saved-products/capabilities", (_req, res) => res.json({ savedProducts: true, priceTracking: service.capabilities() }));
  app.get("/api/saved-products", requireAuth, handler(req => service.list(req.user.id)));
  app.post("/api/saved-products", requireAuth, handler(req => service.save(req.user.id, req.body)));
  app.patch("/api/saved-products/:id", requireAuth, handler(req => service.setTracking(req.user.id, req.params.id, req.body?.trackingEnabled)));
  app.post("/api/saved-products/:id/check", requireAuth, handler(req => service.checkPrice(req.user.id, req.params.id)));
  app.delete("/api/saved-products/:id", requireAuth, handler(req => service.remove(req.user.id, req.params.id)));
  app.get("/api/price-notifications", requireAuth, handler(req => service.notifications(req.user.id)));
  app.patch("/api/price-notifications/:id", requireAuth, handler(req => {
    if (req.body?.read !== true) throw fail(400, "INVALID_NOTIFICATION_STATE", "read must be true.");
    return service.dismiss(req.user.id, req.params.id);
  }));
  return service;
}

export function startPriceWatchWorker(service, { enabled = service.capabilities().automaticEnabled, logger = console.warn } = {}) {
  if (!enabled) return () => {};
  let stopped = false, timer;
  const schedule = delay => { timer = setTimeout(tick, delay); timer.unref?.(); };
  const tick = async () => {
    try { await service.runBatch(); }
    catch { logger("Price watch batch unavailable; saved-product setup or store access may be missing."); }
    if (!stopped) schedule(5 * minute);
  };
  schedule(10_000);
  return () => { stopped = true; clearTimeout(timer); };
}
