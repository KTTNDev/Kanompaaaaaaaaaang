"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  CirclePlus,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category, Product } from "@/types/pos";

interface ProductManagerProps {
  initialProducts: Product[];
  categories: Category[];
}

interface ModifierItemDraft {
  name: string;
  extraPriceStore: number;
  extraPriceApp: number;
  extraCost: number;
  isActive: boolean;
}

interface ModifierGroupDraft {
  name: string;
  isRequired: boolean;
  maxSelect: number;
  items: ModifierItemDraft[];
}

interface ProductDraft {
  sku: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  basePriceStore: number;
  basePriceApp: number;
  baseCost: number;
  isActive: boolean;
  modifierGroups: ModifierGroupDraft[];
}

const emptyDraft = (): ProductDraft => ({
  sku: "",
  categoryId: "",
  name: "",
  description: "",
  imageUrl: "",
  basePriceStore: 0,
  basePriceApp: 0,
  baseCost: 0,
  isActive: true,
  modifierGroups: [],
});

const toDraft = (product: Product): ProductDraft => ({
  sku: product.sku ?? "",
  categoryId: product.categoryId ?? "",
  name: product.name,
  description: product.description ?? "",
  imageUrl: product.imageUrl ?? "",
  basePriceStore: product.basePriceStore,
  basePriceApp: product.basePriceApp,
  baseCost: product.baseCost,
  isActive: product.isActive,
  modifierGroups: product.modifierGroups.map((group) => ({
    name: group.name,
    isRequired: group.isRequired,
    maxSelect: group.maxSelect,
    items: group.items.map((item) => ({
      name: item.name,
      extraPriceStore: item.extraPriceStore,
      extraPriceApp: item.extraPriceApp,
      extraCost: item.extraCost,
      isActive: item.isActive,
    })),
  })),
});

const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

export function ProductManager({ initialProducts, categories }: ProductManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredProducts = useMemo(
    () =>
      initialProducts.filter((product) => {
        const matches = `${product.name} ${product.sku ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matches && (showInactive || product.isActive);
      }),
    [initialProducts, query, showInactive],
  );

  const openEditor = (product?: Product) => {
    setEditingProduct(product ?? null);
    setDraft(product ? toDraft(product) : emptyDraft());
    setError("");
    setOpen(true);
  };

  const updateGroup = (index: number, patch: Partial<ModifierGroupDraft>) => {
    setDraft((current) => ({
      ...current,
      modifierGroups: current.modifierGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...patch } : group,
      ),
    }));
  };

  const updateModifier = (
    groupIndex: number,
    itemIndex: number,
    patch: Partial<ModifierItemDraft>,
  ) => {
    const group = draft.modifierGroups[groupIndex];
    updateGroup(groupIndex, {
      items: group.items.map((item, index) =>
        index === itemIndex ? { ...item, ...patch } : item,
      ),
    });
  };

  const saveProduct = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingProduct ? `/api/products/${editingProduct.id}` : "/api/products",
        {
          method: editingProduct ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกสินค้าไม่สำเร็จ");
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกสินค้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async (product: Product) => {
    if (!window.confirm(`ปิดการขาย “${product.name}” หรือไม่? ประวัติการขายเดิมจะยังอยู่`)) return;
    await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <AppShell
      title="สินค้าและราคา"
      description="จัดการสินค้า ต้นทุน ราคาแต่ละช่องทาง และตัวเลือกเพิ่มเติม"
      actions={
        <Button onClick={() => openEditor()} className="h-12 rounded-xl px-5 text-base font-bold">
          <Plus className="size-5" /> เพิ่มสินค้า
        </Button>
      }
    >
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full max-w-md">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรือ SKU" className={`${inputClass} pl-12`} />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-bold">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="size-5 accent-slate-950" />
            แสดงสินค้าปิดขาย
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">สินค้า</th><th className="px-4 py-4">หมวด</th><th className="px-4 py-4 text-right">ต้นทุน</th><th className="px-4 py-4 text-right">หน้าร้าน</th><th className="px-4 py-4 text-right">แอป</th><th className="px-4 py-4 text-right">Margin</th><th className="px-5 py-4 text-right">จัดการ</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const margin = product.basePriceStore ? ((product.basePriceStore - product.baseCost) / product.basePriceStore) * 100 : 0;
                return (
                  <tr key={product.id} className={!product.isActive ? "opacity-50" : ""}>
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-xl">♨</div><div><p className="font-bold">{product.name}</p><p className="text-xs text-slate-400">{product.sku || "ไม่มี SKU"} · {product.modifierGroups.length} กลุ่มตัวเลือก</p></div></div></td>
                    <td className="px-4 py-4 text-slate-600">{product.category?.name ?? "ไม่ระบุ"}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{money(product.baseCost)}</td>
                    <td className="px-4 py-4 text-right font-bold tabular-nums">{money(product.basePriceStore)}</td>
                    <td className="px-4 py-4 text-right font-bold tabular-nums">{money(product.basePriceApp)}</td>
                    <td className="px-4 py-4 text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${margin >= 60 ? "bg-emerald-100 text-emerald-700" : margin >= 40 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{margin.toFixed(1)}%</span></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEditor(product)} className="flex size-11 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50" aria-label={`แก้ไข ${product.name}`}><Pencil className="size-4" /></button>{product.isActive && <button onClick={() => archiveProduct(product)} className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50" aria-label={`ปิดขาย ${product.name}`}><Archive className="size-4" /></button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[94dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <DialogTitle className="text-2xl font-black">{editingProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
            <DialogDescription>กำหนดราคา ต้นทุน และ modifier ทุกช่องทางในที่เดียว</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-2"><span className="text-sm font-bold">ชื่อสินค้า *</span><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label className="space-y-2"><span className="text-sm font-bold">SKU</span><input className={inputClass} value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></label>
              <label className="space-y-2"><span className="text-sm font-bold">หมวดสินค้า</span><div className="relative"><select className={`${inputClass} appearance-none pr-10`} value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}><option value="">ไม่ระบุ</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" /></div></label>
              <label className="space-y-2"><span className="text-sm font-bold">ราคาหน้าร้าน *</span><input type="number" min="0" step="0.01" className={inputClass} value={draft.basePriceStore} onChange={(e) => setDraft({ ...draft, basePriceStore: Number(e.target.value) })} /></label>
              <label className="space-y-2"><span className="text-sm font-bold">ราคาแอป *</span><input type="number" min="0" step="0.01" className={inputClass} value={draft.basePriceApp} onChange={(e) => setDraft({ ...draft, basePriceApp: Number(e.target.value) })} /></label>
              <label className="space-y-2"><span className="text-sm font-bold">ต้นทุนต่อหน่วย *</span><input type="number" min="0" step="0.01" className={inputClass} value={draft.baseCost} onChange={(e) => setDraft({ ...draft, baseCost: Number(e.target.value) })} /></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-bold">คำอธิบาย</span><input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
              <label className="flex min-h-12 items-center gap-3 self-end rounded-xl border border-slate-200 px-4"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="size-5 accent-slate-950" /><span className="font-bold">เปิดขาย</span></label>
            </div>

            <div className="mt-8 flex items-center justify-between"><div><h3 className="text-lg font-black">กลุ่มตัวเลือก</h3><p className="text-sm text-slate-500">เช่น เลือกไส้ หรือเพิ่มท็อปปิง</p></div><Button variant="outline" onClick={() => setDraft({ ...draft, modifierGroups: [...draft.modifierGroups, { name: "", isRequired: false, maxSelect: 1, items: [] }] })} className="h-11 rounded-xl"><CirclePlus className="size-4" /> เพิ่มกลุ่ม</Button></div>

            <div className="mt-4 space-y-4">
              {draft.modifierGroups.map((group, groupIndex) => (
                <section key={groupIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_130px_auto_auto] sm:items-end">
                    <label className="space-y-2"><span className="text-xs font-bold text-slate-500">ชื่อกลุ่ม</span><input className={inputClass} value={group.name} onChange={(e) => updateGroup(groupIndex, { name: e.target.value })} /></label>
                    <label className="space-y-2"><span className="text-xs font-bold text-slate-500">เลือกสูงสุด</span><input type="number" min="1" className={inputClass} value={group.maxSelect} onChange={(e) => updateGroup(groupIndex, { maxSelect: Number(e.target.value) })} /></label>
                    <label className="flex h-12 items-center gap-2 px-2"><input type="checkbox" checked={group.isRequired} onChange={(e) => updateGroup(groupIndex, { isRequired: e.target.checked })} className="size-5 accent-slate-950" /><span className="font-bold">บังคับเลือก</span></label>
                    <button onClick={() => setDraft({ ...draft, modifierGroups: draft.modifierGroups.filter((_, index) => index !== groupIndex) })} className="flex size-12 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-100" aria-label="ลบกลุ่ม"><Trash2 className="size-5" /></button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {group.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-center">
                        <input aria-label="ชื่อตัวเลือก" placeholder="ชื่อตัวเลือก" className={inputClass} value={item.name} onChange={(e) => updateModifier(groupIndex, itemIndex, { name: e.target.value })} />
                        <input aria-label="ราคาเพิ่มหน้าร้าน" title="ราคาเพิ่มหน้าร้าน" type="number" min="0" placeholder="เพิ่มหน้าร้าน" className={inputClass} value={item.extraPriceStore} onChange={(e) => updateModifier(groupIndex, itemIndex, { extraPriceStore: Number(e.target.value) })} />
                        <input aria-label="ราคาเพิ่มแอป" title="ราคาเพิ่มแอป" type="number" min="0" placeholder="เพิ่มแอป" className={inputClass} value={item.extraPriceApp} onChange={(e) => updateModifier(groupIndex, itemIndex, { extraPriceApp: Number(e.target.value) })} />
                        <input aria-label="ต้นทุนตัวเลือก" title="ต้นทุนตัวเลือก" type="number" min="0" placeholder="ต้นทุน" className={inputClass} value={item.extraCost} onChange={(e) => updateModifier(groupIndex, itemIndex, { extraCost: Number(e.target.value) })} />
                        <button onClick={() => updateGroup(groupIndex, { items: group.items.filter((_, index) => index !== itemIndex) })} className="flex size-11 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50" aria-label="ลบตัวเลือก"><X className="size-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => updateGroup(groupIndex, { items: [...group.items, { name: "", extraPriceStore: 0, extraPriceApp: 0, extraCost: 0, isActive: true }] })} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-white"><Plus className="size-4" /> เพิ่มตัวเลือก</button>
                  </div>
                </section>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-200 bg-white p-5">
            {error && <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setOpen(false)} className="h-12 rounded-xl px-5">ยกเลิก</Button><Button disabled={saving} onClick={saveProduct} className="h-12 rounded-xl px-6 text-base font-bold"><Save className="size-5" /> {saving ? "กำลังบันทึก..." : "บันทึกสินค้า"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
