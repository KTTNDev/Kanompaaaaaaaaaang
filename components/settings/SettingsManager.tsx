"use client";

import { useState } from "react";
import { Cloud, DatabaseBackup, Save, Sheet } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

interface SettingsState { storeName: string; taxRate: number; pricesIncludeTax: boolean; serviceChargeRate: number; targetFoodCostPercentage: number; lowMarginPercentage: number }
const inputClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";
const driveFolder = "https://drive.google.com/drive/folders/1JdjT0_1x57wLqMgU0hksYBraAujfDVnD?usp=sharing";
const driveSheet = "https://docs.google.com/spreadsheets/d/11TVIZinypm-mzrkj_LyUMrgCGUexytr-mTA8nBCLV-A/edit";

export function SettingsManager({ initialSettings }: { initialSettings: SettingsState }) {
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async () => {
    setSaving(true); setMessage("");
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "บันทึกการตั้งค่าแล้ว" : result.error || "บันทึกไม่สำเร็จ"); setSaving(false);
  };
  return <AppShell title="ตั้งค่าร้าน" description="ภาษี เป้าหมายต้นทุน และการสำรองข้อมูล" actions={<Button onClick={submit} disabled={saving} className="h-12 rounded-xl px-5 font-bold"><Save className="size-5" />{saving ? "กำลังบันทึก" : "บันทึก"}</Button>}>
    {message && <p className={`mb-5 rounded-2xl p-4 text-sm font-bold ${message.includes("แล้ว") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p>}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">ข้อมูลร้านและการคิดราคา</h2><div className="mt-5 grid gap-4"><label className="space-y-2"><span className="text-sm font-bold">ชื่อร้าน</span><input className={inputClass} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2"><span className="text-sm font-bold">ภาษี (%)</span><input type="number" min="0" max="100" step="0.01" className={inputClass} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} /></label><label className="space-y-2"><span className="text-sm font-bold">Service charge (%)</span><input type="number" min="0" max="100" step="0.01" className={inputClass} value={form.serviceChargeRate} onChange={(e) => setForm({ ...form, serviceChargeRate: Number(e.target.value) })} /></label></div><label className="flex min-h-14 items-center gap-3 rounded-xl border p-4"><input type="checkbox" className="size-5" checked={form.pricesIncludeTax} onChange={(e) => setForm({ ...form, pricesIncludeTax: e.target.checked })} /><span><b className="block">ราคาสินค้ารวมภาษีแล้ว</b><small className="text-slate-500">เปิดเมื่อราคาที่หน้าร้านเป็นราคาสุทธิรวมภาษี</small></span></label><p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">ระบบตั้งต้นภาษีไว้ 0% กรุณาเปิดใช้ตามสถานะการจดทะเบียนและคำแนะนำของนักบัญชี</p></div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black">เป้าหมายกำไร</h2><div className="mt-5 grid grid-cols-2 gap-3"><label className="space-y-2"><span className="text-sm font-bold">เป้าหมาย Food cost (%)</span><input type="number" min="0" max="100" step="0.1" className={inputClass} value={form.targetFoodCostPercentage} onChange={(e) => setForm({ ...form, targetFoodCostPercentage: Number(e.target.value) })} /><small className="text-slate-500">ใช้เป็นเป้าหมายกำหนดราคา</small></label><label className="space-y-2"><span className="text-sm font-bold">แจ้งเตือนกำไรต่ำกว่า (%)</span><input type="number" min="0" max="100" step="0.1" className={inputClass} value={form.lowMarginPercentage} onChange={(e) => setForm({ ...form, lowMarginPercentage: Number(e.target.value) })} /><small className="text-slate-500">ช่วยคัดเมนูที่ควรทบทวน</small></label></div></section>
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white xl:col-span-2"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex size-12 items-center justify-center rounded-2xl bg-white/10"><Cloud className="size-6" /></div><h2 className="mt-5 text-xl font-black">Google Drive และสำรองข้อมูล</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">ฐานข้อมูลธุรกรรมอยู่ใน SQLite เพื่อความถูกต้องของสต็อกและยอดเงิน ส่วน Google Drive ใช้เก็บชุดข้อมูลสำรองและรายงาน เพื่อป้องกันไฟล์ชนกันเมื่อมีหลายออเดอร์</p></div><span className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-bold text-emerald-300">เชื่อมโฟลเดอร์แล้ว</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><a href="/api/export" download className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-4 font-bold text-slate-950"><DatabaseBackup className="size-5" />ดาวน์โหลดข้อมูลสำรอง</a><a href={driveSheet} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 font-bold hover:bg-white/15"><Sheet className="size-5" />เปิดชีตฐานข้อมูล</a><a href={driveFolder} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 font-bold hover:bg-white/15"><Cloud className="size-5" />เปิดโฟลเดอร์ Drive</a></div></section>
    </div>
  </AppShell>;
}
