import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const model = "claude-sonnet-4-6";
const tools = [{ type: "web_search_20250305", name: "web_search" }];

const system = `You are TopAgent, a careful multilingual shopping assistant.
Reply in the language of the user's latest message (Uzbek, Russian, English, etc.). Use prior turns only to understand follow-up requests. Respect all positive and negative constraints, especially product category, budget, country, brand and explicit exclusions. A statement like "menga iPad kerak emas" means the user does NOT want an iPad; ask what they want instead. If shopping intent or a critical requirement is unclear, ask one concise clarifying question and DO NOT search or recommend products.

When the request is clear, use web search for current, direct product pages. Return 1 to 4 genuinely relevant products, never pad the list. Do not recommend accessories when the user asks for the main device. Do not invent prices, discounts, ratings, review counts, availability, URLs, or delivery dates. Omit uncertain fields. Treat a source's price as indicative; it can change at checkout. If no relevant product can be verified, return an empty list and explain this.

Your final answer MUST be a single JSON object, without markdown:
{"type":"clarify"|"results","reply":"short helpful message in user's language","products":[{"title":"exact product name","price":number|null,"currency":"USD or source currency","originalPrice":number|null,"store":"retailer","rating":number|null,"reviews":string|null,"why":"specific reason this matches","url":"direct https product URL"}]}
For clarify, products must be []. For results, include only products actually supported by search results. Reply should not claim certainty about stock or price.`;

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch { return false; }
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

export function normalizeSearchResult(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) : raw;
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
    products
  };
}

export async function searchAgent(query, history = []) {
  const exclusionReply = standaloneExclusion(query);
  if (exclusionReply) return { type: "clarify", reply: exclusionReply, products: [] };
  const messages = [
    ...history.slice(-8).filter(turn => turn && ["user", "assistant"].includes(turn.role) && typeof turn.content === "string")
      .map(turn => ({ role: turn.role, content: turn.content.slice(0, 1200) })),
    { role: "user", content: query }
  ];

  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await client.messages.create({ model, max_tokens: 3000, system, tools, messages });
    const answer = response.content.filter(block => block.type === "text").map(block => block.text).join("\n").trim();
    if (response.stop_reason === "end_turn" && answer) {
      try { return normalizeSearchResult(answer); }
      catch (error) { throw new Error(`Search response could not be read: ${error.message}`); }
    }
    if (response.stop_reason !== "pause_turn") throw new Error("Search agent did not finish its answer");
    messages.push({ role: "assistant", content: response.content });
  }
  throw new Error("Search took too long. Please try again.");
}
