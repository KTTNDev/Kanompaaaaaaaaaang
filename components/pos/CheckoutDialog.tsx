"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, QrCode, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCartStore } from "@/store/useCartStore";
import type { Order, PaymentMethod } from "@/types/pos";

const formatPrice = (price: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2 }).format(price);
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const methods: Array<{ value: PaymentMethod; label: string; icon: typeof Wallet }> = [
  { value: "CASH", label: "เงินสด", icon: Wallet },
  { value: "QR", label: "QR", icon: QrCode },
  { value: "CARD", label: "บัตร", icon: CreditCard },
  { value: "OTHER", label: "อื่น ๆ", icon: CreditCard },
];

export function CheckoutDialog({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (open: boolean) => void; settings: { taxRate: number; pricesIncludeTax: boolean; serviceChargeRate: number } }) {
  const cartItems = useCartStore((state) => state.cartItems);
  const salesChannel = useCartStore((state) => state.salesChannel);
  const discount = useCartStore((state) => state.discount);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotals = useCartStore((state) => state.getTotals);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [received, setReceived] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<Order | null>(null);
  const { netTotal } = getTotals();
  const totals = useMemo(() => {
    const service = roundMoney(netTotal * settings.serviceChargeRate / 100);
    const beforeTax = netTotal + service;
    const tax = roundMoney(settings.pricesIncludeTax ? beforeTax - beforeTax / (1 + settings.taxRate / 100 || 1) : beforeTax * settings.taxRate / 100);
    return { service, tax, total: roundMoney(settings.pricesIncludeTax ? beforeTax : beforeTax + tax) };
  }, [netTotal, settings]);
  const change = method === "CASH" ? Math.max(roundMoney(received - totals.total), 0) : 0;

  const close = (next: boolean) => {
    if (!next && saving) return;
    onOpenChange(next);
    if (!next) { setError(""); setCompleted(null); }
  };

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        salesChannel, discountAmount: discount, paymentMethod: method,
        receivedAmount: method === "CASH" ? received : totals.total,
        customerName, customerPhone,
        items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity, modifierItemIds: item.selectedModifiers.map((modifier) => modifier.id), note: item.note ?? undefined })),
      }) });
      const result = await response.json() as Order | { error?: string };
      if (!response.ok) throw new Error("error" in result ? result.error || "บันทึกการขายไม่สำเร็จ" : "บันทึกการขายไม่สำเร็จ");
      setCompleted(result as Order); clearCart();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "บันทึกการขายไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
    {completed ? <div className="py-8 text-center"><CheckCircle2 className="mx-auto size-20 text-emerald-500" /><DialogTitle className="mt-5 text-3xl font-black">ชำระเงินสำเร็จ</DialogTitle><p className="mt-2 font-mono text-sm text-slate-500">{completed.orderNumber}</p><p className="mt-6 text-sm text-slate-500">ยอดรับชำระ</p><p className="text-4xl font-black">{formatPrice(completed.totalAmount)}</p>{completed.paymentMethod === "CASH" && <><p className="mt-5 text-sm text-slate-500">เงินทอน</p><p className="text-3xl font-black text-emerald-600">{formatPrice(completed.changeAmount)}</p></>}<Button className="mt-8 h-14 w-full rounded-xl text-base font-bold" onClick={() => close(false)}>เริ่มออเดอร์ใหม่</Button></div> : <>
      <DialogHeader><DialogTitle className="text-2xl font-black">รับชำระเงิน</DialogTitle><DialogDescription>เลือกวิธีชำระ ตรวจสอบยอด และปิดการขาย</DialogDescription></DialogHeader>
      <div className="grid grid-cols-4 gap-2">{methods.map(({ value, label, icon: Icon }) => <button key={value} onClick={() => { setMethod(value); if (value !== "CASH") setReceived(totals.total); }} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-bold ${method === value ? "border-slate-950 bg-slate-950 text-white" : "bg-white"}`}><Icon className="size-6" />{label}</button>)}</div>
      <div className="rounded-2xl bg-slate-50 p-5"><div className="space-y-2 text-sm"><div className="flex justify-between"><span>ยอดหลังส่วนลด</span><b>{formatPrice(netTotal)}</b></div>{settings.serviceChargeRate > 0 && <div className="flex justify-between"><span>Service {settings.serviceChargeRate}%</span><b>{formatPrice(totals.service)}</b></div>}{settings.taxRate > 0 && <div className="flex justify-between"><span>ภาษี {settings.taxRate}%{settings.pricesIncludeTax ? " (รวมแล้ว)" : ""}</span><b>{formatPrice(totals.tax)}</b></div>}<div className="flex justify-between border-t pt-3 text-xl"><span className="font-black">ยอดชำระ</span><b className="text-2xl">{formatPrice(totals.total)}</b></div></div></div>
      {method === "CASH" && <div><label className="text-sm font-bold">รับเงินมา</label><input autoFocus type="number" min="0" step="1" value={received || ""} onChange={(event) => setReceived(Number(event.target.value))} className="mt-2 h-16 w-full rounded-2xl border px-4 text-right text-2xl font-black outline-none focus:border-slate-950" /><div className="mt-2 grid grid-cols-4 gap-2">{[totals.total, Math.ceil(totals.total / 100) * 100, 500, 1000].filter((value, index, values) => value >= totals.total && values.indexOf(value) === index).map((value) => <button key={value} onClick={() => setReceived(value)} className="min-h-12 rounded-xl bg-slate-100 font-bold">{value}</button>)}</div><p className="mt-4 text-right text-lg font-bold">เงินทอน <span className="text-2xl text-emerald-600">{formatPrice(change)}</span></p></div>}
      <details className="rounded-2xl border p-4"><summary className="cursor-pointer font-bold">ข้อมูลลูกค้า (ไม่บังคับ)</summary><div className="mt-4 grid grid-cols-2 gap-3"><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="ชื่อลูกค้า" className="h-12 rounded-xl border px-3" /><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="เบอร์โทร" className="h-12 rounded-xl border px-3" /></div></details>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <Button disabled={saving || cartItems.length === 0 || (method === "CASH" && received < totals.total)} onClick={submit} className="h-16 w-full rounded-2xl text-lg font-black">{saving ? "กำลังบันทึก..." : `ยืนยันรับชำระ ${formatPrice(totals.total)}`}</Button>
    </>}
  </DialogContent></Dialog>;
}
