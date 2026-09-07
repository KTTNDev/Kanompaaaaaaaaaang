"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  CirclePlus,
  PackageMinus,
  PackagePlus,
  Search,
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
import {
  WASTE_REASONS,
  type InventoryItem,
  type WasteReason,
  type WasteRecord,
} from "@/types/pos";

interface InventoryManagerProps {
  initialItems: InventoryItem[];
  initialWaste: WasteRecord[];
}

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(value);

const number = (value: number) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);

const reasonLabels: Record<WasteReason, string> = {
  EXPIRED: "หมดอายุ",
  DAMAGED: "เสียหาย",
  PREPARATION: "เสียระหว่างเตรียม",
  UNSOLD: "ขายไม่หมด",
  QUALITY: "ไม่ผ่านคุณภาพ",
  OTHER: "อื่น ๆ",
};

export function InventoryManager({ initialItems, initialWaste }: InventoryManagerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"STOCK" | "WASTE">("STOCK");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"ADD" | "ADJUST" | "WASTE" | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "ชิ้น",
    currentStock: 0,
    minStock: 0,
    unitCost: 0,
    stockDelta: 0,
    reason: "UNSOLD" as WasteReason,
    quantity: 1,
    note: "",
  });

  const filteredItems = useMemo(
    () => initialItems.filter((item) => `${item.name} ${item.sku ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [initialItems, query],
  );
  const stockValue = initialItems.reduce((sum, item) => sum + item.stockValue, 0);
  const lowStockCount = initialItems.filter((item) => item.isLowStock).length;
  const wasteCost = initialWaste.reduce((sum, record) => sum + record.totalCost, 0);

  const openAdd = () => {
    setSelectedItem(null);
    setForm({ ...form, name: "", sku: "", unit: "ชิ้น", currentStock: 0, minStock: 0, unitCost: 0, note: "" });
    setError("");
    setDialog("ADD");
  };

  const openAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setForm({ ...form, unitCost: item.unitCost, stockDelta: 0, note: "" });
    setError("");
    setDialog("ADJUST");
  };

  const openWaste = (item?: InventoryItem) => {
    const target = item ?? initialItems[0] ?? null;
    setSelectedItem(target);
    setForm({ ...form, quantity: 1, reason: "UNSOLD", note: "" });
    setError("");
    setDialog("WASTE");
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      let url = "/api/inventory";
      let method = "POST";
      let body: Record<string, unknown> = form;
      if (dialog === "ADJUST" && selectedItem) {
        url = `/api/inventory/${selectedItem.id}`;
        method = "PATCH";
        body = { stockDelta: form.stockDelta, unitCost: form.unitCost, note: form.note };
      } else if (dialog === "WASTE" && selectedItem) {
        url = "/api/waste";
        body = { inventoryItemId: selectedItem.id, quantity: form.quantity, reason: form.reason, note: form.note };
      }
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      setDialog(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="สต็อกและของเสีย"
      description="รู้มูลค่าสต็อก จุดสั่งซื้อ และต้นทุนที่สูญเสียจริง"
      actions={<Button onClick={openAdd} className="h-12 rounded-xl px-5 text-base font-bold"><CirclePlus className="size-5" /> เพิ่มวัตถุดิบ</Button>}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Boxes className="size-6" /></div><div><p className="text-sm text-slate-500">มูลค่าสต็อกปัจจุบัน</p><p className="text-2xl font-black">{money(stockValue)}</p></div></div></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><AlertTriangle className="size-6" /></div><div><p className="text-sm text-slate-500">ต้องสั่งซื้อเพิ่ม</p><p className="text-2xl font-black">{lowStockCount} รายการ</p></div></div></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><div className="rounded-2xl bg-rose-50 p-3 text-rose-600"><PackageMinus className="size-6" /></div><div><p className="text-sm text-slate-500">มูลค่าของเสียที่บันทึก</p><p className="text-2xl font-black">{money(wasteCost)}</p></div></div></article>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl bg-slate-100 p-1"><button onClick={() => setTab("STOCK")} className={`min-h-11 rounded-lg px-5 text-sm font-bold ${tab === "STOCK" ? "bg-white shadow-sm" : "text-slate-500"}`}>สต็อกคงเหลือ</button><button onClick={() => setTab("WASTE")} className={`min-h-11 rounded-lg px-5 text-sm font-bold ${tab === "WASTE" ? "bg-white shadow-sm" : "text-slate-500"}`}>ประวัติของเสีย</button></div>
          {tab === "STOCK" ? <label className="relative block w-full max-w-sm"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-12`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาวัตถุดิบ" /></label> : <Button variant="outline" onClick={() => openWaste()} className="h-11 rounded-xl"><PackageMinus className="size-4" /> บันทึกของเสีย</Button>}
        </div>

        {tab === "STOCK" ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-4">วัตถุดิบ</th><th className="px-4 py-4 text-right">คงเหลือ</th><th className="px-4 py-4 text-right">จุดสั่งซื้อ</th><th className="px-4 py-4 text-right">ต้นทุน/หน่วย</th><th className="px-4 py-4 text-right">มูลค่า</th><th className="px-5 py-4 text-right">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredItems.map((item) => <tr key={item.id} className={item.isLowStock ? "bg-amber-50/60" : ""}><td className="px-5 py-4"><p className="font-bold">{item.name}</p><p className="text-xs text-slate-400">{item.sku || "ไม่มี SKU"}</p></td><td className={`px-4 py-4 text-right text-lg font-black tabular-nums ${item.isLowStock ? "text-amber-700" : ""}`}>{number(item.currentStock)} <span className="text-xs font-medium">{item.unit}</span></td><td className="px-4 py-4 text-right tabular-nums">{number(item.minStock)} {item.unit}</td><td className="px-4 py-4 text-right tabular-nums">{money(item.unitCost)}</td><td className="px-4 py-4 text-right font-bold tabular-nums">{money(item.stockValue)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openAdjust(item)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 font-bold hover:bg-slate-50"><PackagePlus className="size-4" /> รับเข้า/ปรับ</button><button onClick={() => openWaste(item)} className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-3 font-bold text-rose-700 hover:bg-rose-50"><PackageMinus className="size-4" /> ของเสีย</button></div></td></tr>)}</tbody></table></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-4">วันเวลา</th><th className="px-4 py-4">รายการ</th><th className="px-4 py-4">สาเหตุ</th><th className="px-4 py-4 text-right">จำนวน</th><th className="px-5 py-4 text-right">มูลค่าเสียหาย</th></tr></thead><tbody className="divide-y divide-slate-100">{initialWaste.map((record) => <tr key={record.id}><td className="px-5 py-4 text-slate-500">{new Date(record.createdAt).toLocaleString("th-TH")}</td><td className="px-4 py-4"><p className="font-bold">{record.itemName}</p><p className="text-xs text-slate-400">{record.note || "-"}</p></td><td className="px-4 py-4"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{reasonLabels[record.reason]}</span></td><td className="px-4 py-4 text-right">{number(record.quantity)} {record.unit}</td><td className="px-5 py-4 text-right font-black text-rose-700">{money(record.totalCost)}</td></tr>)}</tbody></table></div>
        )}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(isOpen) => !isOpen && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle className="text-2xl font-black">{dialog === "ADD" ? "เพิ่มวัตถุดิบ" : dialog === "ADJUST" ? `ปรับสต็อก · ${selectedItem?.name}` : `บันทึกของเสีย · ${selectedItem?.name ?? "เลือกวัตถุดิบ"}`}</DialogTitle><DialogDescription>{dialog === "WASTE" ? "จำนวนนี้จะถูกหักออกจากสต็อกและนำไปคำนวณกำไรสุทธิ" : "ทุกการรับเข้าและปรับยอดจะมีประวัติย้อนหลัง"}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            {dialog === "ADD" && <><label className="space-y-2"><span className="text-sm font-bold">ชื่อวัตถุดิบ *</span><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2"><span className="text-sm font-bold">SKU</span><input className={inputClass} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><label className="space-y-2"><span className="text-sm font-bold">หน่วย *</span><input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label><label className="space-y-2"><span className="text-sm font-bold">ยอดตั้งต้น</span><input type="number" min="0" className={inputClass} value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} /></label><label className="space-y-2"><span className="text-sm font-bold">จุดสั่งซื้อ</span><input type="number" min="0" className={inputClass} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} /></label></div></>}
            {dialog === "ADJUST" && <label className="space-y-2"><span className="text-sm font-bold">จำนวนที่เปลี่ยน</span><input type="number" step="0.01" className={inputClass} value={form.stockDelta} onChange={(e) => setForm({ ...form, stockDelta: Number(e.target.value) })} /><p className="text-xs text-slate-500">ใช้ค่าบวกเมื่อรับเข้า และค่าลบเมื่อลดยอด</p></label>}
            {dialog === "WASTE" && <><label className="space-y-2"><span className="text-sm font-bold">วัตถุดิบ</span><select className={inputClass} value={selectedItem?.id ?? ""} onChange={(e) => setSelectedItem(initialItems.find((item) => item.id === e.target.value) ?? null)}>{initialItems.map((item) => <option key={item.id} value={item.id}>{item.name} · เหลือ {number(item.currentStock)} {item.unit}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2"><span className="text-sm font-bold">จำนวนเสีย *</span><input type="number" min="0.01" step="0.01" className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label><label className="space-y-2"><span className="text-sm font-bold">สาเหตุ</span><select className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as WasteReason })}>{WASTE_REASONS.map((reason) => <option key={reason} value={reason}>{reasonLabels[reason]}</option>)}</select></label></div></>}
            <label className="space-y-2"><span className="text-sm font-bold">ต้นทุนต่อหน่วย</span><input type="number" min="0" step="0.01" disabled={dialog === "WASTE"} className={`${inputClass} disabled:bg-slate-100`} value={dialog === "WASTE" ? selectedItem?.unitCost ?? 0 : form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} /></label>
            <label className="space-y-2"><span className="text-sm font-bold">หมายเหตุ</span><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
          </div>
          <Button disabled={saving || (dialog === "WASTE" && !selectedItem)} onClick={submit} className="h-14 w-full rounded-xl text-base font-bold">{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
