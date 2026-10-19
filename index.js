import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { checkoutAgent } from "./checkout-agent.js";
import { searchAgent } from "./search-agent.js";
import {
  requireAuth, upsertProfile, getProfile,
  saveCard, getDefaultCard, saveOrder, getOrders
} from "./auth.js";
import { supabase, createAuthClient } from "./supabase.js";
import { registerChatFeatureRoutes, validImageId, imageContentForSearch, validateChatImageRefs, deleteChatWithImages } from "./chat-features.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", revision: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || null }));

// ── Auth: Sign up ────────────────────────────────────────────────────────────
app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Email and password are required" });
  const { data, error } = await createAuthClient().auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// ── Auth: Sign in ────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Email and password are required" });
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

app.post("/api/auth/refresh", async (req, res) => {
  const refreshToken = req.body?.refresh_token;
  if (typeof refreshToken !== "string" || !refreshToken) return res.status(400).json({ error: "Refresh token is required" });
  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return res.status(401).json({ error: "Session expired" });
  res.json({ user: data.user, session: data.session });
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: { id: req.user.id, email: req.user.email } }));

function validChatMessages(messages) {
  return Array.isArray(messages) && messages.length <= 100 && messages.every(message =>
    message && ["user", "assistant"].includes(message.role) &&
    typeof message.content === "string" && message.content.length <= 5000 &&
    (!message.products || (Array.isArray(message.products) && message.products.length <= 4)) &&
    (message.imageId === undefined || (message.role === "user" && validImageId(message.imageId)))
  ) && JSON.stringify(messages).length <= 100000;
}

// The service key bypasses RLS, so every read and mutation is scoped to req.user.id.
app.get("/api/chats", requireAuth, async (req, res) => {
  const { data, error } = await supabase.from("chats").select("id,title,updated_at")
    .eq("user_id", req.user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ chats: data });
});

app.get("/api/chats/:id", requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Invalid chat id" });
  const { data, error } = await supabase.from("chats").select("id,title,messages,updated_at")
    .eq("id", req.params.id).eq("user_id", req.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Chat not found" });
  res.json({ chat: data });
});

app.post("/api/chats", requireAuth, async (req, res) => {
  const { title, messages } = req.body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 120 || !validChatMessages(messages))
    return res.status(400).json({ error: "Invalid chat" });
  if (messages.some(message => message.imageId)) return res.status(400).json({ error: "Upload images after creating the chat" });
  const { data, error } = await supabase.from("chats").insert({
    id: randomUUID(), user_id: req.user.id, title: title.trim(), messages
  }).select("id,title,messages,updated_at").single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ chat: data });
});

app.patch("/api/chats/:id", requireAuth, async (req, res) => {
  try {
  const { title, messages } = req.body || {};
  if (!validImageId(req.params.id) || (title === undefined && messages === undefined) ||
      (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 120)) ||
      (messages !== undefined && !validChatMessages(messages)))
    return res.status(400).json({ error: "Invalid chat" });
  if (messages !== undefined) {
    const validImages = await validateChatImageRefs(req.user.id, req.params.id, messages);
    if (!validImages) return res.status(400).json({ error: "Invalid image reference" });
  }
  const update = { updated_at: new Date().toISOString() };
  if (title !== undefined) update.title = title.trim();
  if (messages !== undefined) update.messages = messages;
  const { data, error } = await supabase.from("chats").update(update)
    .eq("id", req.params.id).eq("user_id", req.user.id).select("id,title,updated_at").maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Chat not found" });
  res.json({ chat: data });
  } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
});

app.delete("/api/chats/:id", requireAuth, async (req, res) => {
  if (!validImageId(req.params.id)) return res.status(400).json({ error: "Invalid chat id" });
  try { await deleteChatWithImages(req.user.id, req.params.id); res.json({ ok: true }); }
  catch (error) { res.status(error.status || 500).json({ error: error.message }); }
});

registerChatFeatureRoutes(app);

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
  const { query, history, chatId, imageId } = req.body || {};
  if (typeof query !== "string" || (!query.trim() && !imageId) || query.length > 1000)
    return res.status(400).json({ error: "A query of up to 1000 characters is required" });
  try {
    const context = Array.isArray(history) ? history.slice(-8) : [];
    const images = await imageContentForSearch(req, chatId, imageId, context);
    const text = query.trim() || "Shu rasmdagi mahsulotni yoki unga o‘xshash variantlarni top.";
    const result = await searchAgent(text, context, images, imageId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
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
