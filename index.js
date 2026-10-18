import express from "express";
import cors from "cors";
import { checkoutAgent } from "./checkout-agent.js";
import { searchAgent } from "./search-agent.js";
import {
  requireAuth, upsertProfile, getProfile,
  saveCard, getDefaultCard, saveOrder, getOrders
} from "./auth.js";
import { supabase } from "./supabase.js";

const app = express();
app.use(cors());
app.use(express.json());

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", revision: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || null }));

// ── Auth: Sign up ────────────────────────────────────────────────────────────
app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// ── Auth: Sign in ────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// ── Profile: save ────────────────────────────────────────────────────────────
app.post("/api/profile", requireAuth, async (req, res) => {
  try {
    await upsertProfile(req.user.id, req.body.profile);
    if (req.body.card) await saveCard(req.user.id, req.body.card);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Profile: get ─────────────────────────────────────────────────────────────
app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Orders: list ─────────────────────────────────────────────────────────────
app.get("/api/orders", requireAuth, async (req, res) => {
  try {
    const orders = await getOrders(req.user.id);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Search ───────────────────────────────────────────────────────────────────
app.post("/api/search", async (req, res) => {
  const { query, history } = req.body || {};
  if (typeof query !== "string" || !query.trim() || query.length > 1000)
    return res.status(400).json({ error: "A query of up to 1000 characters is required" });
  try {
    const result = await searchAgent(query.trim(), Array.isArray(history) ? history : []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Checkout (SSE stream) ─────────────────────────────────────────────────────
app.post("/api/checkout", requireAuth, async (req, res) => {
  const { product } = req.body;
  if (!product?.url) return res.status(400).json({ error: "product.url required" });

  // Load user's saved profile + decrypted card from Supabase
  let userProfile, cardData;
  try {
    userProfile = await getProfile(req.user.id);
    cardData    = await getDefaultCard(req.user.id);
  } catch (err) {
    return res.status(400).json({ error: "No profile/card on file. Please save your details first." });
  }

  // Merge profile + card into one object for the agent
  const fullProfile = {
    firstName:  userProfile.first_name,
    lastName:   userProfile.last_name,
    email:      userProfile.email,
    phone:      userProfile.phone,
    address:    userProfile.address,
    city:       userProfile.city,
    state:      userProfile.state,
    zip:        userProfile.zip,
    country:    userProfile.country,
    cardNumber: cardData?.number,
    cardExpiry: cardData?.expiry,
    cardCvv:    cardData?.cvv,
  };

  // SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const emit = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const result = await checkoutAgent({ product, userProfile: fullProfile, emit });

    // Save order to Supabase
    const order = await saveOrder(req.user.id, {
      product,
      orderRef: result.orderId,
    });

    emit("done", { success: true, orderId: result.orderId, dbOrderId: order.id });
  } catch (err) {
    console.error("[checkout]", err.message);
    emit("error", { message: err.message });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TopAgent server → http://localhost:${PORT}`));
