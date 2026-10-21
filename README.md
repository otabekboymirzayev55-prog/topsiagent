# TopAgent

TopAgent is a conversational product finder. The responsive web interface asks for missing details, keeps recent shopping context, shows a small set of relevant results, and compares selected products. Product links open the retailer's site. Prices and stock must be confirmed there before purchase.

## Current setup

- `frontend/index.html`: static, responsive interface deployed to Vercel
- `index.js`: Express API deployed to Render at `https://topsiagent.onrender.com`
- `search-agent.js`: Anthropic Claude with web search by default; optional Gemini + SerpApi pilot in `gemini-search.js`
- `auth.js`, `supabase-chats.sql`: account sessions, saved chats, private image storage and 24-hour share links
- Guest chats stay in the current page only. Signing in saves that visit's chats to the account; leaving or reloading the page clears guest history, including browser-stored guest chats from older releases.
- Purchase options show both Top and retailer paths. Retailer links work now; Top automatic checkout remains unavailable until an authorized buyer-order integration is connected.

## Local development

1. Run `npm install`.
2. Set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` in your local environment. Set `PUBLIC_APP_URL` to the frontend's public origin. Keep keys on the server only.
   In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://topagent-frontend.vercel.app/` and add that exact URL under **Redirect URLs**. The signup and resend endpoints use `PUBLIC_APP_URL` as the email confirmation return URL. Old confirmation links cannot be repaired; send a fresh one from the sign-in dialog after correcting these settings.
3. Run `supabase-chats.sql` in the project's Supabase SQL Editor. It creates the account chat tables, private `chat-images` bucket, share records, and image cleanup queue.
4. Run `npm start` for the API.
5. Open `frontend/index.html` in a browser or serve `frontend/` with a static server.
6. Run `npm test` for the search and interface smoke tests. The browser test uses installed Chrome on Windows; set `TOPAGENT_BROWSER_PATH` to another Chrome or Chromium executable when needed.

## Gemini search pilot

Leave `SEARCH_PROVIDER` unset for the current Claude path. For the pilot, set `SEARCH_PROVIDER=gemini`, `GEMINI_API_KEY` and `SERPAPI_API_KEY` on the backend only. Gemini 2.5 Flash-Lite interprets the conversation and attached image; SerpApi retrieves retailer pages. `GEMINI_MODEL` can override the default after evaluation. Gemini selects source IDs, while the server supplies actual URLs and only structured source prices. Missing or unverifiable links become a clarification instead of a fabricated product card.

`node scripts/evaluate-search.mjs` runs 25 public shopping questions against `TOP_API_URL` (defaults to the Render API) and prints compact results. Review relevance, language and product links manually. It cannot compare live Claude quality while Anthropic credits are exhausted. Free-tier Gemini requests may be used by Google to improve its services, so use only nonsensitive test prompts until a paid Google project is configured.

The frontend points at the production Render API through its `BACKEND` constant. To use a local API, change that value locally before testing.

## Purchase options

Each product offers **Top orqali xarid** and **Do‘konda xarid qilish**. The Top option is visibly unavailable until Uzum Market grants a buyer-order integration and the server can verify a current total, delivery terms, payment authorization, and a confirmed retailer order. `GET /api/checkout/options` reports this state; `POST /api/checkout` returns `503` and never charges a card. The old browser checkout agent, which passed raw card data and CVV into an AI prompt and could report a fabricated order ID, has been removed. `POST /api/profile` rejects card data. Never send card numbers or CVV to this API or a model. Use a payment provider's tokenized flow after the retailer order integration exists.

Uzum's [seller API](https://api-seller.uzum.uz/api/seller-openapi/swagger/swagger-ui/webjars/swagger-ui/index.html) manages seller orders and inventory; [Uzum Bank Checkout](https://developer.uzumbank.uz/en/) accepts payments for a merchant. Neither public document establishes a buyer checkout integration for third-party Uzum Market listings. The next external step is to obtain that integration from Uzum Market, then implement and test the purchase flow in their sandbox before enabling Top checkout.

## Search response

`POST /api/search` accepts `{ "query": "...", "history": [{ "role": "user|assistant", "content": "..." }] }` and returns `{ "type": "clarify|results", "reply": "...", "products": [...] }`. A clarification has an empty product list. Product prices, ratings, and reviews are optional; the interface displays only supplied information.

For signed-in image searches, upload one JPEG, PNG, or WebP (up to 5 MB) with `POST /api/chats/:id/images` as multipart field `image`. Send the returned `image.id` and `chatId` in `/api/search`; preceding user turns may include their own `imageId`. The server verifies ownership and supplies private images to Claude. Save the user turn with `imageId` in the chat's `messages` array. Image bytes never go into chat JSON.

`POST /api/chats/:id/share` creates or returns a 24-hour read-only link. `DELETE /api/chats/:id/share` revokes active links. `GET /api/shared/:token` serves the latest chat messages to anyone with a valid link; shared images pass through `/api/shared/:token/images/:imageId` so revocation and expiry are checked on every request. Guest chats can share a text transcript, but need an account for a public link.

## Deployment

The repository is connected to Vercel for the frontend and Render for the API. Verify both services after pushing `main`, as their builds may finish at different times. The old GitHub Actions workflow is manual only and still contains a Railway setup; it is not the current deployment path.
Apply the Supabase SQL before releasing the API. Deploy the API before the frontend, then verify signed-in image search, image history, shared links, expiry and revocation on the public site.
