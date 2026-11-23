"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { POS_DISABLED_NOTE } from "@/lib/pos-mode";
import { PinConfirmDialog } from "./PinConfirmDialog";

interface PreOrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  specialInstructions: string | null;
  unitPrice: number;
}

interface PreOrderData {
  id: string;
  status: string;
  subtotal: number;
  firedOrderId: string | null;
  firedByUserId: string | null;
  items: PreOrderItem[];
}

interface Props {
  entryId: string;
  guestName: string;
  posEnabled: boolean;
  onClose: () => void;
}

export function PreOrderModal({ entryId, guestName, posEnabled, onClose }: Props) {
  const queryClient = useQueryClient();
  const [showPin, setShowPin] = useState(false);
  const [firing, setFiring] = useState(false);
  const [pinError, setPinError] = useState("");

  const { data, isLoading, error } = useQuery<PreOrderData>({
    queryKey: ["pre-order", entryId],
    queryFn: async () => {
      const res = await fetch(`/api/pre-order/by-entry/${entryId}`);
      if (!res.ok) throw new Error("Failed to load pre-order");
      return res.json();
    },
  });

  async function handleFire(pin: string) {
    if (!data) return;
    setFiring(true);
    setPinError("");

    try {
      const res = await fetch("/api/orders/from-preorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preOrderId: data.id, pin }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (res.status === 401) {
          setPinError(
            err?.error === "Invalid PIN"
              ? "Invalid PIN — please try again"
              : "Session expired — sign in again",
          );
          return;
        }
        setPinError(err?.error ?? "Failed to fire order");
        return;
      }

      // Success — refresh data
      queryClient.invalidateQueries({ queryKey: ["pre-order", entryId] });
      queryClient.invalidateQueries({ queryKey: ["waitlist-entries"] });
      setShowPin(false);
    } finally {
      setFiring(false);
    }
  }

  const total = data?.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  ) ?? 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-surface-container-high rounded-xl p-8 w-full max-w-lg shadow-2xl ghost-border max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-headline text-2xl text-on-surface">
                Pre-Order
              </h2>
              <p className="text-on-surface-variant font-label text-sm">
                {guestName}
              </p>
            </div>
            {data && (
              <span
                className={`font-label text-xs uppercase tracking-widest px-3 py-1 rounded-full ${
                  data.status === "FIRED"
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : data.status === "CONFIRMED"
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {data.status}
              </span>
            )}
          </div>

          {isLoading && (
            <div className="py-12 text-center text-on-surface-variant">
              Loading…
            </div>
          )}

          {error && (
            <div className="py-12 text-center text-error">
              Failed to load pre-order
            </div>
          )}

          {data && (
            <>
              <div className="space-y-4 mb-6">
                {data.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start py-3 border-b border-outline-variant/10 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="font-body text-sm font-semibold text-on-surface">
                        {item.menuItemName}
                        {item.quantity > 1 && (
                          <span className="text-on-surface-variant font-normal">
                            {" "}
                            ×{item.quantity}
                          </span>
                        )}
                      </p>
                      {item.specialInstructions && (
                        <p className="text-xs text-on-surface-variant italic mt-1">
                          {item.specialInstructions}
                        </p>
                      )}
                    </div>
                    <span className="font-body text-sm text-primary shrink-0 ml-4">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-headline text-lg border-t border-outline-variant/20 pt-4 mb-6">
                <span>Total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>

              {data.status === "FIRED" ? (
                <div className="bg-tertiary-container/20 p-4 rounded-lg text-center">
                  <span className="font-label text-sm text-tertiary uppercase tracking-widest">
                    Fired to Kitchen
                  </span>
                </div>
              ) : (
                <>
                  {!posEnabled && data.status === "CONFIRMED" && (
                    <p className="mb-4 text-right text-on-surface-variant text-sm font-label">
                      {POS_DISABLED_NOTE}
                    </p>
                  )}
                  <div className="flex justify-end gap-4">
                    <Button variant="ghost" onClick={onClose}>
                      Close
                    </Button>
                    {data.status === "CONFIRMED" && (
                      <Button
                        disabled={!posEnabled}
                        onClick={() => setShowPin(true)}
                      >
                        Fire to Kitchen
                      </Button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showPin && (
        <PinConfirmDialog
          onConfirm={handleFire}
          onCancel={() => {
            setShowPin(false);
            setPinError("");
          }}
          loading={firing}
          error={pinError}
        />
      )}
    </>
  );
}
