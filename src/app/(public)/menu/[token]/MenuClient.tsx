"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { usePreOrderStore, type CartItem } from "@/stores/preOrderStore";
import type { MenuItem } from "./page";

/* ---------- types ---------- */

interface Category {
  name: string;
  items: MenuItem[];
}

interface Props {
  token: string;
  guestName: string;
  categories: Category[];
  existingItems: CartItem[];
  preOrderStatus: string | null;
}

/* ---------- component ---------- */

export function MenuClient({
  token,
  guestName,
  categories,
  existingItems,
  preOrderStatus,
}: Props) {
  const router = useRouter();
  const store = usePreOrderStore();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.name ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(preOrderStatus === "CONFIRMED");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Initialize store from server data on first load
  useEffect(() => {
    store.setToken(token);
    if (existingItems.length > 0 && store.items.length === 0) {
      store.setItems(existingItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const scrollToCategory = useCallback(
    (name: string) => {
      setActiveCategory(name);
      setSidebarOpen(false);
      sectionRefs.current[name]?.scrollIntoView({ behavior: "smooth" });
    },
    [],
  );

  const handleAddItem = useCallback(
    (item: MenuItem) => {
      store.addItem({
        menuItemId: item.id,
        name: item.name,
        unitPrice: item.basePrice,
      });
      setConfirmed(false);
    },
    [store],
  );

  const handleSaveAndConfirm = useCallback(async () => {
    if (store.items.length === 0) return;
    setSaving(true);

    try {
      // Save items
      const saveRes = await fetch(`/api/pre-order/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: store.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            specialInstructions: i.specialInstructions,
          })),
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => null);
        alert(err?.error ?? "Failed to save order");
        return;
      }

      // Confirm
      const confirmRes = await fetch(`/api/pre-order/${token}/confirm`, {
        method: "POST",
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => null);
        alert(err?.error ?? "Failed to confirm order");
        return;
      }

      store.setSynced(true);
      setConfirmed(true);
      setCartOpen(false);
    } finally {
      setSaving(false);
    }
  }, [token, store]);

  const cartTotal = store.total();
  const cartCount = store.count();

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/50 backdrop-blur-md">
        <nav className="flex justify-between items-center w-full px-6 lg:px-8 py-4 lg:py-6 max-w-full mx-auto">
          <div className="text-xl lg:text-2xl font-headline tracking-widest text-primary uppercase">
            Waitlisted
          </div>
          <div className="flex items-center gap-4">
            {/* Mobile category toggle */}
            <button
              className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle categories"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </button>
            <button
              onClick={() => router.push(`/waitlist/${token}/status`)}
              className="text-on-surface-variant font-label text-xs tracking-widest uppercase hover:text-on-surface transition-colors"
            >
              Status
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile category overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute top-20 left-4 right-4 bg-surface-container-high rounded-xl p-6 shadow-2xl ghost-border">
            <h3 className="font-headline text-lg mb-4 text-on-surface">Categories</h3>
            <ul className="space-y-4">
              {categories.map((cat) => (
                <li key={cat.name}>
                  <button
                    onClick={() => scrollToCategory(cat.name)}
                    className={`flex items-center gap-3 w-full text-left ${
                      activeCategory === cat.name
                        ? "text-primary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeCategory === cat.name
                          ? "bg-primary shadow-[0_0_8px_rgba(233,193,118,0.5)]"
                          : "border border-outline-variant"
                      }`}
                    />
                    <span className="font-label tracking-[0.2em] uppercase text-sm">
                      {cat.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <main className="pt-20 lg:pt-32 pb-32 lg:pb-24 px-4 lg:px-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block lg:col-span-2">
          <div className="sticky top-40">
            <h2 className="font-headline text-3xl mb-8 leading-tight">
              Pre-Order
              <br />
              <span className="text-primary italic">Menu</span>
            </h2>
            <ul className="space-y-6">
              {categories.map((cat) => (
                <li key={cat.name}>
                  <button
                    onClick={() => scrollToCategory(cat.name)}
                    className="flex items-center gap-4 group"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeCategory === cat.name
                          ? "bg-primary shadow-[0_0_8px_rgba(233,193,118,0.5)]"
                          : "bg-transparent border border-outline-variant group-hover:border-primary transition-colors"
                      }`}
                    />
                    <span
                      className={`font-label tracking-[0.2em] uppercase text-sm ${
                        activeCategory === cat.name
                          ? "text-primary"
                          : "text-on-surface-variant group-hover:text-on-surface transition-colors"
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Menu grid */}
        <section className="lg:col-span-7 space-y-16 lg:space-y-24">
          {categories.map((cat) => (
            <div
              key={cat.name}
              ref={(el) => { sectionRefs.current[cat.name] = el; }}
              className="space-y-8 lg:space-y-12 scroll-mt-28 lg:scroll-mt-40"
              id={cat.name.toLowerCase()}
            >
              <div className="flex items-center gap-6">
                <h2 className="font-headline text-xl lg:text-2xl tracking-wider uppercase text-primary/80">
                  {cat.name}
                </h2>
                <div className="h-px flex-grow bg-outline-variant/30" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                {cat.items.map((item) => {
                  const inCart = store.items.find(
                    (c) => c.menuItemId === item.id,
                  );
                  return (
                    <div
                      key={item.id}
                      className="bg-surface-container-low rounded-xl overflow-hidden group hover:bg-surface-container transition-all duration-500 flex flex-col"
                    >
                      {/* Image placeholder */}
                      <div className="relative h-48 lg:h-64 overflow-hidden bg-surface-container">
                        <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant/20">
                          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" />
                          </svg>
                        </div>
                      </div>
                      <div className="p-6 lg:p-8 flex flex-col flex-grow">
                        <div className="flex justify-between items-start mb-3 lg:mb-4">
                          <h3 className="font-headline text-lg lg:text-xl text-on-surface">
                            {item.name}
                          </h3>
                          <span className="font-body text-primary text-lg shrink-0 ml-4">
                            ${item.basePrice.toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="font-body text-on-surface-variant text-sm leading-relaxed mb-6 lg:mb-8 flex-grow">
                            {item.description}
                          </p>
                        )}
                        {inCart ? (
                          <div className="flex items-center justify-between rounded-lg border border-primary/30 px-4 py-3">
                            <button
                              onClick={() =>
                                store.updateQuantity(
                                  item.id,
                                  inCart.quantity - 1,
                                )
                              }
                              className="text-primary font-bold text-lg w-8 h-8 flex items-center justify-center hover:bg-primary/10 rounded"
                            >
                              −
                            </button>
                            <span className="font-label text-on-surface font-semibold">
                              {inCart.quantity}
                            </span>
                            <button
                              onClick={() =>
                                store.updateQuantity(
                                  item.id,
                                  inCart.quantity + 1,
                                )
                              }
                              className="text-primary font-bold text-lg w-8 h-8 flex items-center justify-center hover:bg-primary/10 rounded"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddItem(item)}
                            className="w-full border border-outline-variant/30 py-3 lg:py-4 font-label tracking-widest text-xs uppercase hover:bg-primary hover:text-on-primary transition-all duration-300 rounded-lg flex items-center justify-center gap-2"
                          >
                            Add to List
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Desktop cart sidebar */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-40 bg-surface-container-high p-8 rounded-xl shadow-2xl space-y-8 ghost-border">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-6">
              <h3 className="font-headline text-xl">Your List</h3>
              {cartCount > 0 && (
                <span className="font-label text-xs bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-tighter">
                  {cartCount} {cartCount === 1 ? "Item" : "Items"}
                </span>
              )}
            </div>

            {store.items.length === 0 ? (
              <p className="text-on-surface-variant/60 italic text-sm font-body">
                No items selected yet
              </p>
            ) : (
              <div className="space-y-4">
                {store.items.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex justify-between items-center"
                  >
                    <div>
                      <p className="font-body text-sm font-semibold">
                        {item.name}{" "}
                        {item.quantity > 1 && (
                          <span className="text-on-surface-variant font-normal">
                            ×{item.quantity}
                          </span>
                        )}
                      </p>
                      <p className="font-body text-xs text-on-surface-variant">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => store.removeItem(item.menuItemId)}
                      className="text-on-surface-variant hover:text-error transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-6 space-y-6 border-t border-outline-variant/20">
              <div className="flex justify-between items-center font-headline text-lg">
                <span>Estimated Total</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-lg ghost-border">
                <p className="font-body text-xs leading-relaxed text-on-surface-variant italic">
                  Your host will review and fire this order once you are seated.
                </p>
              </div>

              {confirmed ? (
                <div className="text-center py-4">
                  <span className="font-label text-sm text-tertiary uppercase tracking-widest flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    Order Confirmed
                  </span>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full tracking-[0.2em] uppercase text-xs"
                  disabled={cartCount === 0 || saving}
                  onClick={handleSaveAndConfirm}
                >
                  {saving ? "Saving…" : "Confirm Selection"}
                </Button>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile bottom sheet cart */}
      <div className="lg:hidden">
        <BottomSheet
          open={cartOpen}
          onOpenChange={setCartOpen}
          trigger={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <span className="bg-primary text-on-primary text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
                <span className="font-label text-sm uppercase tracking-widest text-on-surface">
                  Your List
                </span>
              </div>
              <span className="font-headline text-primary text-lg">
                ${cartTotal.toFixed(2)}
              </span>
            </div>
          }
        >
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {store.items.length === 0 ? (
              <p className="text-on-surface-variant/60 italic text-sm font-body py-4">
                No items selected yet
              </p>
            ) : (
              store.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex justify-between items-center py-2"
                >
                  <div className="flex-1">
                    <p className="font-body text-sm font-semibold">
                      {item.name}{" "}
                      {item.quantity > 1 && (
                        <span className="text-on-surface-variant font-normal">
                          ×{item.quantity}
                        </span>
                      )}
                    </p>
                    <p className="font-body text-xs text-on-surface-variant">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        store.updateQuantity(item.menuItemId, item.quantity - 1)
                      }
                      className="text-on-surface-variant w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container"
                    >
                      −
                    </button>
                    <span className="font-label text-sm w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        store.updateQuantity(item.menuItemId, item.quantity + 1)
                      }
                      className="text-on-surface-variant w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container"
                    >
                      +
                    </button>
                    <button
                      onClick={() => store.removeItem(item.menuItemId)}
                      className="text-on-surface-variant hover:text-error ml-2 p-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-outline-variant/20 space-y-4">
            <div className="flex justify-between font-headline text-lg">
              <span>Estimated Total</span>
              <span className="text-primary">${cartTotal.toFixed(2)}</span>
            </div>

            {confirmed ? (
              <div className="text-center py-3">
                <span className="font-label text-sm text-tertiary uppercase tracking-widest">
                  Order Confirmed
                </span>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full tracking-[0.2em] uppercase text-xs"
                disabled={cartCount === 0 || saving}
                onClick={handleSaveAndConfirm}
              >
                {saving ? "Saving…" : "Confirm Selection"}
              </Button>
            )}
          </div>
        </BottomSheet>
      </div>
    </>
  );
}
