import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { euro, shopApi, type Order, type Quote } from "../api";
import { useCart } from "../cart";

const WINDOWS = ["16:00–18:00", "18:00–20:00", "19:00–21:00"];
const FREE_OVER = 3500;

export function CartPage() {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "Amsterdam", postcode: "", note: "",
  });
  const [deliveryWindow, setDeliveryWindow] = useState(WINDOWS[1]);

  const refresh = useCallback(async () => {
    if (cart.lines.length === 0) {
      setQuote(null);
      return;
    }
    try {
      setQuote(await shopApi.quote(cart.lines, promoCode || undefined));
    } catch {
      /* server unreachable */
    }
  }, [cart.lines, promoCode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const order = await shopApi.placeOrder({
        items: cart.lines,
        promoCode: promoCode || undefined,
        customer: form,
        deliveryWindow,
      });
      cart.clear();
      setPlaced(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order");
    } finally {
      setBusy(false);
    }
  }

  if (placed) {
    return (
      <main className="container" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3.4rem" }}>🎉</div>
        <h1>Order placed!</h1>
        <p>
          Your order number is <strong>{placed.number}</strong>. We'll deliver{" "}
          <strong>{placed.deliveryWindow}</strong> to {placed.customer.address},{" "}
          {placed.customer.city}.
        </p>
        <div className="card" style={{ textAlign: "left", maxWidth: 440, margin: "1.5rem auto" }}>
          {placed.items.map((item) => (
            <div key={item.productId} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{item.qty}× {item.name}</span>
              <span>{euro(item.price * item.qty)}</span>
            </div>
          ))}
          <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }} className="muted">
            <span>Delivery</span>
            <span>{placed.deliveryFee === 0 ? "Free" : euro(placed.deliveryFee)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span>{euro(placed.total)}</span>
          </div>
        </div>
        <p>
          Track it any time on the{" "}
          <Link to={`/order?number=${placed.number}&email=${encodeURIComponent(placed.customer.email)}`}>
            order tracking page
          </Link>
          .
        </p>
        <Link to="/store">
          <button className="primary">Keep shopping</button>
        </Link>
      </main>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <main className="container" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem" }}>🛒</div>
        <h1>Your cart is empty</h1>
        <Link to="/store">
          <button className="primary">Browse the store</button>
        </Link>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Cart</h1>
      {quote?.problems.map((problem) => (
        <p key={problem} className="error">{problem}</p>
      ))}
      <div className="card">
        {quote?.items.map((item) => (
          <div key={item.productId} className="cart-line">
            <span style={{ flex: 1 }}>
              <strong>{item.name}</strong> <span className="muted">{item.unit}</span>
            </span>
            <span className="qty-stepper">
              <button onClick={() => cart.setQty(item.productId, item.qty - 1)}>−</button>
              <span>{item.qty}</span>
              <button onClick={() => cart.setQty(item.productId, item.qty + 1)}>＋</button>
            </span>
            <span style={{ width: 76, textAlign: "right" }}>{euro(item.price * item.qty)}</span>
            <button className="danger" onClick={() => cart.remove(item.productId)}>✕</button>
          </div>
        ))}
        <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
        {quote && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal</span>
              <span>{euro(quote.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }} className="muted">
              <span>
                Delivery{quote.promo ? ` (${quote.promo.label})` : ""}
              </span>
              <span>{quote.deliveryFee === 0 ? "Free" : euro(quote.deliveryFee)}</span>
            </div>
            {quote.deliveryFee > 0 && (
              <p className="muted" style={{ margin: "0.4rem 0 0" }}>
                Add {euro(FREE_OVER - quote.subtotal)} more for free delivery
                <span className="meter" style={{ display: "block", marginTop: 4 }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.min(100, (quote.subtotal / FREE_OVER) * 100)}%`, background: "var(--accent)" }} />
                </span>
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.1rem", marginTop: "0.5rem" }}>
              <span>Total</span>
              <span>{euro(quote.total)}</span>
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Promo code (try FRESH)"
            style={{ maxWidth: 220 }}
          />
          <button onClick={refresh}>Apply</button>
        </div>
      </div>

      {!checkout ? (
        <p style={{ display: "flex", gap: "0.6rem" }}>
          <button className="primary" onClick={() => setCheckout(true)}>
            Checkout →
          </button>
          <Link to="/store">
            <button>← Keep shopping</button>
          </Link>
        </p>
      ) : (
        <form onSubmit={placeOrder} className="card">
          <h2 style={{ marginTop: 0 }}>Delivery details</h2>
          <div className="split">
            <div>
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label>Email</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <label>Phone (optional)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label>Address</label>
              <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="split">
                <div>
                  <label>City</label>
                  <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label>Postcode</label>
                  <input required value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                </div>
              </div>
              <label>Delivery window (today)</label>
              <select value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)}>
                {WINDOWS.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
          <label>Note for the driver (optional)</label>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          {error && <p className="error">{error}</p>}
          <p style={{ marginBottom: 0 }}>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Placing order…" : `Place order · ${quote ? euro(quote.total) : ""}`}
            </button>
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Demo checkout — payment on delivery. No card required.
          </p>
        </form>
      )}
    </main>
  );
}
