"use client";

import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  getModifierPrice,
  getProductPrice,
  type ModifierGroup,
  type Product,
} from "@/types/pos";
import { useCartStore } from "@/store/useCartStore";

interface ModifierModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModifierSelections = Record<string, string[]>;

const formatPrice = (price: number): string =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(price);

const getMaxSelect = (group: ModifierGroup): number =>
  Math.max(1, group.maxSelect);

export function ModifierModal({
  product,
  open,
  onOpenChange,
}: ModifierModalProps) {
  const [selections, setSelections] = useState<ModifierSelections>({});
  const salesChannel = useCartStore((state) => state.salesChannel);
  const addToCart = useCartStore((state) => state.addToCart);

  const groups = useMemo(
    () =>
      (product?.modifierGroups ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [product],
  );

  const selectedModifiers = useMemo(() => {
    const selectedIds = new Set(Object.values(selections).flat());

    return groups.flatMap((group) =>
      group.items
        .filter((item) => item.isActive && selectedIds.has(item.id))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }, [groups, selections]);

  const requiredGroupsComplete = groups.every(
    (group) => !group.isRequired || (selections[group.id]?.length ?? 0) > 0,
  );

  const itemTotal = product
    ? getProductPrice(product, salesChannel) +
      selectedModifiers.reduce(
        (total, item) => total + getModifierPrice(item, salesChannel),
        0,
      )
    : 0;

  const selectSingleItem = (groupId: string, itemId: string) => {
    setSelections((current) => ({ ...current, [groupId]: [itemId] }));
  };

  const toggleMultipleItem = (
    group: ModifierGroup,
    itemId: string,
    checked: boolean,
  ) => {
    setSelections((current) => {
      const selected = current[group.id] ?? [];

      if (!checked) {
        return {
          ...current,
          [group.id]: selected.filter((id) => id !== itemId),
        };
      }

      if (selected.includes(itemId) || selected.length >= getMaxSelect(group)) {
        return current;
      }

      return { ...current, [group.id]: [...selected, itemId] };
    });
  };

  const handleAddToCart = () => {
    if (!product || !requiredGroupsComplete) {
      return;
    }

    addToCart(product, selectedModifiers, 1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[min(92vw,720px)] max-w-3xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pb-5 pt-6 text-left sm:px-8 sm:pt-8">
          <DialogTitle className="pr-8 text-2xl font-extrabold leading-tight">
            {product?.name ?? "เลือกตัวเลือกสินค้า"}
          </DialogTitle>
          <DialogDescription className="text-base">
            เลือกไส้และท็อปปิงที่ต้องการ รายการที่มีเครื่องหมาย * จำเป็นต้องเลือก
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/40 px-5 py-8 text-center">
              <p className="font-semibold">เมนูนี้ไม่มีตัวเลือกเพิ่มเติม</p>
              <p className="mt-1 text-sm text-muted-foreground">
                สามารถเพิ่มสินค้าลงตะกร้าได้ทันที
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const activeItems = group.items
                .filter((item) => item.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const selected = selections[group.id] ?? [];
              const maxSelect = getMaxSelect(group);
              const limitReached = selected.length >= maxSelect;

              return (
                <section key={group.id} aria-labelledby={`group-${group.id}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 id={`group-${group.id}`} className="text-lg font-bold">
                        {group.name}
                      </h3>
                      {group.isRequired && (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
                          จำเป็น
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      เลือกได้สูงสุด {maxSelect}
                    </span>
                  </div>

                  {activeItems.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      ยังไม่มีตัวเลือกที่พร้อมขายในกลุ่มนี้
                    </p>
                  ) : maxSelect === 1 ? (
                    <RadioGroup
                      value={selected[0] ?? ""}
                      onValueChange={(itemId) => selectSingleItem(group.id, itemId)}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {activeItems.map((item) => {
                        const inputId = `${group.id}-${item.id}`;
                        const extraPrice = getModifierPrice(item, salesChannel);

                        return (
                          <Label
                            key={item.id}
                            htmlFor={inputId}
                            className="flex min-h-16 cursor-pointer touch-manipulation items-center gap-4 rounded-2xl border bg-card px-4 py-3 text-base transition hover:bg-accent has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-checked:ring-1 has-data-checked:ring-primary"
                          >
                            <RadioGroupItem
                              id={inputId}
                              value={item.id}
                              className="h-6 w-6 shrink-0"
                            />
                            <span className="min-w-0 flex-1 font-semibold">
                              {item.name}
                            </span>
                            <span className="shrink-0 font-bold text-primary">
                              {extraPrice > 0 ? `+${formatPrice(extraPrice)}` : "ฟรี"}
                            </span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {activeItems.map((item) => {
                        const inputId = `${group.id}-${item.id}`;
                        const isChecked = selected.includes(item.id);
                        const isDisabled = limitReached && !isChecked;
                        const extraPrice = getModifierPrice(item, salesChannel);

                        return (
                          <Label
                            key={item.id}
                            htmlFor={inputId}
                            aria-disabled={isDisabled}
                            className={`flex min-h-16 touch-manipulation items-center gap-4 rounded-2xl border bg-card px-4 py-3 text-base transition has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-checked:ring-1 has-data-checked:ring-primary ${
                              isDisabled
                                ? "cursor-not-allowed opacity-45"
                                : "cursor-pointer hover:bg-accent"
                            }`}
                          >
                            <Checkbox
                              id={inputId}
                              checked={isChecked}
                              disabled={isDisabled}
                              onCheckedChange={(checked) =>
                                toggleMultipleItem(group, item.id, checked === true)
                              }
                              className="h-6 w-6 shrink-0"
                            />
                            <span className="min-w-0 flex-1 font-semibold">
                              {item.name}
                            </span>
                            <span className="shrink-0 font-bold text-primary">
                              {extraPrice > 0 ? `+${formatPrice(extraPrice)}` : "ฟรี"}
                            </span>
                          </Label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        <div className="border-t bg-background px-6 py-5 sm:px-8">
          {!requiredGroupsComplete && (
            <p className="mb-3 text-center text-sm font-semibold text-destructive">
              กรุณาเลือกตัวเลือกในกลุ่มที่จำเป็นให้ครบ
            </p>
          )}
          <button
            type="button"
            disabled={!product || !requiredGroupsComplete}
            onClick={handleAddToCart}
            className="min-h-16 w-full touch-manipulation rounded-2xl bg-primary px-6 text-lg font-extrabold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            เพิ่มลงตะกร้า · {formatPrice(itemTotal)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
