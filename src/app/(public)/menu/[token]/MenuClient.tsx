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
  const [cartOpen, setCartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [everConfirmed, setEverConfirmed] = useState(preOrderStatus === "CONFIRMED");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Initialize store from server data on first load
  useEffect(() => {
    store.setToken(token);
    if (existingItems.length > 0 && store.items.length === 0) {
      store.setItems(existingItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Intersection observer to highlight active category while scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const name = entry.target.getAttribute("data-category");
            if (name) {
              setActiveCategory(name);
              pillRefs.current[name]?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
              });
            }
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );

    for (const el of Object.values(sectionRefs.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  const scrollToCategory = useCallback((name: string) => {
    setActiveCategory(name);
    sectionRefs.current[name]?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleAddItem = useCallback(
    (item: MenuItem) => {
      store.addItem({
        menuItemId: item.id,
        name: item.name,
        unitPrice: item.basePrice,
      });
    },
    [store],
  );

  const handleSaveAndConfirm = useCallback(async () => {
    if (store.items.length === 0) return;
    setSaving(true);

    try {
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

      const confirmRes = await fetch(`/api/pre-order/${token}/confirm`, {
        method: "POST",
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => null);
        alert(err?.error ?? "Failed to confirm order");
        return;
      }

      store.setSynced(true);
      setEverConfirmed(true);
      setCartOpen(false);
    } finally {
      setSaving(false);
    }
  }, [token, store]);

  const cartTotal = store.total();
  const cartCount = store.count();
  // Derived: show "confirmed" only when synced with no local changes since last save
  const confirmed = everConfirmed && store.synced;

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/50 backdrop-blur-md">
        <nav className="flex justify-between items-center w-full px-4 lg:px-8 py-3 lg:py-6">
          <div className="text-lg lg:text-2xl font-headline tracking-widest text-primary uppercase">
            Waitlisted
          </div>
          <div className="flex items-center gap-3">
            <span className="text-on-surface-variant font-label text-[10px] tracking-wider uppercase hidden sm:inline">
              {guestName}
            </span>
            <button
              onClick={() => router.push(`/waitlist/${token}/status`)}
              className="text-on-surface-variant font-label text-xs tracking-widest uppercase hover:text-on-surface transition-colors px-3 py-2"
            >
              Status
            </button>
          </div>
        </nav>

        {/* Sticky horizontal category pills — mobile & desktop */}
        <div className="border-t border-outline-variant/10 bg-surface/80 backdrop-blur-md">
          <div className="flex gap-2 px-4 lg:px-8 py-2.5 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.name}
                ref={(el) => { pillRefs.current[cat.name] = el; }}
                onClick={() => scrollToCategory(cat.name)}
                className={`shrink-0 px-4 py-2 rounded-full font-label text-xs uppercase tracking-widest transition-colors ${
                  activeCategory === cat.name
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="pt-28 lg:pt-36 pb-28 lg:pb-24 px-4 lg:px-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
        {/* Desktop sidebar — hidden on mobile (pills replace it) */}
        <aside className="hidden lg:block lg:col-span-2">
          <div className="sticky top-40">
            <h2 className="font-headline text-3xl mb-8 leading-tight">
              Pre-Order
              <br />
              <span className="text-primary italic">Menu</span>
            </h2>
          </div>
        </aside>

        {/* Menu grid */}
        <section className="lg:col-span-7 space-y-10 lg:space-y-24">
          {categories.map((cat) => (
            <div
              key={cat.name}
              ref={(el) => { sectionRefs.current[cat.name] = el; }}
              data-category={cat.name}
              className="space-y-4 lg:space-y-12 scroll-mt-32 lg:scroll-mt-40"
              id={cat.name.toLowerCase()}
            >
              <div className="flex items-center gap-4 lg:gap-6">
                <h2 className="font-headline text-lg lg:text-2xl tracking-wider uppercase text-primary/80">
                  {cat.name}
                </h2>
                <div className="h-px flex-grow bg-outline-variant/30" />
              </div>

              {/* Mobile: compact horizontal cards. Desktop: image cards in grid */}
              <div className="space-y-3 lg:hidden">
                {cat.items.map((item) => {
                  const inCart = store.items.find(
                    (c) => c.menuItemId === item.id,
                  );
                  return (
                    <div
                      key={item.id}
                      className="bg-surface-container-low rounded-xl p-4 flex gap-4 items-start"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-headline text-base text-on-surface leading-snug">
                            {item.name}
                          </h3>
                          <span className="font-body text-primary text-base shrink-0 ml-3">
                            ${item.basePrice.toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="font-body text-on-surface-variant text-xs leading-relaxed line-clamp-2 mb-3">
                            {item.description}
                          </p>
                        )}
                        {inCart ? (
                          <div className="flex items-center gap-1 w-fit rounded-full border border-primary/30 px-1">
                            <button
                              onClick={() =>
                                store.updateQuantity(item.id, inCart.quantity - 1)
                              }
                              className="text-primary font-bold text-lg w-11 h-11 flex items-center justify-center rounded-full active:bg-primary/10"
                            >
                              −
                            </button>
                            <span className="font-label text-on-surface font-semibold w-6 text-center">
                              {inCart.quantity}
                            </span>
                            <button
                              onClick={() =>
                                store.updateQuantity(item.id, inCart.quantity + 1)
                              }
                              className="text-primary font-bold text-lg w-11 h-11 flex items-center justify-center rounded-full active:bg-primary/10"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddItem(item)}
                            className="border border-outline-variant/30 px-5 py-2.5 font-label tracking-widest text-[10px] uppercase active:bg-primary active:text-on-primary transition-colors rounded-full"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: full image cards */}
              <div className="hidden lg:grid lg:grid-cols-2 gap-8">
                {cat.items.map((item) => {
                  const inCart = store.items.find(
                    (c) => c.menuItemId === item.id,
                  );
                  return (
                    <div
                      key={item.id}
                      className="bg-surface-container-low rounded-xl overflow-hidden group hover:bg-surface-container transition-all duration-500 flex flex-col"
                    >
                      <div className="relative h-64 overflow-hidden bg-surface-container">
                        <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant/20">
                          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" />
                          </svg>
                        </div>
                      </div>
                      <div className="p-8 flex flex-col flex-grow">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-headline text-xl text-on-surface">
                            {item.name}
                          </h3>
                          <span className="font-body text-primary text-lg shrink-0 ml-4">
                            ${item.basePrice.toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="font-body text-on-surface-variant text-sm leading-relaxed mb-8 flex-grow">
                            {item.description}
                          </p>
                        )}
                        {inCart ? (
                          <div className="flex items-center justify-between rounded-lg border border-primary/30 px-4 py-3">
                            <button
                              onClick={() =>
                                store.updateQuantity(item.id, inCart.quantity - 1)
                              }
                              className="text-primary font-bold text-lg w-11 h-11 flex items-center justify-center hover:bg-primary/10 rounded-full"
                            >
                              −
                            </button>
                            <span className="font-label text-on-surface font-semibold">
                              {inCart.quantity}
                            </span>
                            <button
                              onClick={() =>
                                store.updateQuantity(item.id, inCart.quantity + 1)
                              }
                              className="text-primary font-bold text-lg w-11 h-11 flex items-center justify-center hover:bg-primary/10 rounded-full"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddItem(item)}
                            className="w-full border border-outline-variant/30 py-4 font-label tracking-widest text-xs uppercase hover:bg-primary hover:text-on-primary transition-all duration-300 rounded-lg flex items-center justify-center gap-2"
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
            <div className="flex items-center justify-between w-full py-1">
              <div className="flex items-center gap-3">
                <span className="bg-primary text-on-primary text-xs font-bold min-w-[28px] h-7 rounded-full flex items-center justify-center px-2">
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
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
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
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold truncate">
                      {item.name}
                    </p>
                    <p className="font-body text-xs text-on-surface-variant">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button
                      onClick={() =>
                        store.updateQuantity(item.menuItemId, item.quantity - 1)
                      }
                      className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container text-lg"
                    >
                      −
                    </button>
                    <span className="font-label text-sm w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        store.updateQuantity(item.menuItemId, item.quantity + 1)
                      }
                      className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant active:bg-surface-container text-lg"
                    >
                      +
                    </button>
                    <button
                      onClick={() => store.removeItem(item.menuItemId)}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant active:text-error ml-1"
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
