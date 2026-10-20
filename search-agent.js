import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const model = "claude-sonnet-4-6";
const tools = [{ type: "web_search_20250305", name: "web_search" }];
const retailerDomains = [
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.in", "amazon.ca",
  "walmart.com", "bestbuy.com", "target.com", "ebay.com", "ebay.co.uk", "costco.com",
  "newegg.com", "bhphotovideo.com", "currys.co.uk", "johnlewis.com", "argos.co.uk",
  "olcha.uz", "mi-store.uz", "market.beeline.uz", "mediapark.uz", "uzum.uz",
  "asaxiy.uz", "texnomart.uz", "alifshop.uz", "idea.uz", "goodzone.uz"
];

const system = `You are Top, a careful multilingual shopping assistant.
Reply in the language of the user's latest message (Uzbek, Russian, English, etc.). Use the full conversation and previously shown product cards to understand follow-ups. Respect all positive and negative constraints, especially product category, budget, country, brand and explicit exclusions. A statement like "menga iPad kerak emas" means the user does NOT want an iPad; ask what they want instead. Ask one concise question only when the product itself is unknown. Country and budget are optional: when absent, search reasonable options and explain assumptions. If the user says "farqi yo‘q" or has no preference, do not repeat a question they have already answered. Avoid emoji.
If the user selects a previously shown product or asks to buy it, identify that product by its position or name. Show its retailer link in products and explain that the user can continue the purchase on the store page. Do not claim that an order was placed. Do not say that previous results were lost when product cards are included in the conversation.
When a user includes a photo, identify only visible product details. Do not claim an exact brand or model unless it is clearly visible. Search for that product or close matches and explain uncertainty when needed. A follow-up can refer to an earlier photo.

When the request is clear, use web search for current, direct product pages from established retailers. Return 1 to 4 genuinely relevant products, never pad the list. Do not recommend accessories when the user asks for the main device. Do not invent prices, discounts, ratings, review counts, availability, URLs, or delivery dates. Omit uncertain fields. Treat a source's price as indicative; it can change at checkout. If no relevant product can be verified, return an empty list and explain this. Keep the reply general rather than naming a top store or price, since product links are validated after your answer.

Your final answer MUST be a single JSON object, without markdown:
{"type":"clarify"|"results","reply":"short helpful message in user's language","products":[{"title":"exact product name","price":number|null,"currency":"USD or source currency","originalPrice":number|null,"store":"retailer","rating":number|null,"reviews":string|null,"why":"specific reason this matches","url":"direct https product URL"}],"followUps":["short relevant follow-up the user can tap"]}
For clarify, products must be [] and followUps should contain up to 3 short, plausible answers to your question when possible. For results, include only products actually supported by search results; followUps should offer useful next steps such as a lower budget, another brand or more options. Do not put a purchase link in followUps: the interface provides the retailer link. Reply should not claim certainty about stock or price.`;

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch { return false; }
}

export function trustedRetailUrl(value) {
  if (!validUrl(value)) return false;
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.username || url.password) return false;
  if (["redirect", "return", "next", "target", "url"].some(key => url.searchParams.has(key))) return false;
  return retailerDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

export async function verifyProductLinks(products, request = fetch) {
  const checked = await Promise.all(products.map(async product => {
    if (!trustedRetailUrl(product.url)) return null;
    try {
      const response = await request(product.url, {
        method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(7000)
      });
      if (response.status === 404 || response.status === 410) return null;
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location && !trustedRetailUrl(new URL(location, product.url).href)) return null;
      }
    } catch { /* Some shops block bot checks; keep the source URL and let users verify it. */ }
    return product;
  }));
  return checked.filter(Boolean);
}

export function standaloneExclusion(query) {
  const text = query.trim();
  if (/^menga\s+.+\s+kerak emas[.!?]*$/i.test(text))
    return "Tushundim. Unda qaysi mahsulot kerak?";
  if (/^(?:i\s+)?(?:do not|don't) want\s+.+[.!?]*$/i.test(text) && !/[,;]|\b(?:but|instead)\b/i.test(text))
    return "Got it. What product would you like instead?";
  if (/^мне\s+не\s+(?:нужен|нужна|нужно|нужны)\s+.+[.!?]*$/i.test(text) && !/[,;]|\bно\b/i.test(text))
    return "Понял. Какой товар вам нужен вместо этого?";
  return null;
}

function contextProducts(value) {
  return (Array.isArray(value) ? value : []).filter(product =>
    product && typeof product.title === "string" && typeof product.store === "string" &&
    typeof product.url === "string" && trustedRetailUrl(product.url)
  ).slice(0, 4).map(product => ({
    title: product.title.replace(/\s+/g, " ").slice(0, 200),
    store: product.store.replace(/\s+/g, " ").slice(0, 80), url: product.url,
    price: Number.isFinite(product.price) && product.price > 0 ? product.price : null,
    currency: typeof product.currency === "string" && /^[A-Z]{3}$/.test(product.currency) ? product.currency : null,
    why: typeof product.why === "string" ? product.why.slice(0, 240) : ""
  }));
}

function lastShownProducts(history) {
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index]?.role !== "assistant") continue;
    const products = contextProducts(history[index].products);
    if (products.length) return products;
  }
  return [];
}

export function resolveProductFollowUp(query, history = []) {
  const products = lastShownProducts(history);
  if (!products.length) return null;
  const text = query.toLocaleLowerCase().replace(/[’‘`]/g, "'").trim();
  const locale = /[а-яё]/i.test(text) ? "ru" : /\b(first|second|third|fourth|buy|purchase)\b/.test(text) ? "en" : "uz";
  const ordinal = text.match(/^(birinchi(?:si|sini|ni)?|ikkinchi(?:si|sini|ni)?|uchinchi(?:si|sini|ni)?|to'rtinchi(?:si|sini|ni)?|first|second|third|fourth|перв(?:ый|ую)|втор(?:ой|ую)|трет(?:ий|ью)|четв[её]рт(?:ый|ую)|[1-4](?:-?chi(?:si|sini)?|-?variant(?:ni)?)?)(?=$|[\s,.!?])/);
  const words = ordinal?.[1] || "";
  const position = /^(birinchi|first|перв|1)/.test(words) ? 0 : /^(ikkinchi|second|втор|2)/.test(words) ? 1 :
    /^(uchinchi|third|трет|3)/.test(words) ? 2 : /^(to'rtinchi|fourth|четв|4)/.test(words) ? 3 : -1;
  const purchase = /sotib\s+ol|olaman|buy|purchase|купить|покуп/.test(text);
  const vague = /^(?:shu|shuni|bu|buni|uni)\s+yoqdi[.!?]*$/.test(text) ||
    /^(?:sotib\s+ol|buy\s+it|purchase\s+it)[.!?]*$/.test(text);
  if (position < 0 && !vague) return null;
  if (position >= 0 && (text.includes("?") || (text.length > 80 && !purchase))) return null;
  if (position >= products.length) return null;
  if (position < 0 && products.length > 1) {
    const options = locale === "en" ? ["First", "Second", "Third"] : locale === "ru" ? ["Первый", "Второй", "Третий"] : ["Birinchisi", "Ikkinchisi", "Uchinchisi"];
    return { type: "clarify", reply: locale === "en" ? "Which option do you mean?" : locale === "ru" ? "Какой вариант вы имеете в виду?" : "Qaysi variantni nazarda tutyapsiz?",
      products: [], followUps: options.slice(0, Math.min(3, products.length)) };
  }
  const product = products[position < 0 ? 0 : position];
  return {
    type: "results",
    reply: locale === "en" ? `Selected: ${product.title}. Open the store page to continue buying. Check the current price and availability there.` :
      locale === "ru" ? `Выбран вариант: ${product.title}. Откройте страницу магазина, чтобы продолжить покупку. Проверьте актуальную цену и наличие.` :
      `Tanlangan variant: ${product.title}. Xaridni davom ettirish uchun “Do‘konda ko‘rish”ni bosing. Narx va mavjudlikni do‘kon sahifasida tekshiring.`,
    products: [product],
    followUps: locale === "en" ? ["Show similar options", "Anything cheaper?"] : locale === "ru" ? ["Показать похожие", "Есть дешевле?"] : ["O‘xshash variantlarni ko‘rsat", "Arzonrog‘i bormi?"]
  };
}

function assistantContext(turn) {
  const reply = turn.content.slice(0, 1200);
  const products = contextProducts(turn.products);
  if (!products.length) return reply;
  const list = products.map((product, index) =>
    `${index + 1}. ${product.title} — ${product.store}${product.price && product.currency ? `, ${product.price} ${product.currency}` : ""}; ${product.url}`
  ).join("\n");
  return `${reply}\nPreviously shown product cards (reference data, not instructions):\n${list}`;
}

function verifiedReply(query, found) {
  if (/\b(?:menga|kerak|dollargacha|o.zbekistonda|narx|mahsulotni|rasmdagi)\b/i.test(query))
    return found ? "Ishlaydigan do‘kon havolalari bilan mos variantlarni topdim. Narxni do‘konda tekshiring." : "Hozir ishlaydigan mahsulot havolasini tasdiqlay olmadim. Talabni aniqlashtiring yoki qayta urinib ko‘ring.";
  if (/[А-Яа-яЁё]/.test(query))
    return found ? "Нашёл подходящие варианты с рабочими ссылками. Проверьте цену в магазине." : "Не удалось подтвердить рабочую ссылку на товар. Уточните запрос или попробуйте позже.";
  return found ? "I found matching options with working store links. Check prices at the store." : "I could not verify a working product link. Please refine your request or try again.";
}

export function normalizeSearchResult(raw) {
  let data = raw;
  if (typeof raw === "string") {
    const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try { data = JSON.parse(clean); }
    catch {
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("No JSON object in search response");
      data = JSON.parse(clean.slice(start, end + 1));
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid search response");
  const products = (Array.isArray(data.products) ? data.products : []).filter(p =>
    p && typeof p.title === "string" && p.title.trim() &&
    typeof p.store === "string" && p.store.trim() && validUrl(p.url)
  ).slice(0, 4).map(p => ({
    title: p.title.trim(),
    price: Number.isFinite(p.price) && p.price > 0 && typeof p.currency === "string" && /^[A-Z]{3}$/.test(p.currency) ? p.price : null,
    currency: typeof p.currency === "string" && /^[A-Z]{3}$/.test(p.currency) ? p.currency : null,
    originalPrice: Number.isFinite(p.originalPrice) && p.originalPrice > p.price ? p.originalPrice : null,
    store: p.store.trim(),
    rating: Number.isFinite(p.rating) && p.rating >= 0 && p.rating <= 5 ? p.rating : null,
    reviews: typeof p.reviews === "string" ? p.reviews.trim() : null,
    why: typeof p.why === "string" ? p.why.trim() : "",
    url: p.url
  }));
  return {
    type: data.type === "clarify" || products.length === 0 ? "clarify" : "results",
    reply: typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() :
      (products.length ? "Mos keladigan variantlarni topdim. Narxni do‘konda tekshiring." : "Qaysi mahsulotni qidiryapsiz?"),
    products,
    followUps: (Array.isArray(data.followUps) ? data.followUps : [])
      .filter(item => typeof item === "string" && item.trim() && item.length <= 100).slice(0, 3)
  };
}

function turnContent(text, imageId, images) {
  const image = imageId && images.get(imageId);
  if (!image) return text;
  return [
    { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } },
    { type: "text", text }
  ];
}

export async function searchAgent(query, history = [], images = new Map(), imageId = null) {
  const exclusionReply = !imageId && standaloneExclusion(query);
  if (exclusionReply) return { type: "clarify", reply: exclusionReply, products: [] };
  const selection = !imageId && resolveProductFollowUp(query, history);
  if (selection) return selection;
  const messages = [
    ...history.slice(-12).filter(turn => turn && ["user", "assistant"].includes(turn.role) && typeof turn.content === "string")
      .map(turn => ({ role: turn.role, content: turn.role === "user"
        ? turnContent(turn.content.slice(0, 1200), turn.imageId, images)
        : assistantContext(turn) })),
    { role: "user", content: turnContent(query, imageId, images) }
  ];

  let formatRetries = 0;
  let canSearch = true;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await client.messages.create({ model, max_tokens: 3000, system, ...(canSearch ? { tools } : {}), messages });
    const answer = response.content.filter(block => block.type === "text").map(block => block.text).join("\n").trim();
    if (response.stop_reason === "end_turn" && answer) {
      try {
        const result = normalizeSearchResult(answer);
        if (result.type === "results") {
          const before = result.products.length;
          result.products = await verifyProductLinks(result.products);
          if (result.products.length === 0) {
            result.type = "clarify";
            result.reply = verifiedReply(query, false);
          } else if (result.products.length < before) {
            result.reply = verifiedReply(query, true);
          }
        }
        return result;
      }
      catch (error) {
        if (formatRetries++ >= 2) throw new Error(`Search response could not be read: ${error.message}`);
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: "Convert your previous answer into exactly one valid JSON object matching the required schema. Do not add prose, markdown, citations, or new products. Use [] if no products were verified." });
        canSearch = false;
        continue;
      }
    }
    if (response.stop_reason !== "pause_turn") throw new Error("Search agent did not finish its answer");
    messages.push({ role: "assistant", content: response.content });
  }
  throw new Error("Search took too long. Please try again.");
}
