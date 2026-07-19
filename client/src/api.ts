export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  metaDescription?: string;
  coverImage?: string;
  author?: string;
  featured?: boolean;
  translations?: Record<string, { title?: string; content?: string; metaDescription?: string }>;
  tags: string[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface Post extends PostSummary {
  content: string;
}

export interface Settings {
  siteTitle: string;
  tagline: string;
  accentColor: string;
  footerText: string;
  siteUrl: string;
  defaultAuthor: string;
  locales: string[];
  defaultLocale: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaDescription?: string;
  coverImage?: string;
  translations?: Record<string, { title?: string; content?: string; metaDescription?: string }>;
  showInNav: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PageSummary {
  id: string;
  slug: string;
  title: string;
  showInNav: boolean;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  settings: () => request<Settings>("/api/settings"),
  posts: (lang = "") => request<PostSummary[]>(`/api/posts${lang}`),
  post: (slug: string, lang = "") => request<Post>(`/api/posts/${slug}${lang}`),
  login: (password: string) =>
    request<{ ok: boolean }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ authenticated: boolean }>("/api/auth/me"),
  adminPosts: () => request<Post[]>("/api/admin/posts"),
  createPost: (post: Partial<Post>) =>
    request<Post>("/api/admin/posts", { method: "POST", body: JSON.stringify(post) }),
  updatePost: (id: string, post: Partial<Post>) =>
    request<Post>(`/api/admin/posts/${id}`, { method: "PUT", body: JSON.stringify(post) }),
  deletePost: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/posts/${id}`, { method: "DELETE" }),
  saveSettings: (settings: Partial<Settings>) =>
    request<Settings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) }),
  home: () => request<HomeConfig>("/api/home"),
  saveHome: (home: HomeConfig) =>
    request<HomeConfig>("/api/admin/home", { method: "PUT", body: JSON.stringify(home) }),
  pages: () => request<PageSummary[]>("/api/pages"),
  page: (slug: string, lang = "") => request<Page>(`/api/pages/${slug}${lang}`),
  createPage: (page: Partial<Page>) =>
    request<Page>("/api/admin/pages", { method: "POST", body: JSON.stringify(page) }),
  updatePage: (id: string, page: Partial<Page>) =>
    request<Page>(`/api/admin/pages/${id}`, { method: "PUT", body: JSON.stringify(page) }),
  deletePage: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/pages/${id}`, { method: "DELETE" }),
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const res = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed");
    return data as { url: string };
  },
};

export function applyAccent(color: string): void {
  document.documentElement.style.setProperty("--accent", color);
}

/* ---------------- shop ---------------- */

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  price: number; // cents
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

export interface Quote {
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  promo?: { code: string; label: string };
  problems: string[];
}

export const shopApi = {
  products: (category = "", q = "") =>
    request<{ products: Product[]; categories: string[] }>(
      `/api/shop/products?category=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}`,
    ),
  quote: (items: { productId: string; qty: number }[], promoCode?: string) =>
    request<Quote>("/api/shop/quote", { method: "POST", body: JSON.stringify({ items, promoCode }) }),
  placeOrder: (body: {
    items: { productId: string; qty: number }[];
    promoCode?: string;
    customer: Record<string, string>;
    deliveryWindow: string;
  }) => request<Order>("/api/shop/orders", { method: "POST", body: JSON.stringify(body) }),
  track: (number: string, email: string) =>
    request<Order>(`/api/shop/orders/${encodeURIComponent(number)}?email=${encodeURIComponent(email)}`),
  adminProducts: () => request<Product[]>("/api/admin/shop/products"),
  createProduct: (p: Partial<Product>) =>
    request<Product>("/api/admin/shop/products", { method: "POST", body: JSON.stringify(p) }),
  updateProduct: (id: string, p: Partial<Product>) =>
    request<Product>(`/api/admin/shop/products/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  deleteProduct: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/shop/products/${id}`, { method: "DELETE" }),
  adminOrders: () => request<Order[]>("/api/admin/shop/orders"),
  setOrderStatus: (id: string, status: Order["status"]) =>
    request<Order>(`/api/admin/shop/orders/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
};

export const euro = (cents: number) => `€${(cents / 100).toFixed(2)}`;
