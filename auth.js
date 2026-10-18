import { supabase } from "./supabase.js";

const CARD_SECRET = process.env.CARD_ENCRYPT_SECRET; // min 32 chars random string

// ── Middleware: verify JWT from frontend ─────────────────────────────────────
export async function requireAuth(req, res, next) {
  if (!supabase) return res.status(503).json({ error: "Authentication is not configured yet" });
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  req.user = user;
  next();
}

// ── Profile ──────────────────────────────────────────────────────────────────
export async function upsertProfile(userId, profile) {
  const { error } = await supabase.from("profiles").upsert({
    id:         userId,
    first_name: profile.firstName,
    last_name:  profile.lastName,
    email:      profile.email,
    phone:      profile.phone,
    address:    profile.address,
    city:       profile.city,
    state:      profile.state,
    zip:        profile.zip,
    country:    profile.country || "US",
  });
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Cards (pgcrypto encrypted) ───────────────────────────────────────────────
export async function saveCard(userId, card) {
  // Encrypt card JSON using pgcrypto pgp_sym_encrypt via RPC
  const cardJson = JSON.stringify({
    number: card.cardNumber,
    expiry: card.cardExpiry,
    cvv:    card.cardCvv,
  });

  const { data, error } = await supabase.rpc("save_encrypted_card", {
    p_user_id:    userId,
    p_card_json:  cardJson,
    p_card_label: maskCard(card.cardNumber),
    p_secret:     CARD_SECRET,
    p_is_default: true,
  });
  if (error) throw error;
  return data;
}

export async function getDefaultCard(userId) {
  const { data, error } = await supabase.rpc("get_default_card", {
    p_user_id: userId,
    p_secret:  CARD_SECRET,
  });
  if (error) throw error;
  return data ? JSON.parse(data) : null;
}

function maskCard(number) {
  const clean = number.replace(/\s/g, "");
  const brand = clean.startsWith("4") ? "Visa"
    : clean.startsWith("5") ? "Mastercard"
    : clean.startsWith("3") ? "Amex" : "Card";
  return `${brand} ending ${clean.slice(-4)}`;
}

// ── Orders ───────────────────────────────────────────────────────────────────
export async function saveOrder(userId, { product, orderRef }) {
  const { data, error } = await supabase.from("orders").insert({
    user_id:       userId,
    product_title: product.title,
    product_store: product.store,
    product_url:   product.url,
    price:         product.price,
    order_ref:     orderRef,
    status:        "placed",
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getOrders(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Add these two RPC functions in Supabase → SQL Editor:
 *
 * create or replace function save_encrypted_card(
 *   p_user_id uuid, p_card_json text, p_card_label text,
 *   p_secret text, p_is_default boolean
 * ) returns void language plpgsql security definer as $$
 * begin
 *   update public.payment_cards set is_default = false where user_id = p_user_id;
 *   insert into public.payment_cards (user_id, card_label, card_enc, is_default)
 *   values (p_user_id, p_card_label, pgp_sym_encrypt(p_card_json, p_secret)::bytea, p_is_default);
 * end; $$;
 *
 * create or replace function get_default_card(p_user_id uuid, p_secret text)
 * returns text language plpgsql security definer as $$
 * declare result text;
 * begin
 *   select pgp_sym_decrypt(card_enc, p_secret) into result
 *   from public.payment_cards
 *   where user_id = p_user_id and is_default = true
 *   limit 1;
 *   return result;
 * end; $$;
 */
