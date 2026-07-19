import { Router } from "express";
import {
  checkPassword,
  COOKIE_NAME,
  createSessionToken,
  isValidSession,
  requireAdmin,
  sessionFromRequest,
} from "./auth.js";
import { getDb, localized, makeExcerpt, newId, slugify, withDb, type Page, type Post, type Translation } from "./store.js";

export const api = Router();

/* ---------- public ---------- */

api.get("/settings", async (_req, res) => {
  res.json((await getDb()).settings);
});

api.get("/home", async (_req, res) => {
  res.json((await getDb()).home);
});

api.get("/pages", async (_req, res) => {
  const db = await getDb();
  res.json(
    db.pages.map(({ id, slug, title, showInNav }) => ({ id, slug, title, showInNav })),
  );
});

api.get("/pages/:slug", async (req, res) => {
  const db = await getDb();
  const page = db.pages.find((p) => p.slug === req.params.slug);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(localized(page, String(req.query.lang ?? ""), db.settings.defaultLocale));
});

api.get("/posts", async (req, res) => {
  const db = await getDb();
  const lang = String(req.query.lang ?? "");
  const posts = db.posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .map((p) => localized(p, lang, db.settings.defaultLocale))
    .map(({ content: _content, translations: _t, ...rest }) => rest);
  res.json(posts);
});

api.get("/posts/:slug", async (req, res) => {
  const db = await getDb();
  const post = db.posts.find((p) => p.slug === req.params.slug && p.status === "published");
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(localized(post, String(req.query.lang ?? ""), db.settings.defaultLocale));
});

/* ---------- auth ---------- */

api.post("/auth/login", (req, res) => {
  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || !checkPassword(password)) {
    res.status(401).json({ error: "Wrong password" });
    return;
  }
  const token = createSessionToken();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`,
  );
  res.json({ ok: true });
});

api.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  res.json({ ok: true });
});

api.get("/auth/me", (req, res) => {
  res.json({ authenticated: isValidSession(sessionFromRequest(req)) });
});


function cleanTranslations(input: unknown): Record<string, Translation> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, Translation> = {};
  for (const [locale, value] of Object.entries(input as Record<string, Translation>)) {
    if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(locale) || !value || typeof value !== "object") continue;
    const t: Translation = {};
    if (typeof value.title === "string" && value.title.trim()) t.title = value.title.trim();
    if (typeof value.content === "string" && value.content.trim()) t.content = value.content;
    if (typeof value.metaDescription === "string" && value.metaDescription.trim()) {
      t.metaDescription = value.metaDescription.trim();
    }
    if (Object.keys(t).length) out[locale] = t;
  }
  return Object.keys(out).length ? out : undefined;
}

/* ---------- admin ---------- */

api.get("/admin/posts", requireAdmin, async (_req, res) => {
  const db = await getDb();
  res.json([...db.posts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
});

api.post("/admin/posts", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Partial<Post>;
  if (!body.title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const now = new Date().toISOString();
  const post = await withDb((db) => {
    const base = slugify(body.slug?.trim() || body.title!.trim());
    let slug = base;
    for (let n = 2; db.posts.some((p) => p.slug === slug); n += 1) slug = `${base}-${n}`;
    const created: Post = {
      id: newId(),
      slug,
      title: body.title!.trim(),
      content: body.content ?? "",
      excerpt: body.excerpt?.trim() || makeExcerpt(body.content ?? ""),
      metaDescription: body.metaDescription?.trim() || undefined,
      coverImage: body.coverImage?.trim() || undefined,
      author: body.author?.trim() || undefined,
      featured: body.featured === true,
      translations: cleanTranslations(body.translations),
      tags: (body.tags ?? []).map((t) => String(t).trim()).filter(Boolean),
      status: body.status === "published" ? "published" : "draft",
      createdAt: now,
      updatedAt: now,
      publishedAt: body.status === "published" ? now : undefined,
    };
    db.posts.push(created);
    return created;
  });
  res.status(201).json(post);
});

api.put("/admin/posts/:id", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Partial<Post>;
  const updated = await withDb((db) => {
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return null;
    if (body.title?.trim()) post.title = body.title.trim();
    if (body.slug?.trim()) {
      const base = slugify(body.slug);
      if (!db.posts.some((p) => p.slug === base && p.id !== post.id)) post.slug = base;
    }
    if (typeof body.content === "string") {
      post.content = body.content;
      post.excerpt = body.excerpt?.trim() || makeExcerpt(body.content);
    }
    if (Array.isArray(body.tags)) {
      post.tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof body.metaDescription === "string") {
      post.metaDescription = body.metaDescription.trim() || undefined;
    }
    if (typeof body.coverImage === "string") {
      post.coverImage = body.coverImage.trim() || undefined;
    }
    if (typeof body.author === "string") {
      post.author = body.author.trim() || undefined;
    }
    if (typeof body.featured === "boolean") post.featured = body.featured;
    if (body.translations !== undefined) post.translations = cleanTranslations(body.translations);
    if (body.status === "published" && post.status !== "published") {
      post.status = "published";
      post.publishedAt = new Date().toISOString();
    } else if (body.status === "draft") {
      post.status = "draft";
    }
    post.updatedAt = new Date().toISOString();
    return post;
  });
  if (!updated) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(updated);
});

api.delete("/admin/posts/:id", requireAdmin, async (req, res) => {
  const removed = await withDb((db) => {
    const idx = db.posts.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return false;
    db.posts.splice(idx, 1);
    return true;
  });
  if (!removed) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json({ ok: true });
});

/* ---------- admin: pages ---------- */

api.post("/admin/pages", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Partial<Page>;
  if (!body.title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const now = new Date().toISOString();
  const page = await withDb((db) => {
    const base = slugify(body.slug?.trim() || body.title!.trim());
    let slug = base;
    for (let n = 2; db.pages.some((p) => p.slug === slug); n += 1) slug = `${base}-${n}`;
    const created: Page = {
      id: newId(),
      slug,
      title: body.title!.trim(),
      content: body.content ?? "",
      metaDescription: body.metaDescription?.trim() || undefined,
      coverImage: body.coverImage?.trim() || undefined,
      translations: cleanTranslations(body.translations),
      showInNav: body.showInNav !== false,
      createdAt: now,
      updatedAt: now,
    };
    db.pages.push(created);
    return created;
  });
  res.status(201).json(page);
});

api.put("/admin/pages/:id", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Partial<Page>;
  const updated = await withDb((db) => {
    const page = db.pages.find((p) => p.id === req.params.id);
    if (!page) return null;
    if (body.title?.trim()) page.title = body.title.trim();
    if (body.slug?.trim()) {
      const base = slugify(body.slug);
      if (!db.pages.some((p) => p.slug === base && p.id !== page.id)) page.slug = base;
    }
    if (typeof body.content === "string") page.content = body.content;
    if (typeof body.showInNav === "boolean") page.showInNav = body.showInNav;
    if (typeof body.metaDescription === "string") {
      page.metaDescription = body.metaDescription.trim() || undefined;
    }
    if (typeof body.coverImage === "string") {
      page.coverImage = body.coverImage.trim() || undefined;
    }
    if (body.translations !== undefined) page.translations = cleanTranslations(body.translations);
    page.updatedAt = new Date().toISOString();
    return page;
  });
  if (!updated) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json(updated);
});

api.delete("/admin/pages/:id", requireAdmin, async (req, res) => {
  const removed = await withDb((db) => {
    const idx = db.pages.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return false;
    db.pages.splice(idx, 1);
    return true;
  });
  if (!removed) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  res.json({ ok: true });
});

/* ---------- admin: home + settings ---------- */

api.put("/admin/home", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const home = await withDb((db) => {
    for (const key of ["heroTitle", "heroSubtitle", "ctaText", "ctaLink"] as const) {
      if (typeof body[key] === "string") db.home[key] = (body[key] as string).trim();
    }
    if (Array.isArray(body.cards)) {
      db.home.cards = (body.cards as Record<string, string>[])
        .filter((c) => c && (c.title ?? "").trim())
        .slice(0, 12)
        .map((c) => ({
          icon: (c.icon ?? "★").trim() || "★",
          title: c.title.trim(),
          text: (c.text ?? "").trim(),
          link: c.link?.trim() || undefined,
        }));
    }
    return db.home;
  });
  res.json(home);
});

api.put("/admin/settings", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const settings = await withDb((db) => {
    for (const key of ["siteTitle", "tagline", "accentColor", "footerText", "siteUrl", "defaultAuthor"] as const) {
      if (typeof body[key] === "string" && (body[key] as string).trim()) {
        db.settings[key] = (body[key] as string).trim();
      }
    }
    if (Array.isArray(body.locales)) {
      const locales = (body.locales as string[])
        .map((l) => String(l).trim().toLowerCase())
        .filter((l) => /^[a-z]{2}(-[a-z]{2,4})?$/.test(l));
      if (locales.length) db.settings.locales = [...new Set(locales)];
    }
    if (typeof body.defaultLocale === "string" && db.settings.locales.includes(body.defaultLocale)) {
      db.settings.defaultLocale = body.defaultLocale;
    }
    return db.settings;
  });
  res.json(settings);
});
