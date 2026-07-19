import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { euro, shopApi, type Product } from "../api";
import { useCart } from "../cart";
import { Reveal } from "../motion";

export function StorePage() {
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    shopApi
      .products(category, q)
      .then((r) => {
        setProducts(r.products);
        setCategories(r.categories);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [category, q]);

  function addToCart(product: Product) {
    cart.add(product.id);
    setAdded(product.id);
    setTimeout(() => setAdded(null), 900);
  }

  return (
    <main className="container wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ marginBottom: 0 }}>Store</h1>
        <Link to="/cart">
          <button className="primary">🛒 Cart ({cart.count})</button>
        </Link>
      </div>

      <div className="search-row" style={{ alignItems: "center" }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          style={{ maxWidth: 280 }}
        />
        <span>
          <span
            className={`tag clickable ${category === "" ? "active" : ""}`}
            onClick={() => setCategory("")}
          >
            All
          </span>
          {categories.map((c) => (
            <span
              key={c}
              className={`tag clickable ${category === c ? "active" : ""}`}
              onClick={() => setCategory(category === c ? "" : c)}
            >
              {c}
            </span>
          ))}
        </span>
      </div>

      {loaded && products.length === 0 && <p className="muted">No products match.</p>}

      <div className="product-grid">
        {products.map((product, i) => (
          <Reveal key={product.id} delay={(i % 4) * 70}>
            <div className="product-card">
              {product.image ? (
                <img src={product.image} alt={product.name} loading="lazy" />
              ) : (
                <div className="product-noimg">🛒</div>
              )}
              {product.featured && <span className="product-flag">★ Popular</span>}
              <div className="product-body">
                <strong>{product.name}</strong>
                <span className="muted">{product.unit} · {product.category}</span>
                <p className="muted product-desc">{product.description}</p>
                <div className="product-row">
                  <span className="product-price">{euro(product.price)}</span>
                  {product.stock === 0 ? (
                    <span className="badge-draft">Out of stock</span>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => addToCart(product)}
                      disabled={product.stock === 0}
                    >
                      {added === product.id ? "✓ Added" : "＋ Add"}
                    </button>
                  )}
                </div>
                {product.stock > 0 && product.stock <= 5 && (
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    Only {product.stock} left
                  </span>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
