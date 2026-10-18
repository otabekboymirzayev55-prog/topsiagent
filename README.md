# TopAgent

TopAgent is a conversational product finder. The responsive web interface asks for missing details, keeps recent shopping context, shows a small set of relevant results, and compares selected products. Product links open the retailer's site. Prices and stock must be confirmed there before purchase.

## Current setup

- `frontend/index.html`: static, responsive interface deployed to Vercel
- `index.js`: Express API deployed to Render at `https://topsiagent.onrender.com`
- `search-agent.js`: Anthropic Claude with web search for product discovery
- `auth.js`, `checkout-agent.js`: older account and checkout API code; the current interface does not call these flows

## Local development

1. Run `npm install`.
2. Set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `CARD_ENCRYPT_SECRET` in your local environment. Keep keys on the server only.
3. Run `npm start` for the API.
4. Open `frontend/index.html` in a browser or serve `frontend/` with a static server.
5. Run `npm test` for the search and interface smoke tests. The browser test uses installed Chrome on Windows; set `TOPAGENT_BROWSER_PATH` to another Chrome or Chromium executable when needed.

The frontend points at the production Render API through its `BACKEND` constant. To use a local API, change that value locally before testing.

## Search response

`POST /api/search` accepts `{ "query": "...", "history": [{ "role": "user|assistant", "content": "..." }] }` and returns `{ "type": "clarify|results", "reply": "...", "products": [...] }`. A clarification has an empty product list. Product prices, ratings, and reviews are optional; the interface displays only supplied information.

## Deployment

The repository is connected to Vercel for the frontend and Render for the API. Verify both services after pushing `main`, as their builds may finish at different times. The old GitHub Actions workflow is manual only and still contains a Railway setup; it is not the current deployment path.
