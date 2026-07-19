import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { euro, shopApi, type Order } from "../api";

const STEPS: Order["status"][] = ["new", "confirmed", "out-for-delivery", "delivered"];
const STEP_LABELS: Record<Order["status"], string> = {
  new: "Received",
  confirmed: "Confirmed",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function TrackOrderPage() {
  const [params] = useSearchParams();
  const [number, setNumber] = useState(params.get("number") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setOrder(null);
    try {
      setOrder(await shopApi.track(number.trim(), email.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found");
    }
  }

  useEffect(() => {
    if (params.get("number") && params.get("email")) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIndex = order ? STEPS.indexOf(order.status) : -1;

  return (
    <main className="container">
      <h1>Track your order</h1>
      <form onSubmit={lookup} className="card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 160px" }}>
          <label>Order number</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="FM-1001" />
        </div>
        <div style={{ flex: "2 1 220px" }}>
          <label>Email used at checkout</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="primary" type="submit">Track</button>
      </form>
      {error && <p className="error">{error}</p>}

      {order && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0 }}>{order.number}</h2>
            <span className={order.status === "cancelled" ? "badge-draft" : "badge-published"}>
              {STEP_LABELS[order.status]}
            </span>
          </div>
          {order.status !== "cancelled" && (
            <div className="track-steps">
              {STEPS.map((step, i) => (
                <div key={step} className={`track-step ${i <= stepIndex ? "done" : ""}`}>
                  <span className="dot" />
                  <span className="muted">{STEP_LABELS[step]}</span>
                </div>
              ))}
            </div>
          )}
          <p className="muted">
            Delivery {order.deliveryWindow} · {order.customer.address}, {order.customer.city}
          </p>
          {order.items.map((item) => (
            <div key={item.productId} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{item.qty}× {item.name}</span>
              <span>{euro(item.price * item.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: "0.5rem" }}>
            <span>Total</span>
            <span>{euro(order.total)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
