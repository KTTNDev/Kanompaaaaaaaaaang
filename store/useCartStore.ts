"use client";

import { create } from "zustand";

import {
  getModifierPrice,
  getProductPrice,
  type CartItem,
  type ModifierItem,
  type Product,
  type SalesChannel,
} from "@/types/pos";

export interface CartTotals {
  subTotal: number;
  discount: number;
  netTotal: number;
}

interface CartStore {
  cartItems: CartItem[];
  salesChannel: SalesChannel;
  /** Fixed discount amount in the shop's currency, not a percentage. */
  discount: number;
  setSalesChannel: (channel: SalesChannel) => void;
  addToCart: (
    product: Product,
    selectedModifiers: ModifierItem[],
    quantity?: number,
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  setDiscount: (discount: number) => void;
  clearCart: () => void;
  getTotals: () => CartTotals;
}

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normaliseQuantity = (quantity: number): number =>
  Number.isFinite(quantity) ? Math.trunc(quantity) : 0;

const normaliseModifiers = (modifiers: ModifierItem[]): ModifierItem[] =>
  [...new Map(modifiers.map((modifier) => [modifier.id, modifier])).values()].sort(
    (a, b) => a.id.localeCompare(b.id),
  );

const createCartItemId = (
  productId: string,
  selectedModifiers: ModifierItem[],
): string =>
  [productId, ...selectedModifiers.map((modifier) => modifier.id)].join("::");

const calculateCartItem = (
  item: Pick<CartItem, "cartItemId" | "product" | "selectedModifiers" | "quantity" | "note">,
  salesChannel: SalesChannel,
): CartItem => {
  const unitBasePrice = getProductPrice(item.product, salesChannel);
  const modifierUnitTotal = roundMoney(
    item.selectedModifiers.reduce(
      (total, modifier) => total + getModifierPrice(modifier, salesChannel),
      0,
    ),
  );
  const unitPrice = roundMoney(unitBasePrice + modifierUnitTotal);

  return {
    ...item,
    unitBasePrice,
    modifierUnitTotal,
    unitPrice,
    lineTotal: roundMoney(unitPrice * item.quantity),
  };
};

const calculateSubTotal = (cartItems: CartItem[]): number =>
  roundMoney(cartItems.reduce((total, item) => total + item.lineTotal, 0));

const clampDiscount = (discount: number, subTotal: number): number =>
  roundMoney(Math.min(Math.max(discount, 0), subTotal));

export const useCartStore = create<CartStore>((set, get) => ({
  cartItems: [],
  salesChannel: "STORE",
  discount: 0,

  setSalesChannel: (salesChannel) => {
    set((state) => {
      if (state.salesChannel === salesChannel) {
        return state;
      }

      const cartItems = state.cartItems.map((item) =>
        calculateCartItem(item, salesChannel),
      );

      return {
        salesChannel,
        cartItems,
        discount: clampDiscount(state.discount, calculateSubTotal(cartItems)),
      };
    });
  },

  addToCart: (product, selectedModifiers, quantity = 1) => {
    const safeQuantity = normaliseQuantity(quantity);

    if (safeQuantity <= 0) {
      return;
    }

    set((state) => {
      const modifiers = normaliseModifiers(selectedModifiers);
      const cartItemId = createCartItemId(product.id, modifiers);
      const existingItem = state.cartItems.find(
        (item) => item.cartItemId === cartItemId,
      );

      if (existingItem) {
        return {
          cartItems: state.cartItems.map((item) =>
            item.cartItemId === cartItemId
              ? calculateCartItem(
                  {
                    ...item,
                    product,
                    selectedModifiers: modifiers,
                    quantity: item.quantity + safeQuantity,
                  },
                  state.salesChannel,
                )
              : item,
          ),
        };
      }

      const newItem = calculateCartItem(
        {
          cartItemId,
          product,
          selectedModifiers: modifiers,
          quantity: safeQuantity,
          note: null,
        },
        state.salesChannel,
      );

      return { cartItems: [...state.cartItems, newItem] };
    });
  },

  removeFromCart: (cartItemId) => {
    set((state) => {
      const cartItems = state.cartItems.filter(
        (item) => item.cartItemId !== cartItemId,
      );

      return {
        cartItems,
        discount: clampDiscount(state.discount, calculateSubTotal(cartItems)),
      };
    });
  },

  updateQuantity: (cartItemId, quantity) => {
    const safeQuantity = normaliseQuantity(quantity);

    set((state) => {
      const cartItems =
        safeQuantity <= 0
          ? state.cartItems.filter((item) => item.cartItemId !== cartItemId)
          : state.cartItems.map((item) =>
              item.cartItemId === cartItemId
                ? calculateCartItem(
                    { ...item, quantity: safeQuantity },
                    state.salesChannel,
                  )
                : item,
            );

      return {
        cartItems,
        discount: clampDiscount(state.discount, calculateSubTotal(cartItems)),
      };
    });
  },

  setDiscount: (discount) => {
    set((state) => ({
      discount: clampDiscount(discount, calculateSubTotal(state.cartItems)),
    }));
  },

  clearCart: () => set({ cartItems: [], discount: 0 }),

  getTotals: () => {
    const { cartItems, discount } = get();
    const subTotal = calculateSubTotal(cartItems);
    const effectiveDiscount = clampDiscount(discount, subTotal);

    return {
      subTotal,
      discount: effectiveDiscount,
      netTotal: roundMoney(subTotal - effectiveDiscount),
    };
  },
}));
