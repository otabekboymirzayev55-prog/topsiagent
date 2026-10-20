import { supabase } from "./supabase.js";

// ── Middleware: verify JWT from frontend ─────────────────────────────────────
export async function requireAuth(req, res, next) {
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
// ── Historical orders ────────────────────────────────────────────────────────
export async function getOrders(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });
  if (error) throw error;
  return data;
}
