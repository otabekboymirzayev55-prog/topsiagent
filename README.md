# TopAgent — AI Shopping Agent

AI agent that searches the web for products and completes purchases via browser automation.

## Stack
- **Frontend** — HTML/JS → Vercel
- **Backend** — Node.js + Express → Railway
- **AI** — Claude API (Sonnet for search, Opus for checkout vision)
- **Browser** — Playwright + Chromium
- **Auth & DB** — Supabase
- **CI/CD** — GitHub Actions

---

## Project Structure

```
topagent/
├── Dockerfile
├── railway.toml
├── .env.example
├── .github/workflows/deploy.yml
├── server/
│   ├── index.js
│   ├── search-agent.js
│   ├── checkout-agent.js
│   ├── auth.js
│   ├── supabase.js
│   └── package.json
└── frontend/
    ├── index.html
    └── vercel.json
```

---

## Deploy in 4 Steps

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "TopAgent v1"
git remote add origin https://github.com/YOUR_USERNAME/topagent.git
git push -u origin main
```

### Step 2 — Deploy backend to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Set these in Railway → Variables:
```
ANTHROPIC_API_KEY     = sk-ant-...
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = eyJ...
CARD_ENCRYPT_SECRET   = your-32-char-random-string
PORT                  = 3001
HEADLESS              = true
```

Copy your Railway URL (e.g. https://topagent-api.up.railway.app)

### Step 3 — Update frontend backend URL

In frontend/index.html change:
```js
const BACKEND = "https://topagent-api.up.railway.app";
```

### Step 4 — Deploy frontend to Vercel

```bash
npm install -g vercel
vercel login
vercel deploy ./frontend --prod
```

---

## CI/CD Setup (GitHub Actions)

Add these in GitHub → Settings → Secrets → Actions:

| Secret            | Where to get it                          |
|-------------------|------------------------------------------|
| RAILWAY_TOKEN     | Railway → Account → Tokens               |
| VERCEL_TOKEN      | Vercel → Settings → Tokens               |
| VERCEL_ORG_ID     | .vercel/project.json after first deploy  |
| VERCEL_PROJECT_ID | .vercel/project.json after first deploy  |
| BACKEND_URL       | Your Railway URL                         |

Every git push to main will:
1. Check code for syntax errors
2. Deploy backend to Railway
3. Deploy frontend to Vercel
4. Run health check smoke test

---

## Supabase Setup

1. Create project at supabase.com
2. Go to SQL Editor
3. Paste and run the SQL from server/supabase.js
4. Copy URL and service key to Railway env vars

---

## Local Dev

```bash
cd server
cp ../.env.example .env
npm install
npx playwright install chromium
npm run dev
```
