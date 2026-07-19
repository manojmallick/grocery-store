import { promises as fs } from "node:fs";
import path from "node:path";
import { Router, raw } from "express";
import { requireAdmin } from "./auth.js";
import { newId, UPLOADS_DIR } from "./store.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const media = Router();

/** Admin image upload: raw body, content-type decides the extension. */
media.post(
  "/admin/media",
  requireAdmin,
  raw({ type: Object.keys(EXT_BY_MIME), limit: "10mb" }),
  async (req, res) => {
    const ext = EXT_BY_MIME[req.headers["content-type"] ?? ""];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Send an image body (png/jpg/gif/webp/svg)" });
      return;
    }
    const file = `${newId()}.${ext}`;
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, file), req.body);
    res.status(201).json({ url: `/api/media/${file}` });
  },
);

media.get("/media/:file", async (req, res) => {
  const file = req.params.file;
  // Server-generated names only — rejects traversal.
  if (!/^[0-9a-f-]+\.(png|jpg|gif|webp|svg)$/.test(file)) {
    res.status(404).end();
    return;
  }
  try {
    const buffer = await fs.readFile(path.join(UPLOADS_DIR, file));
    const ext = file.split(".").pop()!;
    const mime =
      Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch {
    res.status(404).end();
  }
});
