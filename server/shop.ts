import { Router } from "express";
import { requireAdmin } from "./auth.js";
import { getDb, newId, slugify, withDb } from "./store.js";
import type { Order, OrderItem, Product } from "./store.js";

export const shop = Router();

export const DELIVERY_FEE_CENTS = 295;
export const FREE_DELIVERY_OVER_CENTS = 3500;
const PROMOS: Record<string, { kind: "free_delivery"; label: string }> = {
  FRESH: { kind: "free_delivery", label: "First delivery free" },
};

/* ---------------- public ---------------- */

shop.get("/shop/products", async (req, res) => {
  const db = await getDb();
  const category = String(req.query.category ?? "").trim();
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const products = db.products
    .filter((p) => p.active)
    .filter((p) => !category || p.category === category)
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    )
    .sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || a.name.localeCompare(b.name));
  const categories = [...new Set(db.products.filter((p) => p.active).map((p) => p.category))].sort();
  res.json({ products, categories });
});

shop.get("/shop/products/:slug", async (req, res) => {
  const db = await getDb();
  const product = db.products.find((p) => p.slug === req.params.slug && p.active);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

/** Quote totals for a cart (also used by checkout). Prices always come from the catalog. */
function priceCart(
  db: { products: Product[] },
  items: { productId: string; qty: number }[],
  promoCode?: string,
): { items: OrderItem[]; subtotal: number; deliveryFee: number; total: number; promo?: Order["promo"]; problems: string[] } {
  const problems: string[] = [];
  const lines: OrderItem[] = [];
  for (const item of items) {
    const qty = Math.max(1, Math.min(99, Math.round(item.qty)));
    const product = db.products.find((p) => p.id === item.productId && p.active);
    if (!product) {
      problems.push(`A product in your cart is no longer available.`);
      continue;
    }
    if (product.stock < qty) {
      problems.push(`Only ${product.stock}× "${product.name}" left in stock.`);
      continue;
    }
    lines.push({ productId: product.id, name: product.name, unit: product.unit, price: product.price, qty });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const promo = promoCode && PROMOS[promoCode.toUpperCase()]
    ? { code: promoCode.toUpperCase(), label: PROMOS[promoCode.toUpperCase()].label }
    : undefined;
  const deliveryFee =
    subtotal === 0 || subtotal >= FREE_DELIVERY_OVER_CENTS || promo ? 0 : DELIVERY_FEE_CENTS;
  return { items: lines, subtotal, deliveryFee, total: subtotal + deliveryFee, promo, problems };
}

shop.post("/shop/quote", async (req, res) => {
  const body = (req.body ?? {}) as { items?: { productId: string; qty: number }[]; promoCode?: string };
  const db = await getDb();
  res.json(priceCart(db, body.items ?? [], body.promoCode));
});

shop.post("/shop/orders", async (req, res) => {
  const body = (req.body ?? {}) as {
    items?: { productId: string; qty: number }[];
    promoCode?: string;
    customer?: Partial<Order["customer"]>;
    deliveryWindow?: string;
  };
  const cust = body.customer ?? {};
  for (const field of ["name", "email", "address", "city", "postcode"] as const) {
    if (!String(cust[field] ?? "").trim()) {
      res.status(400).json({ error: `Missing ${field}` });
      return;
    }
  }
  if (!body.items?.length) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const result = await withDb((db) => {
    const priced = priceCart(db, body.items!, body.promoCode);
    if (priced.problems.length || priced.items.length === 0) {
      return { error: priced.problems.join(" ") || "Cart is empty", status: 409 } as const;
    }
    for (const line of priced.items) {
      const product = db.products.find((p) => p.id === line.productId)!;
      product.stock -= line.qty;
    }
    db.orderSeq = (db.orderSeq ?? 1000) + 1;
    const order: Order = {
      id: newId(),
      number: `FM-${db.orderSeq}`,
      items: priced.items,
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
      promo: priced.promo,
      customer: {
        name: String(cust.name).trim(),
        email: String(cust.email).trim().toLowerCase(),
        phone: String(cust.phone ?? "").trim() || undefined,
        address: String(cust.address).trim(),
        city: String(cust.city).trim(),
        postcode: String(cust.postcode).trim(),
        note: String(cust.note ?? "").trim() || undefined,
      },
      deliveryWindow: String(body.deliveryWindow ?? "18:00–20:00"),
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.orders.push(order);
    return { order } as const;
  });

  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  res.status(201).json(result.order);
});

/** Order tracking: number + email (acts as the customer's secret). */
shop.get("/shop/orders/:number", async (req, res) => {
  const db = await getDb();
  const email = String(req.query.email ?? "").trim().toLowerCase();
  const order = db.orders.find(
    (o) => o.number.toLowerCase() === req.params.number.toLowerCase() && o.customer.email === email,
  );
  if (!order) {
    res.status(404).json({ error: "Order not found — check the order number and email" });
    return;
  }
  res.json(order);
});

/* ---------------- admin ---------------- */

shop.get("/admin/shop/products", requireAdmin, async (_req, res) => {
  const db = await getDb();
  res.json([...db.products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
});

shop.post("/admin/shop/products", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Partial<Product>;
  if (!body.name?.trim() || typeof body.price !== "number" || body.price <= 0) {
    res.status(400).json({ error: "name and a positive price (in cents) are required" });
    return;
  }
  const now = new Date().toISOString();
  const product = await withDb((db) => {
    const base = slugify(body.slug?.trim() || body.name!.trim());
    let slug = base;
    for (let n = 2; db.products.some((p) => p.slug === slug); n += 1) slug = `${base}-${n}`;
    const created: Product = {
      id: newId(),
      slug,
      name: body.name!.trim(),
      description: body.description?.trim() ?? "",
      category: body.category?.trim() || "Other",
      unit: body.unit?.trim() || "each",
      price: Math.round(body.price ?? 0),
      stock: Math.max(0, Math.round(body.stock ?? 0)),
      image: body.image?.trim() || undefined,
      featured: body.featured === true,
      active: body.active !== false,
      createdAt: now,
      updatedAt: now,
    };
    db.products.push(created);
    return created;
  });
  res.status(201).json(product);
});

shop.put("/admin/shop/products/:id", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Partial<Product>;
  const updated = await withDb((db) => {
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) return null;
    if (body.name?.trim()) product.name = body.name.trim();
    if (typeof body.description === "string") product.description = body.description.trim();
    if (body.category?.trim()) product.category = body.category.trim();
    if (body.unit?.trim()) product.unit = body.unit.trim();
    if (typeof body.price === "number" && body.price > 0) product.price = Math.round(body.price);
    if (typeof body.stock === "number") product.stock = Math.max(0, Math.round(body.stock));
    if (typeof body.image === "string") product.image = body.image.trim() || undefined;
    if (typeof body.featured === "boolean") product.featured = body.featured;
    if (typeof body.active === "boolean") product.active = body.active;
    product.updatedAt = new Date().toISOString();
    return product;
  });
  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(updated);
});

shop.delete("/admin/shop/products/:id", requireAdmin, async (req, res) => {
  const removed = await withDb((db) => {
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return false;
    db.products.splice(idx, 1);
    return true;
  });
  if (!removed) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({ ok: true });
});

const ORDER_STATUSES: Order["status"][] = ["new", "confirmed", "out-for-delivery", "delivered", "cancelled"];

shop.get("/admin/shop/orders", requireAdmin, async (_req, res) => {
  const db = await getDb();
  res.json([...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

shop.put("/admin/shop/orders/:id", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as { status?: Order["status"] };
  if (!body.status || !ORDER_STATUSES.includes(body.status)) {
    res.status(400).json({ error: `status must be one of ${ORDER_STATUSES.join(", ")}` });
    return;
  }
  const updated = await withDb((db) => {
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) return null;
    // Cancelling restocks the items.
    if (body.status === "cancelled" && order.status !== "cancelled") {
      for (const line of order.items) {
        const product = db.products.find((p) => p.id === line.productId);
        if (product) product.stock += line.qty;
      }
    }
    order.status = body.status!;
    order.updatedAt = new Date().toISOString();
    return order;
  });
  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(updated);
});
