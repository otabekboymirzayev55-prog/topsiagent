import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a shopping AI agent with web search access.
Search the web to find REAL, currently available products matching the user's request.
After searching, respond with ONLY a valid JSON array (no markdown, no backticks, no explanation) of exactly 4 products.

Each object must have:
- title: string  (exact real product name with brand and model)
- price: number  (real current USD price)
- originalPrice: number or null  (original price if on sale, else null)
- store: string  (Amazon | Walmart | Best Buy | Target | eBay | etc.)
- rating: number (real rating 3.5–5.0)
- reviews: string (e.g. "2,341")
- why: string    (1 sentence: why this matches the request, citing a real spec)
- url: string    (real direct product URL — must be the actual page, not a search page)

Order by best value first. Return ONLY the JSON array.`;

export async function searchAgent(query) {
  const messages = [{
    role: "user",
    content: `Search the web and find the best real products currently available for: "${query}". Return JSON array only.`
  }];

  const tools = [{ type: "web_search_20250305", name: "web_search" }];

  let iterations = 0;

  while (iterations < 10) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM,
      tools,
      messages
    });

    const textBlocks = res.content.filter(b => b.type === "text");

    // Final answer
    if (res.stop_reason === "end_turn" && textBlocks.length > 0) {
      const raw = textBlocks.map(b => b.text).join("");
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    }

    // Tool use — continue loop
    if (res.stop_reason === "tool_use" || res.content.some(b => b.type === "tool_use")) {
      messages.push({ role: "assistant", content: res.content });

      const toolUseBlocks  = res.content.filter(b => b.type === "tool_use");
      const webResultBlocks = res.content.filter(b => b.type === "web_search_result");

      const toolResults = toolUseBlocks.map(b => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: webResultBlocks.length
          ? webResultBlocks.map(r => ({ type: "text", text: JSON.stringify(r) }))
          : [{ type: "text", text: "Search executed." }]
      }));

      messages.push({ role: "user", content: toolResults });
      iterations++;
      continue;
    }

    // Text in tool_use response
    if (textBlocks.length > 0) {
      const raw = textBlocks.map(b => b.text).join("");
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    }

    iterations++;
  }

  throw new Error("Search agent exceeded max iterations");
}
