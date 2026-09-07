"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, WalletCards } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from "@/types/pos";

const labels: Record<ExpenseCategory, string> = {
  INGREDIENT: "วัตถุดิบ",
  PACKAGING: "บรรจุภัณฑ์",
  LABOR: "ค่าแรง",
  RENT: "ค่าเช่า",
  UTILITIES: "น้ำ/ไฟ/อินเทอร์เน็ต",
  MARKETING: "การตลาด",
  DELIVERY_FEE: "ค่าธรรมเนียมเดลิเวอรี",
  MAINTENANCE: "ซ่อมบำรุง",
  OTHER: "อื่น ๆ",
};
const inputClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";
const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(value);

export function ExpenseManager({ initialExpenses }: { initialExpenses: Expense[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category: "OTHER" as ExpenseCategory, title: "", amount: 0, expenseAt: new Date().toISOString().slice(0, 10), note: "" });
  const total = initialExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((category) => ({ category, amount: initialExpenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      setOpen(false); setForm({ ...form, title: "", amount: 0, note: "" }); router.refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  const remove = async (expense: Expense) => {
    if (!window.confirm(`ลบค่าใช้จ่าย “${expense.title}” หรือไม่?`)) return;
    await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" }); router.refresh();
  };

  return (
    <AppShell title="ค่าใช้จ่าย" description="บันทึกค่าใช้จ่ายจริงเพื่อเห็นกำไรสุทธิ ไม่ใช่แค่กำไรจากสินค้า" actions={<Button onClick={() => setOpen(true)} className="h-12 rounded-xl px-5 text-base font-bold"><Plus className="size-5" /> เพิ่มค่าใช้จ่าย</Button>}>
      <section className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <article className="rounded-3xl bg-slate-950 p-6 text-white"><div className="flex size-12 items-center justify-center rounded-2xl bg-white/10"><WalletCards className="size-6" /></div><p className="mt-6 text-sm text-slate-400">ค่าใช้จ่ายรวมที่บันทึก</p><p className="mt-1 text-4xl font-black">{money(total)}</p><p className="mt-3 text-xs leading-5 text-slate-400">ควรบันทึกค่าเช่า ค่าแรง ค่าสาธารณูปโภค และค่าธรรมเนียมแอปให้ครบ เพื่อให้กำไรสุทธิใกล้เคียงความจริง</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="font-black">สัดส่วนตามหมวด</h2><div className="mt-5 space-y-4">{byCategory.map((item) => <div key={item.category}><div className="flex justify-between text-sm"><span className="font-bold">{labels[item.category]}</span><span>{money(item.amount)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(item.amount / Math.max(total, 1)) * 100}%` }} /></div></div>)}</div></article>
      </section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="text-lg font-black">รายการค่าใช้จ่าย</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-4">วันที่</th><th className="px-4 py-4">รายการ</th><th className="px-4 py-4">หมวด</th><th className="px-4 py-4 text-right">จำนวนเงิน</th><th className="px-5 py-4 text-right">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{initialExpenses.map((expense) => <tr key={expense.id}><td className="px-5 py-4 text-slate-500">{new Date(expense.expenseAt).toLocaleDateString("th-TH")}</td><td className="px-4 py-4"><p className="font-bold">{expense.title}</p><p className="text-xs text-slate-400">{expense.note || "-"}</p></td><td className="px-4 py-4"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{labels[expense.category]}</span></td><td className="px-4 py-4 text-right text-lg font-black">{money(expense.amount)}</td><td className="px-5 py-4 text-right"><button onClick={() => remove(expense)} className="inline-flex size-11 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div></section>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="text-2xl font-black">เพิ่มค่าใช้จ่าย</DialogTitle><DialogDescription>รายการนี้จะถูกนำไปหักจากกำไรสุทธิใน Dashboard</DialogDescription></DialogHeader><div className="grid gap-4"><label className="space-y-2"><span className="text-sm font-bold">ชื่อรายการ *</span><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2"><span className="text-sm font-bold">หมวด</span><select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>{EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{labels[category]}</option>)}</select></label><label className="space-y-2"><span className="text-sm font-bold">จำนวนเงิน *</span><input type="number" min="0" step="0.01" className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></label></div><label className="space-y-2"><span className="text-sm font-bold">วันที่</span><input type="date" className={inputClass} value={form.expenseAt} onChange={(e) => setForm({ ...form, expenseAt: e.target.value })} /></label><label className="space-y-2"><span className="text-sm font-bold">หมายเหตุ</span><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>{error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}<Button disabled={saving} onClick={submit} className="h-14 rounded-xl text-base font-bold">{saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}</Button></div></DialogContent></Dialog>
    </AppShell>
  );
}
