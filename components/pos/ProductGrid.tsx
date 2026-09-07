"use client";

import { useState } from "react";

import { ModifierModal } from "@/components/pos/ModifierModal";
import { getProductPrice, type Product } from "@/types/pos";
import { useCartStore } from "@/store/useCartStore";

interface ProductGridProps {
  products: Product[];
}

const placeholderStyles = [
  "from-orange-100 to-amber-50 text-orange-700",
  "from-emerald-100 to-lime-50 text-emerald-700",
  "from-slate-200 to-zinc-100 text-slate-700",
  "from-yellow-100 to-orange-50 text-yellow-700",
];

const formatPrice = (price: number): string =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(price);

export function ProductGrid({ products }: ProductGridProps) {
  const salesChannel = useCartStore((state) => state.salesChannel);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const activeProducts = products.filter((product) => product.isActive);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 xl:gap-5">
        {activeProducts.map((product, index) => (
          <button
            key={product.id}
            type="button"
            onClick={() => handleProductClick(product)}
            className="group min-h-52 touch-manipulation overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.98] active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`เลือกตัวเลือกสำหรับ ${product.name}`}
          >
            <div
              className={`flex h-28 items-center justify-center bg-gradient-to-br ${placeholderStyles[index % placeholderStyles.length]}`}
            >
              {product.imageUrl ? (
                // A plain img keeps this component independent of remote image config.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background/70 text-3xl shadow-sm">
                  ♨
                </div>
              )}
            </div>

            <div className="flex min-h-24 flex-col justify-between gap-3 p-4 xl:p-5">
              <div>
                <h2 className="line-clamp-2 text-lg font-bold leading-snug">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </div>
              <p className="text-xl font-extrabold text-primary">
                {formatPrice(getProductPrice(product, salesChannel))}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selectedProduct && (
        <ModifierModal
          key={selectedProduct.id}
          product={selectedProduct}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedProduct(null);
            }
          }}
        />
      )}
    </>
  );
}
