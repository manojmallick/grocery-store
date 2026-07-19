import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CartLine {
  productId: string;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue>({
  lines: [],
  count: 0,
  add: () => {},
  setQty: () => {},
  remove: () => {},
  clear: () => {},
});

const KEY = "freshmart.cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      setLines(JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[]);
    } catch {
      /* fresh cart */
    }
  }, []);

  const persist = (next: CartLine[]) => {
    setLines(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const add = (productId: string, qty = 1) => {
    const existing = lines.find((l) => l.productId === productId);
    persist(
      existing
        ? lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, l.qty + qty) } : l))
        : [...lines, { productId, qty }],
    );
  };

  const setQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      persist(lines.filter((l) => l.productId !== productId));
      return;
    }
    persist(lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l)));
  };

  return (
    <CartContext.Provider
      value={{
        lines,
        count: lines.reduce((sum, l) => sum + l.qty, 0),
        add,
        setQty,
        remove: (productId) => persist(lines.filter((l) => l.productId !== productId)),
        clear: () => persist([]),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  return useContext(CartContext);
}
