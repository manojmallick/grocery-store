import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface Post {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  /** Overrides the excerpt in meta/OG description tags. */
  metaDescription?: string;
  /** Media URL (/api/media/...) shown as card thumb, post hero, and og:image. */
  coverImage?: string;
  author?: string;
  /** Featured posts get the large banner treatment on home and blog. */
  featured?: boolean;
  /** Per-locale overrides of title/content/metaDescription. */
  translations?: Record<string, Translation>;
  tags: string[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaDescription?: string;
  coverImage?: string;
  translations?: Record<string, Translation>;
  showInNav: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HomeCard {
  icon: string;
  title: string;
  text: string;
  link?: string;
}

export interface HomeConfig {
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  ctaLink: string;
  cards: HomeCard[];
}

export interface Translation {
  title?: string;
  content?: string;
  metaDescription?: string;
}

export interface Settings {
  siteTitle: string;
  tagline: string;
  accentColor: string;
  footerText: string;
  /** Absolute origin (https://example.com) used for canonical URLs, sitemap, and RSS. */
  siteUrl: string;
  /** Byline used when a post has no author of its own. */
  defaultAuthor: string;
  /** BCP-47 codes offered in the language switcher; first-class i18n. */
  locales: string[];
  defaultLocale: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  /** e.g. "500 g", "each", "1 L" */
  unit: string;
  /** cents */
  price: number;
  stock: number;
  image?: string;
  featured?: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  number: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  promo?: { code: string; label: string };
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    city: string;
    postcode: string;
    note?: string;
  };
  deliveryWindow: string;
  status: "new" | "confirmed" | "out-for-delivery" | "delivered" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface Db {
  settings: Settings;
  home: HomeConfig;
  pages: Page[];
  posts: Post[];
  products: Product[];
  orders: Order[];
  orderSeq?: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "blog.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const DEFAULT_HOME: HomeConfig = {
  heroTitle: "Welcome to FreshMart",
  heroSubtitle: "Stories, guides, and rich pages — everything editable from /admin.",
  ctaText: "Read the blog",
  ctaLink: "/blog",
  cards: [
    { icon: "✍️", title: "Write", text: "Markdown posts with live preview, drafts, and tags." },
    { icon: "🧩", title: "Rich blocks", text: "Videos, image uploads, card grids, and charts inside any post or page." },
    { icon: "🎨", title: "Customize", text: "Pages, navigation, home cards, and colors — all from the admin." },
  ],
};

function seed(): Db {
  const now = new Date().toISOString();
  return {
    settings: {
      siteTitle: "FreshMart",
      tagline: "A fully customizable blog — edit everything from /admin",
      accentColor: "#2563eb",
      footerText: "Powered by FreshMart",
      siteUrl: "http://localhost:4000",
      defaultAuthor: "Editor",
      locales: ["en"],
      defaultLocale: "en",
    },
    home: structuredClone(DEFAULT_HOME),
    pages: [
      {
        id: randomUUID(),
        slug: "about",
        title: "About",
        content:
          "This is a **page** (not a post) — create more like it under Admin → Pages, and toggle whether they appear in the navigation.\n\n:::cards\n- 🚀 | One command | This whole site came from a single scaffold\n- 🔓 | No lock-in | Plain code you own, a JSON store you can swap\n:::",
        showInNav: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    products: [],
    orders: [],
    posts: [
      {
        id: randomUUID(),
        slug: "hello-world",
        title: "Hello world",
        content:
          "Welcome to your new blog.\n\nHead to **/admin** (default password: `admin` — set `ADMIN_PASSWORD` to change it) to edit or delete this post, write your own in Markdown, build the home page, and add pages.\n\n## Rich blocks\n\nPosts and pages support videos, uploaded images, card grids, and charts:\n\n:::chart\n{\"type\":\"bar\",\"title\":\"Why blocks?\",\"labels\":[\"Plain text\",\"With blocks\"],\"values\":[40,90]}\n:::\n\nSee the README for the full block syntax.",
        excerpt: "Welcome to your new blog — log into /admin to make it yours.",
        tags: ["meta"],
        status: "published",
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      },
    ],
  };
}

// Serialize writes within this process; swap this module for a real DB in production.
let writeLock: Promise<unknown> = Promise.resolve();

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Partial<Db>;
    // Migrate stores created before pages/home existed.
    db.pages ??= [];
    db.home ??= structuredClone(DEFAULT_HOME);
    db.products ??= [];
    db.orders ??= [];
    if (db.settings) {
      db.settings.siteUrl ??= "http://localhost:4000";
      db.settings.defaultAuthor ??= "Editor";
      db.settings.locales ??= ["en"];
      db.settings.defaultLocale ??= db.settings.locales[0] ?? "en";
    }
    return db as Db;
  } catch {
    return seed();
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
}

export async function withDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = writeLock.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  writeLock = run.catch(() => {});
  return run;
}

export async function getDb(): Promise<Db> {
  return readDb();
}

export function newId(): string {
  return randomUUID();
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

export function makeExcerpt(content: string): string {
  const plain = content
    .replace(/^:::[\s\S]*?^:::$/gm, "")
    .replace(/[#>*_`\[\]!]/g, "")
    .replace(/\(https?:[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 180 ? plain.slice(0, 177) + "…" : plain;
}

/** Merge a locale's translation over the base fields (default locale = base). */
export function localized<T extends { title: string; content: string; metaDescription?: string; translations?: Record<string, Translation> }>(
  item: T,
  lang: string | undefined,
  defaultLocale: string,
): T {
  if (!lang || lang === defaultLocale) return item;
  const t = item.translations?.[lang];
  if (!t) return item;
  return {
    ...item,
    title: t.title?.trim() || item.title,
    content: t.content?.trim() || item.content,
    metaDescription: t.metaDescription?.trim() || item.metaDescription,
  };
}
