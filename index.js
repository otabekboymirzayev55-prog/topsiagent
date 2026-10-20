import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { searchAgent } from "./search-agent.js";
import {
  requireAuth, upsertProfile, getProfile, getOrders
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
    if (req.body?.card) return res.status(400).json({ error: "Card details are not accepted. Use a supported payment provider when available." });
    await upsertProfile(req.user.id, req.body.profile);
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
    const context = Array.isArray(history) ? history.slice(-12) : [];
    const images = await imageContentForSearch(req, chatId, imageId, context);
    const text = query.trim() || "Shu rasmdagi mahsulotni yoki unga o‘xshash variantlarni top.";
    const result = await searchAgent(text, context, images, imageId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Only a retailer-authorized order integration may enable automatic checkout.
// The legacy browser agent sent raw card credentials to an LLM; never use it.
app.get("/api/checkout/options", (_req, res) => res.json({
  automatic: { available: false, retailer: "Uzum Market", reason: "Uzum Market xaridor buyurtmasi integratsiyasi hali ulanmagan." },
  storeCheckout: true,
}));

app.post("/api/checkout", requireAuth, (_req, res) => res.status(503).json({
  code: "CHECKOUT_NOT_CONFIGURED",
  error: "Top orqali avtomatik xarid hozircha mavjud emas. Mahsulotni do‘kon sahifasida xarid qilishingiz mumkin.",
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`TopAgent server → http://localhost:${PORT}`));
