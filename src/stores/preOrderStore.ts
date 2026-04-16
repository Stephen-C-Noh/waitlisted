import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  specialInstructions?: string;
}

interface PreOrderState {
  /** Current access token the cart is keyed to */
  token: string | null;
  items: CartItem[];
  /** Whether the cart has been saved to the server at least once */
  synced: boolean;

  setToken: (token: string) => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateInstructions: (menuItemId: string, instructions: string) => void;
  /** Replace all items (used when initializing from server) */
  setItems: (items: CartItem[]) => void;
  setSynced: (synced: boolean) => void;
  clearCart: () => void;
  total: () => number;
  count: () => number;
}

export const usePreOrderStore = create<PreOrderState>()(
  persist(
    (set, get) => ({
      token: null,
      items: [],
      synced: false,

      setToken: (token) => {
        // If switching to a different token, reset the cart
        if (get().token !== token) {
          set({ token, items: [], synced: false });
        }
      },

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.menuItemId === item.menuItemId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.menuItemId === item.menuItemId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
              synced: false,
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1 }],
            synced: false,
          };
        }),

      removeItem: (menuItemId) =>
        set((state) => ({
          items: state.items.filter((i) => i.menuItemId !== menuItemId),
          synced: false,
        })),

      updateQuantity: (menuItemId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((i) => i.menuItemId !== menuItemId),
              synced: false,
            };
          }
          return {
            items: state.items.map((i) =>
              i.menuItemId === menuItemId ? { ...i, quantity } : i,
            ),
            synced: false,
          };
        }),

      updateInstructions: (menuItemId, instructions) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.menuItemId === menuItemId
              ? { ...i, specialInstructions: instructions || undefined }
              : i,
          ),
          synced: false,
        })),

      setItems: (items) => set({ items, synced: true }),

      setSynced: (synced) => set({ synced }),

      clearCart: () => set({ items: [], synced: false }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),

      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "waitlisted-pre-order",
      partialize: (state) => ({
        token: state.token,
        items: state.items,
      }),
    },
  ),
);
