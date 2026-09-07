"use client";

import { useState } from "react";

import { CheckoutDialog } from "@/components/pos/CheckoutDialog";
import { useCartStore } from "@/store/useCartStore";
import type { SalesChannel } from "@/types/pos";

const formatPrice = (price: number): string =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(price);

const channels: Array<{ value: SalesChannel; label: string }> = [
  { value: "STORE", label: "Store Price" },
  { value: "APP", label: "App Price" },
];

interface CartSidebarProps {
  settings: { taxRate: number; pricesIncludeTax: boolean; serviceChargeRate: number };
}

export function CartSidebar({ settings }: CartSidebarProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const cartItems = useCartStore((state) => state.cartItems);
  const salesChannel = useCartStore((state) => state.salesChannel);
  const discount = useCartStore((state) => state.discount);
  const setSalesChannel = useCartStore((state) => state.setSalesChannel);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotals = useCartStore((state) => state.getTotals);
  const { subTotal, netTotal } = getTotals();

  return (
    <aside className="flex min-h-0 flex-col border-l bg-background shadow-[-8px_0_24px_rgba(15,23,42,0.04)]">
      <div className="border-b p-5 xl:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Current order</p>
            <h2 className="text-2xl font-bold">ตะกร้าสินค้า</h2>
          </div>
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10 active:scale-95"
            >
              ล้างตะกร้า
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-xl bg-muted p-1.5">
          {channels.map((channel) => {
            const isActive = salesChannel === channel.value;

            return (
              <button
                key={channel.value}
                type="button"
                onClick={() => setSalesChannel(channel.value)}
                aria-pressed={isActive}
                className={`min-h-12 rounded-lg px-3 text-sm font-bold transition active:scale-[0.98] ${
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {channel.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 xl:p-5">
        {cartItems.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-3xl">
              ♨
            </div>
            <h3 className="mt-5 text-lg font-bold">ยังไม่มีสินค้าในตะกร้า</h3>
            <p className="mt-1 max-w-56 text-sm leading-6 text-muted-foreground">
              แตะรายการสินค้าทางด้านซ้ายเพื่อเริ่มรับออเดอร์
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cartItems.map((item) => (
              <article
                key={item.cartItemId}
                className="rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold leading-snug">{item.product.name}</h3>
                    {item.selectedModifiers.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.selectedModifiers
                          .map((modifier) => modifier.name)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-95"
                    aria-label={`ลบ ${item.product.name}`}
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-xl border bg-background p-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.cartItemId, item.quantity - 1)
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-xl font-bold transition hover:bg-muted active:scale-90"
                      aria-label={`ลดจำนวน ${item.product.name}`}
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-base font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.cartItemId, item.quantity + 1)
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-xl font-bold transition hover:bg-muted active:scale-90"
                      aria-label={`เพิ่มจำนวน ${item.product.name}`}
                    >
                      +
                    </button>
                  </div>
                  <p className="text-lg font-extrabold tabular-nums">
                    {formatPrice(item.lineTotal)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="border-t bg-background p-5 xl:p-6">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <dt>ยอดรวมสินค้า</dt>
            <dd className="font-semibold tabular-nums">{formatPrice(subTotal)}</dd>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <dt>ส่วนลด</dt>
            <dd className="font-semibold tabular-nums">− {formatPrice(discount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <dt>กำหนดส่วนลด</dt>
            <dd><input aria-label="ส่วนลด" type="number" min="0" step="1" value={discount || ""} placeholder="0" onChange={(event) => useCartStore.getState().setDiscount(Number(event.target.value))} className="h-11 w-28 rounded-xl border bg-white px-3 text-right font-bold outline-none focus:border-slate-950" /></dd>
          </div>
          <div className="flex items-end justify-between border-t pt-4">
            <dt className="text-base font-bold">ยอดสุทธิ</dt>
            <dd className="text-3xl font-black tracking-tight text-primary tabular-nums">
              {formatPrice(netTotal)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          disabled={cartItems.length === 0}
          onClick={() => setCheckoutOpen(true)}
          className="mt-5 min-h-16 w-full rounded-2xl bg-primary px-6 text-lg font-extrabold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ชำระเงิน · {formatPrice(netTotal)}
        </button>
      </div>
      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} settings={settings} />
    </aside>
  );
}
