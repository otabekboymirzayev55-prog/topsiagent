import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import { supabase } from "./supabase.js";
import { requireAuth } from "./auth.js";

const bucket = "chat-images";
const imageLimit = 5 * 1024 * 1024;
const day = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: imageLimit, files: 1 } }).single("image");

export function validImageId(value) { return typeof value === "string" && uuid.test(value); }
function fail(status, message) { return Object.assign(new Error(message), { status }); }
function sendError(res, error) { res.status(error.status || 500).json({ error: error.message }); }

export async function normalizeImage(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > imageLimit) throw fail(413, "Image must be at most 5 MB");
  let metadata;
  try { metadata = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata(); }
  catch { throw fail(400, "Invalid image file"); }
  const types = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  if (!types[metadata.format] || mimeType !== types[metadata.format])
    throw fail(400, "Use a JPEG, PNG or WebP image");
  try {
    const output = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    if (output.length > imageLimit) throw fail(413, "Image is too large");
    return output;
  } catch (error) { throw error.status ? error : fail(400, "Invalid image file"); }
}

async function ownedChat(userId, chatId) {
  if (!validImageId(chatId)) throw fail(400, "Invalid chat id");
  const { data, error } = await supabase.from("chats").select("id")
    .eq("id", chatId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(404, "Chat not found");
  return data;
}

async function getShare(token) {
  if (!validImageId(token)) throw fail(404, "Shared chat not found");
  const { data, error } = await supabase.from("chat_shares")
    .select("chat_id,user_id,expires_at").eq("id", token).is("revoked_at", null)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(404, "Shared chat not found");
  return data;
}

async function imageRow(imageId, chatId, userId) {
  if (!validImageId(imageId)) throw fail(404, "Image not found");
  const { data, error } = await supabase.from("chat_images")
    .select("id,object_path,mime_type").eq("id", imageId).eq("chat_id", chatId)
    .eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(404, "Image not found");
  return data;
}

async function imageBuffer(row) {
  const { data, error } = await supabase.storage.from(bucket).download(row.object_path);
  if (error || !data) throw error || fail(404, "Image not found");
  return Buffer.from(await data.arrayBuffer());
}

async function deliverImage(res, row) {
  const bytes = await imageBuffer(row);
  res.set("Cache-Control", "private, no-store");
  res.type(row.mime_type).send(bytes);
}

export async function validateChatImageRefs(userId, chatId, messages) {
  const ids = [...new Set(messages.map(message => message.imageId).filter(Boolean))];
  if (!ids.length) return true;
  if (ids.some(id => !validImageId(id))) return false;
  const { data, error } = await supabase.from("chat_images").select("id")
    .eq("user_id", userId).eq("chat_id", chatId).in("id", ids);
  if (error) throw error;
  return data.length === ids.length;
}

export async function imageContentForSearch(req, chatId, imageId, history) {
  const referenced = [...new Set([...history.map(turn => turn?.imageId), imageId].filter(Boolean))];
  if (!referenced.length) return new Map();
  if (referenced.some(id => !validImageId(id)) || !validImageId(chatId))
    throw fail(400, "Invalid image reference");
  const ids = referenced.slice(-4);
  const token = req.headers.authorization?.replace(/^Bearer /i, "");
  if (!token) throw fail(401, "Sign in required for image search");
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth?.user) throw fail(401, "Invalid session");
  await ownedChat(auth.user.id, chatId);
  const { data, error } = await supabase.from("chat_images").select("id,object_path,mime_type")
    .eq("chat_id", chatId).eq("user_id", auth.user.id).in("id", ids);
  if (error) throw error;
  if (data.length !== ids.length) throw fail(403, "Image does not belong to this chat");
  const images = new Map();
  for (const row of data) images.set(row.id, { mimeType: row.mime_type, data: (await imageBuffer(row)).toString("base64") });
  return images;
}

async function cleanDeletedImages() {
  const { data: jobs, error } = await supabase.from("chat_image_cleanup")
    .select("id,chat_id,object_paths").order("created_at", { ascending: true }).limit(20);
  if (error) { console.error("[image cleanup]", error.message); return; }
  for (const job of jobs) {
    const { data: chat, error: chatError } = await supabase.from("chats").select("id").eq("id", job.chat_id).maybeSingle();
    if (chatError) { console.error("[image cleanup]", chatError.message); continue; }
    if (chat) continue;
    const { error: removeError } = await supabase.storage.from(bucket).remove(job.object_paths);
    if (removeError) { console.error("[image cleanup]", removeError.message); continue; }
    await supabase.from("chat_image_cleanup").delete().eq("id", job.id);
  }
}

export async function deleteChatWithImages(userId, chatId) {
  await ownedChat(userId, chatId);
  const { data: images, error: imageError } = await supabase.from("chat_images")
    .select("object_path").eq("chat_id", chatId).eq("user_id", userId);
  if (imageError) throw imageError;
  let jobId = null;
  if (images.length) {
    jobId = randomUUID();
    const { error } = await supabase.from("chat_image_cleanup").insert({
      id: jobId, chat_id: chatId, object_paths: images.map(image => image.object_path)
    });
    if (error) throw error;
  }
  const { data, error } = await supabase.from("chats").delete()
    .eq("id", chatId).eq("user_id", userId).select("id").maybeSingle();
  if (error || !data) {
    if (jobId) await supabase.from("chat_image_cleanup").delete().eq("id", jobId);
    throw error || fail(404, "Chat not found");
  }
  if (jobId) await cleanDeletedImages();
}

export function registerChatFeatureRoutes(app) {
  app.post("/api/chats/:id/images", requireAuth, (req, res) => {
    upload(req, res, async error => {
      if (error) return sendError(res, fail(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "Image must be at most 5 MB"));
      try {
        await ownedChat(req.user.id, req.params.id);
        if (!req.file) throw fail(400, "Select an image");
        const bytes = await normalizeImage(req.file.buffer, req.file.mimetype);
        const id = randomUUID();
        const objectPath = `${req.user.id}/${req.params.id}/${id}.webp`;
        const stored = await supabase.storage.from(bucket).upload(objectPath, bytes, { contentType: "image/webp", upsert: false });
        if (stored.error) throw stored.error;
        const { error: insertError } = await supabase.from("chat_images").insert({
          id, chat_id: req.params.id, user_id: req.user.id, object_path: objectPath,
          mime_type: "image/webp", byte_size: bytes.length
        });
        if (insertError) {
          await supabase.storage.from(bucket).remove([objectPath]);
          throw insertError;
        }
        res.status(201).json({ image: { id, mimeType: "image/webp" } });
      } catch (err) { sendError(res, err); }
    });
  });

  app.get("/api/chats/:id/images/:imageId", requireAuth, async (req, res) => {
    try { await ownedChat(req.user.id, req.params.id); await deliverImage(res, await imageRow(req.params.imageId, req.params.id, req.user.id)); }
    catch (error) { sendError(res, error); }
  });

  app.post("/api/chats/:id/share", requireAuth, async (req, res) => {
    try {
      await ownedChat(req.user.id, req.params.id);
      const { data: existing, error: findError } = await supabase.from("chat_shares")
        .select("id,expires_at").eq("chat_id", req.params.id).eq("user_id", req.user.id)
        .is("revoked_at", null).gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (findError) throw findError;
      let share = existing;
      if (!share) {
        const { data, error } = await supabase.from("chat_shares").insert({
          id: randomUUID(), chat_id: req.params.id, user_id: req.user.id,
          expires_at: new Date(Date.now() + day).toISOString()
        }).select("id,expires_at").single();
        if (error) throw error;
        share = data;
      }
      const url = new URL(process.env.PUBLIC_APP_URL || "https://topagent-frontend.vercel.app/");
      url.searchParams.set("share", share.id);
      res.set("Cache-Control", "no-store").json({ url: url.href, expiresAt: share.expires_at });
    } catch (error) { sendError(res, error); }
  });

  app.delete("/api/chats/:id/share", requireAuth, async (req, res) => {
    try {
      await ownedChat(req.user.id, req.params.id);
      const { error } = await supabase.from("chat_shares").update({ revoked_at: new Date().toISOString() })
        .eq("chat_id", req.params.id).eq("user_id", req.user.id).is("revoked_at", null);
      if (error) throw error;
      res.json({ ok: true });
    } catch (error) { sendError(res, error); }
  });

  app.get("/api/shared/:token", async (req, res) => {
    try {
      const share = await getShare(req.params.token);
      const { data, error } = await supabase.from("chats").select("id,title,messages,updated_at")
        .eq("id", share.chat_id).eq("user_id", share.user_id).maybeSingle();
      if (error) throw error;
      if (!data) throw fail(404, "Shared chat not found");
      res.set("Cache-Control", "private, no-store").json({ chat: data, expiresAt: share.expires_at });
    } catch (error) { sendError(res, error); }
  });

  app.get("/api/shared/:token/images/:imageId", async (req, res) => {
    try {
      const share = await getShare(req.params.token);
      await ownedChat(share.user_id, share.chat_id);
      await deliverImage(res, await imageRow(req.params.imageId, share.chat_id, share.user_id));
    } catch (error) { sendError(res, error); }
  });

  setTimeout(cleanDeletedImages, 10_000).unref();
  setInterval(cleanDeletedImages, 15 * 60 * 1000).unref();
}
