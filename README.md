# TopAgent

TopAgent is a conversational product finder. The responsive web interface asks for missing details, keeps recent shopping context, shows a small set of relevant results, and compares selected products. Product links open the retailer's site. Prices and stock must be confirmed there before purchase.

## Current setup

- `frontend/index.html`: static, responsive interface deployed to Vercel
- `index.js`: Express API deployed to Render at `https://topsiagent.onrender.com`
- `search-agent.js`: Anthropic Claude with web search for product discovery
- `auth.js`, `supabase-chats.sql`: account sessions, saved chats, private image storage and 24-hour share links
- `checkout-agent.js`: older checkout API code; the current interface does not call this flow

## Local development

1. Run `npm install`.
2. Set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `CARD_ENCRYPT_SECRET` in your local environment. Set `PUBLIC_APP_URL` to the frontend's public origin. Keep keys on the server only.
3. Run `supabase-chats.sql` in the project's Supabase SQL Editor. It creates the account chat tables, private `chat-images` bucket, share records, and image cleanup queue.
4. Run `npm start` for the API.
5. Open `frontend/index.html` in a browser or serve `frontend/` with a static server.
6. Run `npm test` for the search and interface smoke tests. The browser test uses installed Chrome on Windows; set `TOPAGENT_BROWSER_PATH` to another Chrome or Chromium executable when needed.

The frontend points at the production Render API through its `BACKEND` constant. To use a local API, change that value locally before testing.

## Search response

`POST /api/search` accepts `{ "query": "...", "history": [{ "role": "user|assistant", "content": "..." }] }` and returns `{ "type": "clarify|results", "reply": "...", "products": [...] }`. A clarification has an empty product list. Product prices, ratings, and reviews are optional; the interface displays only supplied information.

For signed-in image searches, upload one JPEG, PNG, or WebP (up to 5 MB) with `POST /api/chats/:id/images` as multipart field `image`. Send the returned `image.id` and `chatId` in `/api/search`; preceding user turns may include their own `imageId`. The server verifies ownership and supplies private images to Claude. Save the user turn with `imageId` in the chat's `messages` array. Image bytes never go into chat JSON.

`POST /api/chats/:id/share` creates or returns a 24-hour read-only link. `DELETE /api/chats/:id/share` revokes active links. `GET /api/shared/:token` serves the latest chat messages to anyone with a valid link; shared images pass through `/api/shared/:token/images/:imageId` so revocation and expiry are checked on every request. Guest chats can share a text transcript, but need an account for a public link.

## Deployment

The repository is connected to Vercel for the frontend and Render for the API. Verify both services after pushing `main`, as their builds may finish at different times. The old GitHub Actions workflow is manual only and still contains a Railway setup; it is not the current deployment path.
Apply the Supabase SQL before releasing the API. Deploy the API before the frontend, then verify signed-in image search, image history, shared links, expiry and revocation on the public site.
