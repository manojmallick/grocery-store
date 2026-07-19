import { promises as fs } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { getDb, localized } from "./store.js";

export const seo = Router();

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

seo.get("/robots.txt", async (_req, res) => {
  const { settings } = await getDb();
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${settings.siteUrl}/sitemap.xml\n`,
  );
});

seo.get("/sitemap.xml", async (_req, res) => {
  const db = await getDb();
  const base = db.settings.siteUrl.replace(/\/$/, "");
  const urls = [
    { loc: `${base}/`, lastmod: undefined as string | undefined },
    { loc: `${base}/blog`, lastmod: undefined },
    ...db.pages.map((p) => ({ loc: `${base}/p/${p.slug}`, lastmod: p.updatedAt })),
    ...db.posts
      .filter((p) => p.status === "published")
      .map((p) => ({ loc: `${base}/post/${p.slug}`, lastmod: p.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;
  res.type("application/xml").send(xml);
});

seo.get("/feed.xml", async (_req, res) => {
  const db = await getDb();
  const base = db.settings.siteUrl.replace(/\/$/, "");
  const items = db.posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 20)
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${base}/post/${p.slug}</link>
      <guid>${base}/post/${p.slug}</guid>
      <pubDate>${new Date(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>
      <description>${esc(p.metaDescription ?? p.excerpt)}</description>
      ${p.tags.map((t) => `<category>${esc(t)}</category>`).join("")}
    </item>`,
    )
    .join("\n");
  res.type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(db.settings.siteTitle)}</title>
    <link>${base}</link>
    <description>${esc(db.settings.tagline)}</description>
${items}
  </channel>
</rss>`);
});

interface Meta {
  title: string;
  description: string;
  canonicalPath: string;
  type: "website" | "article";
  image?: string;
  /** Locales this route is available in (drives hreflang). */
  locales?: string[];
}

async function metaFor(reqPath: string, lang: string): Promise<Meta> {
  const db = await getDb();
  const site = db.settings;
  const base: Meta = {
    title: site.siteTitle,
    description: site.tagline,
    canonicalPath: "/",
    type: "website",
  };
  const postMatch = reqPath.match(/^\/post\/([^/]+)$/);
  if (postMatch) {
    const raw = db.posts.find((p) => p.slug === postMatch[1] && p.status === "published");
    if (raw) {
      const post = localized(raw, lang, site.defaultLocale);
      return {
        title: `${post.title} · ${site.siteTitle}`,
        description: post.metaDescription ?? post.excerpt,
        canonicalPath: `/post/${post.slug}`,
        type: "article",
        image: post.coverImage,
        locales: [site.defaultLocale, ...Object.keys(raw.translations ?? {})],
      };
    }
  }
  const pageMatch = reqPath.match(/^\/p\/([^/]+)$/);
  if (pageMatch) {
    const rawPage = db.pages.find((p) => p.slug === pageMatch[1]);
    if (rawPage) {
      const page = localized(rawPage, lang, site.defaultLocale);
      return {
        title: `${page.title} · ${site.siteTitle}`,
        description: page.metaDescription ?? site.tagline,
        canonicalPath: `/p/${page.slug}`,
        type: "website",
        image: page.coverImage,
        locales: [site.defaultLocale, ...Object.keys(rawPage.translations ?? {})],
      };
    }
  }
  if (reqPath === "/blog") {
    return { ...base, title: `Blog · ${site.siteTitle}`, canonicalPath: "/blog" };
  }
  return { ...base, canonicalPath: reqPath === "/" ? "/" : reqPath };
}

/**
 * Serve the SPA's index.html with per-route <title>/meta/OG/canonical tags injected,
 * so crawlers and link unfurlers see real metadata without JS.
 */
export function spaWithMeta(clientDist: string) {
  return async (req: import("express").Request, res: import("express").Response) => {
    let html: string;
    try {
      html = await fs.readFile(path.join(clientDist, "index.html"), "utf8");
    } catch {
      res.status(503).send("Client not built — run `pnpm build` first.");
      return;
    }
    const db = await getDb();
    const meta = await metaFor(req.path, String(req.query.lang ?? ""));
    const canonical = `${db.settings.siteUrl.replace(/\/$/, "")}${meta.canonicalPath}`;
    const head = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}" />`,
      `<link rel="canonical" href="${esc(canonical)}" />`,
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:type" content="${meta.type}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      `<meta property="og:site_name" content="${esc(db.settings.siteTitle)}" />`,
      ...(meta.image
        ? [
            `<meta property="og:image" content="${esc(`${db.settings.siteUrl.replace(/\/$/, "")}${meta.image}`)}" />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
          ]
        : [`<meta name="twitter:card" content="summary" />`]),
      ...(meta.locales && meta.locales.length > 1
        ? meta.locales.map(
            (locale) =>
              `<link rel="alternate" hreflang="${esc(locale)}" href="${esc(`${canonical}${locale === db.settings.defaultLocale ? "" : `?lang=${locale}`}`)}" />`,
          )
        : []),
      `<link rel="alternate" type="application/rss+xml" href="/feed.xml" />`,
    ].join("\n    ");
    html = html.replace(/<title>.*?<\/title>/s, head);
    res.type("html").send(html);
  };
}
