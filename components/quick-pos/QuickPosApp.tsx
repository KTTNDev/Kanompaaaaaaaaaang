"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Banknote, Check, ChevronDown, ChevronRight, CirclePlus, Clock3, Cloud, CreditCard, Lightbulb, Minus, Pencil, Plus, QrCode, ReceiptText, RefreshCw, Settings, ShoppingBag, Store, Trash2, TrendingUp, Trophy, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPendingOrders, markPendingOrderFailed, removePendingOrder, savePendingOrder, type QueuedOrderInput } from "@/lib/pos-sync-queue";
import { sheetRequest } from "@/lib/sheets-client";
import type { QuickBootstrap, QuickOrder, QuickPaymentMethod, QuickProduct, QuickSalesChannel } from "@/types/sheets";

type View = "sale" | "reports" | "settings";
type CartLine = { product: QuickProduct; quantity: number };
const money = (value: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
const now = () => new Date().toISOString();
const newId = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const LOCAL_KEY = "breadflow-local-v1";
const APP_PRICING_KEY = "breadflow-app-pricing-enabled";
const demoProducts: QuickProduct[] = [
  { id: "demo-chocolate", sku: "BRD-001", name: "ขนมปังช็อกโกแลต", category: "ขนมปัง", price: 30, appPrice: 35, cost: 10, imageUrl: "", active: true, sortOrder: 1, trackStock: false, currentStock: 0, minStock: 0 },
  { id: "demo-jam", sku: "BRD-002", name: "ขนมปังแยม", category: "ขนมปัง", price: 20, appPrice: 25, cost: 7, imageUrl: "", active: true, sortOrder: 2, trackStock: false, currentStock: 0, minStock: 0 },
  { id: "demo-sugar", sku: "BRD-003", name: "ขนมปังน้ำตาล", category: "ขนมปัง", price: 35, appPrice: 40, cost: 9, imageUrl: "", active: true, sortOrder: 3, trackStock: false, currentStock: 0, minStock: 0 },
  { id: "demo-pandan", sku: "BRD-004", name: "ขนมปังสังขยา", category: "ขนมปัง", price: 25, appPrice: 30, cost: 8, imageUrl: "", active: true, sortOrder: 4, trackStock: false, currentStock: 0, minStock: 0 },
  { id: "demo-milk", sku: "BRD-005", name: "ขนมปังเนยนม", category: "ขนมปัง", price: 25, appPrice: 30, cost: 8, imageUrl: "", active: true, sortOrder: 5, trackStock: false, currentStock: 0, minStock: 0 },
  { id: "demo-floss", sku: "BRD-006", name: "ขนมปังหมูหยอง", category: "ขนมปัง", price: 35, appPrice: 40, cost: 14, imageUrl: "", active: true, sortOrder: 6, trackStock: false, currentStock: 0, minStock: 0 },
];

const demoData = (): QuickBootstrap => ({ products: demoProducts, orders: [], expenses: [], waste: [], settings: { storeName: "ร้านขนมปัง", currency: "THB", defaultChannel: "STORE" }, source: "LOCAL_DEMO" });
const emptyProduct = (): QuickProduct => ({ id: "", sku: "", name: "", category: "ขนมปัง", price: 0, appPrice: 0, cost: 0, imageUrl: "", active: true, sortOrder: 0, trackStock: false, currentStock: 0, minStock: 0 });

export function QuickPosApp({ initialView = "sale" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [data, setData] = useState<QuickBootstrap>(demoData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartPage, setCartPage] = useState(0);
  const [channel, setChannel] = useState<QuickSalesChannel>("STORE");
  const [appPricingEnabled, setAppPricingEnabled] = useState(false);
  const [category, setCategory] = useState("ทั้งหมด");
  const [productPage, setProductPage] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState<QuickPaymentMethod>("CASH");
  const [received, setReceived] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [success, setSuccess] = useState<QuickOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productDraft, setProductDraft] = useState<QuickProduct>(emptyProduct);
  const [rangeDays, setRangeDays] = useState(1);

  const connected = data.source === "GOOGLE_SHEETS";
  const persistLocal = (next: QuickBootstrap) => { setData(next); window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); };
  const load = async (allowAppPricing = appPricingEnabled) => {
    setLoading(true); setMessage("");
    try { const result = await sheetRequest<QuickBootstrap>("bootstrap"); setData({ ...result, source: "GOOGLE_SHEETS" }); setChannel(allowAppPricing && result.settings.defaultChannel === "APP" ? "APP" : "STORE"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้"); const saved = window.localStorage.getItem(LOCAL_KEY); setData(saved ? JSON.parse(saved) as QuickBootstrap : demoData()); }
    finally { setLoading(false); }
  };

  const syncPendingOrders = async () => {
    if (syncingRef.current) return;
    const pendingOrders = await getPendingOrders();
    setPendingSyncCount(pendingOrders.length);
    if (!pendingOrders.length || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    let syncFailed = false;
    try {
      for (const pending of pendingOrders) {
        try {
          const result = await sheetRequest<{ ok: boolean; order: QuickOrder }>("order.create", { order: pending.order });
          await removePendingOrder(pending.id);
          setData((current) => {
            const exists = current.orders.some((order) => order.clientOrderId === pending.id);
            return { ...current, orders: exists ? current.orders.map((order) => order.clientOrderId === pending.id ? result.order : order) : [result.order, ...current.orders] };
          });
        } catch (error) {
          await markPendingOrderFailed(pending, error);
          syncFailed = true;
          break;
        }
      }
    } finally {
      const remainingCount = (await getPendingOrders()).length;
      setPendingSyncCount(remainingCount);
      syncingRef.current = false;
      setSyncing(false);
      if (remainingCount > 0 && !syncFailed && navigator.onLine) window.setTimeout(() => void syncPendingOrders(), 0);
    }
  };

  useEffect(() => {
    const allowAppPricing = window.localStorage.getItem(APP_PRICING_KEY) === "true";
    const initialLoad = window.setTimeout(() => { setAppPricingEnabled(allowAppPricing); void load(allowAppPricing).finally(() => void syncPendingOrders()); }, 0);
    const retrySync = () => void syncPendingOrders();
    const syncWhenVisible = () => { if (document.visibilityState === "visible") void syncPendingOrders(); };
    window.addEventListener("online", retrySync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", retrySync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
    // load intentionally runs only once when the POS starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeAppPricingSetting = (enabled: boolean) => {
    setAppPricingEnabled(enabled);
    window.localStorage.setItem(APP_PRICING_KEY, String(enabled));
    if (!enabled) setChannel("STORE");
  };

  const categories = useMemo(() => ["ทั้งหมด", ...new Set(data.products.filter((product) => product.active).map((product) => product.category || "ทั่วไป"))], [data.products]);
  const filteredProducts = data.products.filter((product) => product.active && (category === "ทั้งหมด" || product.category === category)).sort((a, b) => a.sortOrder - b.sortOrder);
  const productPageSize = 8;
  const productPageCount = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));
  const safeProductPage = Math.min(productPage, productPageCount - 1);
  const visibleProducts = filteredProducts.slice(safeProductPage * productPageSize, (safeProductPage + 1) * productPageSize);
  const subtotal = cart.reduce((sum, line) => sum + (channel === "APP" ? line.product.appPrice || line.product.price : line.product.price) * line.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartPageSize = 7;
  const cartPageCount = Math.max(1, Math.ceil(cart.length / cartPageSize));
  const safeCartPage = Math.min(cartPage, cartPageCount - 1);
  const visibleCart = cart.slice(safeCartPage * cartPageSize, (safeCartPage + 1) * cartPageSize);
  const addToCart = (product: QuickProduct) => {
    if (!cart.some((line) => line.product.id === product.id)) setCartPage(Math.floor(cart.length / cartPageSize));
    setCart((current) => current.some((line) => line.product.id === product.id) ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }]);
  };
  const changeQuantity = (id: string, amount: number) => setCart((current) => current.map((line) => line.product.id === id ? { ...line, quantity: line.quantity + amount } : line).filter((line) => line.quantity > 0));

  const completeOrder = async (method: QuickPaymentMethod, amount = total) => {
    if (!cart.length || saving) return;
    setSaving(true); setMessage("");
    try {
      const clientOrderId = newId();
      const createdAt = now();
      const orderInput: QueuedOrderInput = { clientOrderId, channel, paymentMethod: method, discount, receivedAmount: method === "CASH" ? amount : total, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) };
      const cost = cart.reduce((sum, line) => sum + line.product.cost * line.quantity, 0);
      const orderNumber = `LOCAL-${clientOrderId.slice(0, 8).toUpperCase()}`;
      const order: QuickOrder = { clientOrderId, orderNumber, createdAt, channel, paymentMethod: method, subtotal, discount, total, cost, profit: total - cost, itemCount, receivedAmount: orderInput.receivedAmount, changeAmount: method === "CASH" ? Math.max(0, amount - total) : 0, status: "COMPLETED", items: cart.map((line) => { const unitPrice = channel === "APP" ? line.product.appPrice || line.product.price : line.product.price; return { id: newId(), orderNumber, productId: line.product.id, productName: line.product.name, quantity: line.quantity, unitPrice, unitCost: line.product.cost, lineTotal: unitPrice * line.quantity, lineCost: line.product.cost * line.quantity }; }) };
      await savePendingOrder({ id: clientOrderId, createdAt, order: orderInput, attempts: 0, lastError: "" });
      setPendingSyncCount((count) => count + 1);
      setData((current) => ({ ...current, orders: [order, ...current.orders] }));
      setSuccess(order); setCart([]); setDiscount(0); setPaymentOpen(false);
      setSaving(false);
      void syncPendingOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกบิลในเครื่องไม่สำเร็จ");
      setSaving(false);
    }
  };

  const saveProduct = async () => {
    if (!productDraft.name.trim() || productDraft.price <= 0) { setMessage("กรุณาใส่ชื่อสินค้าและราคาขาย"); return; }
    setSaving(true);
    try {
      const normalized = { ...productDraft, id: productDraft.id || newId(), appPrice: productDraft.appPrice || productDraft.price };
      if (connected) { await sheetRequest("product.save", { product: normalized }); await load(); }
      else { const exists = data.products.some((product) => product.id === normalized.id); persistLocal({ ...data, products: exists ? data.products.map((product) => product.id === normalized.id ? normalized : product) : [...data.products, normalized] }); }
      setProductOpen(false); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกสินค้าไม่สำเร็จ"); }
    finally { setSaving(false); }
  };

  const archiveProduct = async (product: QuickProduct) => {
    if (connected) { await sheetRequest("product.archive", { id: product.id }); await load(); }
    else persistLocal({ ...data, products: data.products.map((item) => item.id === product.id ? { ...item, active: false } : item) });
  };

  return <div className="min-h-dvh bg-[#f2f4f4] pb-28 text-[#153f46] lg:h-dvh lg:overflow-hidden lg:pb-0">
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur"><div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-[#daf3f5] text-[#168f9f]"><Store className="size-7" /></div><div><p className="text-xl font-black">{data.settings.storeName}</p><p className="hidden text-xs text-slate-400 xl:block">POS ร้านเล็ก · จบการขายในไม่กี่จิ้ม</p></div></div><nav className="hidden items-center gap-1 rounded-2xl bg-slate-100 p-1 lg:flex"><TopNavButton active={view === "reports"} icon={BarChart3} label="รายงาน" onClick={() => setView("reports")} /><TopNavButton active={view === "sale"} icon={Store} label="ขายของ" onClick={() => setView("sale")} /><TopNavButton active={view === "settings"} icon={Settings} label="ตั้งค่า" onClick={() => setView("settings")} /></nav><div className="flex items-center gap-2"><span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline ${pendingSyncCount > 0 ? "bg-amber-50 text-amber-700" : connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><span className={`mr-1.5 inline-block size-2 rounded-full ${pendingSyncCount > 0 ? "bg-amber-500" : connected ? "bg-emerald-500" : "bg-slate-400"}`} />{pendingSyncCount > 0 ? syncing ? `กำลังซิงก์ ${pendingSyncCount} บิล` : `รอซิงก์ ${pendingSyncCount} บิล` : connected ? "ข้อมูลล่าสุดแล้ว" : "เก็บข้อมูลในเครื่อง"}</span><button onClick={() => { void load(); void syncPendingOrders(); }} className="grid size-11 place-items-center rounded-xl bg-slate-100" aria-label="รีเฟรชและซิงก์"><RefreshCw className={`size-5 ${loading || syncing ? "animate-spin" : ""}`} /></button></div></div></header>

    {message && <div className="mx-auto mt-4 max-w-[1450px] px-5"><div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{message}</div></div>}

    {view === "sale" && <main className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-[1500px] lg:h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1fr)_390px] lg:overflow-hidden">
      <section className="min-w-0 p-4 pb-40 sm:p-5 sm:pb-40 lg:h-full lg:overflow-hidden lg:p-5 lg:pb-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-400">เลือกสินค้าเพื่อเพิ่มลงบิล</p><h1 className="text-2xl font-black">รายการสินค้า</h1></div>{appPricingEnabled && <div className="flex rounded-full bg-white p-1 shadow-sm"><button onClick={() => setChannel("STORE")} className={`min-h-11 rounded-full px-4 text-sm font-bold ${channel === "STORE" ? "bg-[#d8f1f3] text-[#147f8c]" : "text-slate-400"}`}>หน้าร้าน</button><button onClick={() => setChannel("APP")} className={`min-h-11 rounded-full px-4 text-sm font-bold ${channel === "APP" ? "bg-[#d8f1f3] text-[#147f8c]" : "text-slate-400"}`}>แอป</button></div>}</div>
      <div className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm"><label htmlFor="sale-category" className="shrink-0 text-sm font-bold text-slate-400">หมวดสินค้า</label><select id="sale-category" value={category} onChange={(event) => { setCategory(event.target.value); setProductPage(0); }} className="h-11 min-w-0 flex-1 bg-transparent text-base font-black text-[#168f9f] outline-none">{categories.map((item) => <option key={item} value={item}>{item} ({item === "ทั้งหมด" ? data.products.filter((p) => p.active).length : data.products.filter((p) => p.active && p.category === item).length})</option>)}</select></div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map((product) => <button key={product.id} onClick={() => addToCart(product)} className="group overflow-hidden rounded-[22px] bg-white text-left shadow-[0_10px_24px_rgba(26,57,62,.08)] transition active:scale-95"><div className="relative aspect-[16/9] bg-gradient-to-br from-[#dff4f5] via-[#f7ecda] to-[#f8d8c9] bg-cover bg-center" style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}><div className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-3 py-1 text-base font-black text-[#126f7a]">{money(channel === "APP" ? product.appPrice || product.price : product.price)}</div>{!product.imageUrl && <div className="grid h-full place-items-center text-4xl">🍞</div>}<div className="absolute bottom-2.5 right-2.5 grid size-10 place-items-center rounded-full bg-white text-[#168f9f] shadow"><Plus className="size-5" /></div></div><div className="p-3"><p className="line-clamp-1 text-base font-black">{product.name}</p></div></button>)}</div>
      {productPageCount > 1 && <Pager page={safeProductPage} pageCount={productPageCount} onPageChange={setProductPage} />}
      </section>

      <aside className="sticky top-20 hidden h-[calc(100dvh-5rem)] flex-col border-l bg-white lg:flex"><div className="border-b px-4 py-2"><div className="flex min-h-12 items-center justify-between"><div><p className="text-[11px] font-bold text-slate-400">ออร์เดอร์ปัจจุบัน</p><h2 className="text-lg font-black">{cart.length} เมนู · {itemCount} ชิ้น</h2></div>{cart.length > 0 && <button onClick={() => { setCart([]); setCartPage(0); }} className="min-h-10 px-2 text-sm font-bold text-rose-500">ล้างบิล</button>}</div></div><div className="min-h-0 flex-1 px-4 py-1">{cart.length === 0 ? <div className="grid h-full place-items-center text-center"><div><ShoppingBag className="mx-auto size-14 text-slate-200" /><p className="mt-4 font-bold text-slate-400">จิ้มสินค้าเพื่อเริ่มขาย</p></div></div> : <div><div className="grid grid-cols-[minmax(0,1fr)_68px_104px] gap-2 border-b py-1.5 text-[11px] font-bold text-slate-400"><span>สินค้า</span><span className="text-right">รวม</span><span className="text-center">จำนวน</span></div>{visibleCart.map((line) => { const unitPrice = channel === "APP" ? line.product.appPrice || line.product.price : line.product.price; return <div key={line.product.id} className="grid min-h-10 grid-cols-[minmax(0,1fr)_68px_104px] items-center gap-2 border-b border-slate-100 py-0.5"><p className="truncate text-sm font-black">{line.product.name}</p><b className="text-right text-sm">{money(unitPrice * line.quantity)}</b><div className="flex items-center justify-end gap-1"><button onClick={() => changeQuantity(line.product.id, -1)} className="grid size-9 place-items-center rounded-xl bg-slate-100" aria-label={`ลด ${line.product.name}`}><Minus className="size-4" /></button><b className="w-6 text-center">{line.quantity}</b><button onClick={() => changeQuantity(line.product.id, 1)} className="grid size-9 place-items-center rounded-xl bg-[#e5f7f8] text-[#117986]" aria-label={`เพิ่ม ${line.product.name}`}><Plus className="size-4" /></button></div></div>; })}{cartPageCount > 1 && <Pager page={safeCartPage} pageCount={cartPageCount} onPageChange={setCartPage} />}</div>}</div><CartFooter subtotal={subtotal} total={total} discount={discount} setDiscount={setDiscount} disabled={!cart.length || saving} onExact={() => void completeOrder("CASH", total)} onMore={() => { setPayment("CASH"); setReceived(total); setPaymentOpen(true); }} /></aside>
      {cart.length > 0 && <div className="fixed inset-x-3 bottom-24 z-30 rounded-[24px] bg-white p-3 shadow-2xl lg:hidden"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-400">{itemCount} ชิ้น</p><p className="text-2xl font-black">{money(total)}</p></div><div className="flex gap-2"><Button onClick={() => void completeOrder("CASH", total)} disabled={saving} className="h-14 rounded-2xl bg-[#1697a8] px-5 font-black">เงินสดพอดี</Button><Button onClick={() => setPaymentOpen(true)} variant="outline" className="h-14 rounded-2xl px-4">อื่น ๆ</Button></div></div></div>}
    </main>}

    {view === "reports" && <AdvancedReportsView data={data} days={rangeDays} setDays={setRangeDays} />}
    {view === "settings" && <EasySettingsView data={data} connected={connected} pendingSyncCount={pendingSyncCount} syncing={syncing} appPricingEnabled={appPricingEnabled} onAppPricingChange={changeAppPricingSetting} onRefresh={() => void load()} onSync={() => void syncPendingOrders()} onAdd={() => { setProductDraft(emptyProduct()); setProductOpen(true); }} onEdit={(product) => { setProductDraft(product); setProductOpen(true); }} onArchive={(product) => void archiveProduct(product)} />}

    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-20 grid-cols-3 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"><NavButton active={view === "reports"} icon={BarChart3} label="รายงาน" onClick={() => setView("reports")} /><NavButton active={view === "sale"} icon={Store} label="ขายของ" onClick={() => setView("sale")} /><NavButton active={view === "settings"} icon={Settings} label="ตั้งค่า" onClick={() => setView("settings")} /></nav>

    <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} payment={payment} setPayment={setPayment} total={total} received={received} setReceived={setReceived} saving={saving} onConfirm={() => void completeOrder(payment, payment === "CASH" ? received : total)} />
    <SuccessDialog order={success} onClose={() => setSuccess(null)} />
    <EasyProductDialog open={productOpen} onOpenChange={setProductOpen} product={productDraft} setProduct={setProductDraft} saving={saving} appPricingEnabled={appPricingEnabled} onSave={() => void saveProduct()} />
  </div>;
}

function CartFooter({ subtotal, total, discount, setDiscount, disabled, onExact, onMore }: { subtotal: number; total: number; discount: number; setDiscount: (value: number) => void; disabled: boolean; onExact: () => void; onMore: () => void }) { return <div className="border-t p-3"><div className="space-y-1 text-sm"><div className="flex items-center justify-between text-slate-500"><span>ยอดสินค้า</span><b>{money(subtotal)}</b></div><div className="flex items-center justify-between text-slate-500"><span>ส่วนลด</span><input aria-label="ส่วนลด" type="number" min="0" max={subtotal} value={discount || ""} onChange={(event) => setDiscount(Math.min(subtotal, Math.max(0, Number(event.target.value))))} className="h-8 w-28 rounded-xl bg-slate-100 px-3 text-right font-bold outline-none" /></div><div className="flex items-center justify-between border-t pt-1.5"><span className="text-lg font-black">ยอดสุทธิ</span><b className="text-2xl">{money(total)}</b></div></div><Button disabled={disabled} onClick={onExact} className="mt-2 h-13 w-full rounded-2xl bg-[#1697a8] text-base font-black hover:bg-[#128695]"><Banknote className="size-5" />รับเงินสดพอดี</Button><Button disabled={disabled} onClick={onMore} variant="outline" className="mt-1.5 h-11 w-full rounded-2xl font-bold">เงินทอน / QR / บัตร</Button></div>; }

function PaymentDialog({ open, onOpenChange, payment, setPayment, total, received, setReceived, saving, onConfirm }: { open: boolean; onOpenChange: (value: boolean) => void; payment: QuickPaymentMethod; setPayment: (value: QuickPaymentMethod) => void; total: number; received: number; setReceived: (value: number) => void; saving: boolean; onConfirm: () => void }) {
  const options: Array<{ id: QuickPaymentMethod; label: string; icon: typeof Wallet }> = [{ id: "CASH", label: "เงินสด", icon: Banknote }, { id: "QR", label: "เงินโอน / QR", icon: QrCode }, { id: "CARD", label: "บัตร", icon: CreditCard }, { id: "OTHER", label: "อื่น ๆ", icon: Wallet }];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[32px] sm:max-w-xl"><DialogHeader><DialogTitle className="text-2xl font-black">คำนวณเงิน</DialogTitle><DialogDescription>เลือกวิธีรับเงินแล้วกดยืนยัน</DialogDescription></DialogHeader><div className="rounded-[26px] bg-[#eef4f4] p-6 text-center"><p className="text-sm text-slate-500">ยอดที่ต้องรับ</p><p className="mt-1 text-5xl font-black text-[#124e56]">{money(total)}</p></div><div className="grid grid-cols-2 gap-3">{options.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setPayment(id); if (id !== "CASH") setReceived(total); }} className={`flex min-h-20 items-center justify-center gap-3 rounded-2xl border-2 text-base font-black ${payment === id ? "border-[#1697a8] bg-[#e5f7f8] text-[#117986]" : "border-slate-100"}`}><Icon className="size-6" />{label}</button>)}</div>{payment === "CASH" && <div><label className="text-sm font-bold">รับเงินมา</label><input type="number" value={received || ""} onChange={(event) => setReceived(Number(event.target.value))} className="mt-2 h-16 w-full rounded-2xl border-2 px-4 text-right text-3xl font-black outline-none focus:border-[#1697a8]" /><div className="mt-3 grid grid-cols-4 gap-2">{[total, Math.ceil(total / 100) * 100, 500, 1000].filter((value, index, array) => value >= total && array.indexOf(value) === index).map((value) => <button key={value} onClick={() => setReceived(value)} className="h-12 rounded-xl bg-slate-100 font-bold">{value}</button>)}</div><p className="mt-4 text-right text-lg font-bold">เงินทอน <span className="text-3xl text-emerald-600">{money(Math.max(0, received - total))}</span></p></div>}<Button disabled={saving || (payment === "CASH" && received < total)} onClick={onConfirm} className="h-16 rounded-2xl bg-[#1697a8] text-lg font-black">ยืนยันและบันทึกลง Google Sheet</Button></DialogContent></Dialog>;
}

function SuccessDialog({ order, onClose }: { order: QuickOrder | null; onClose: () => void }) { return <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}><DialogContent className="rounded-[32px] sm:max-w-md"><div className="py-8 text-center"><div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check className="size-10" /></div><DialogTitle className="mt-5 text-3xl font-black">บันทึกการขายแล้ว</DialogTitle><p className="mt-2 font-mono text-xs text-slate-400">{order?.orderNumber}</p><p className="mt-7 text-sm text-slate-500">ยอดขาย</p><p className="text-5xl font-black text-[#124e56]">{money(order?.total ?? 0)}</p>{(order?.changeAmount ?? 0) > 0 && <><p className="mt-5 text-sm text-slate-500">เงินทอน</p><p className="text-3xl font-black text-emerald-600">{money(order?.changeAmount ?? 0)}</p></>}<Button onClick={onClose} className="mt-8 h-14 w-full rounded-2xl bg-[#1697a8] font-black">รับออร์เดอร์ต่อไป</Button></div></DialogContent></Dialog>; }

function ProductDialog({ open, onOpenChange, product, setProduct, saving, onSave }: { open: boolean; onOpenChange: (value: boolean) => void; product: QuickProduct; setProduct: (value: QuickProduct) => void; saving: boolean; onSave: () => void }) { const input = "h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-4 text-lg font-bold outline-none focus:border-[#1697a8]"; return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[32px] sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-black">{product.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle><DialogDescription>หนึ่งเมนูมีราคาพร้อมขาย ไม่ต้องเลือกท็อปปิงเพิ่ม</DialogDescription></DialogHeader><div className="grid gap-4"><div className="rounded-[26px] bg-slate-50 p-5"><label className="text-sm font-bold">ชื่อสินค้า *</label><input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="เช่น ขนมปังช็อกโกแลต" className={`${input} mt-2`} /><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-bold">ราคาหน้าร้าน *<input type="number" min="0" value={product.price || ""} onChange={(e) => setProduct({ ...product, price: Number(e.target.value) })} className={`${input} mt-2`} /></label><label className="text-sm font-bold">ต้นทุน<input type="number" min="0" value={product.cost || ""} onChange={(e) => setProduct({ ...product, cost: Number(e.target.value) })} className={`${input} mt-2`} /></label></div></div><div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">หมวดหมู่<input value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} className={`${input} mt-2`} /></label><label className="text-sm font-bold">ราคาแอป<input type="number" min="0" value={product.appPrice || ""} onChange={(e) => setProduct({ ...product, appPrice: Number(e.target.value) })} className={`${input} mt-2`} /></label></div><label className="text-sm font-bold">ลิงก์รูปสินค้า (ไม่บังคับ)<input value={product.imageUrl} onChange={(e) => setProduct({ ...product, imageUrl: e.target.value })} placeholder="https://..." className={`${input} mt-2 text-sm`} /></label><label className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-slate-100 px-4"><input type="checkbox" checked={product.trackStock} onChange={(e) => setProduct({ ...product, trackStock: e.target.checked })} className="size-5" /><span className="font-bold">นับสต็อกสินค้านี้</span></label>{product.trackStock && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">คงเหลือ<input type="number" min="0" value={product.currentStock} onChange={(e) => setProduct({ ...product, currentStock: Number(e.target.value) })} className={`${input} mt-2`} /></label><label className="text-sm font-bold">แจ้งเตือนเมื่อเหลือ<input type="number" min="0" value={product.minStock} onChange={(e) => setProduct({ ...product, minStock: Number(e.target.value) })} className={`${input} mt-2`} /></label></div>}<Button disabled={saving} onClick={onSave} className="h-16 rounded-2xl bg-[#1697a8] text-lg font-black">{saving ? "กำลังบันทึก..." : "บันทึกสินค้า"}</Button></div></DialogContent></Dialog>; }

function ReportsView({ data, days, setDays }: { data: QuickBootstrap; days: number; setDays: (value: number) => void }) { const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - (days - 1)); const orders = data.orders.filter((order) => new Date(order.createdAt) >= cutoff && order.status === "COMPLETED"); const revenue = orders.reduce((sum, order) => sum + order.total, 0); const cost = orders.reduce((sum, order) => sum + order.cost, 0); const profit = orders.reduce((sum, order) => sum + order.profit, 0); const expenses = data.expenses.filter((item) => new Date(item.createdAt) >= cutoff).reduce((sum, item) => sum + item.amount, 0); const waste = data.waste.filter((item) => new Date(item.createdAt) >= cutoff).reduce((sum, item) => sum + item.totalCost, 0); const cash = orders.filter((order) => order.paymentMethod === "CASH").reduce((sum, order) => sum + order.total, 0); const transfer = orders.filter((order) => order.paymentMethod !== "CASH").reduce((sum, order) => sum + order.total, 0); return <main className="mx-auto max-w-5xl p-5 pb-32 lg:p-8"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">รายงานร้าน</p><h1 className="text-3xl font-black">ยอดขายและกำไร</h1></div><span className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">{new Date().toLocaleDateString("th-TH", { dateStyle: "medium" })}</span></div><div className="mt-6 grid grid-cols-3 rounded-full bg-white p-1.5 shadow-sm">{[{ value: 1, label: "วันนี้" }, { value: 7, label: "7 วัน" }, { value: 14, label: "14 วัน" }].map((item) => <button key={item.value} onClick={() => setDays(item.value)} className={`h-12 rounded-full font-bold ${days === item.value ? "bg-[#1697a8] text-white" : "text-slate-500"}`}>{item.label}</button>)}</div><section className="mt-8 rounded-[34px] bg-white p-7 shadow-[0_20px_50px_rgba(20,58,64,.1)]"><div className="flex items-start justify-between"><div><p className="text-xl font-black">ยอดขาย</p><p className="mt-1 text-sm text-slate-400">{orders.length} บิล</p></div><p className="text-5xl font-black">{money(revenue)}</p></div><div className="mt-8 grid grid-cols-2 gap-4"><Metric dot="#dc6a36" label="ต้นทุนขาย" value={cost} note={revenue ? `${Math.round(cost / revenue * 100)}%` : "0%"} /><Metric dot="#5e8d2d" label="กำไรขั้นต้น" value={profit} note={revenue ? `${Math.round(profit / revenue * 100)}%` : "0%"} /></div></section><section className="mt-6 overflow-hidden rounded-[30px] bg-white shadow-sm"><ReportRow icon={Banknote} title="ยอดขาย" description="เงินสด · เงินโอน · บิลเฉลี่ย" value={revenue} /><ReportRow icon={BarChart3} title="ต้นทุน & กำไร" description="ต้นทุนรวม กำไรสุทธิ และอัตรากำไร" value={profit - expenses - waste} /></section><section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-[28px] bg-[#153f46] p-6 text-white"><p className="text-sm text-white/60">ช่องทางรับเงิน</p><div className="mt-5 flex justify-between"><span>🟡 เงินสด</span><b>{money(cash)}</b></div><div className="mt-4 flex justify-between"><span>🔴 เงินโอน/บัตร</span><b>{money(transfer)}</b></div></div><div className="rounded-[28px] bg-white p-6"><p className="text-sm text-slate-400">กำไรสุทธิประมาณการ</p><p className="mt-2 text-4xl font-black">{money(profit - expenses - waste)}</p><p className="mt-3 text-xs text-slate-400">กำไรขั้นต้น - ค่าใช้จ่าย - ของเสีย</p></div></section></main>; }
function Metric({ dot, label, value, note }: { dot: string; label: string; value: number; note: string }) { return <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><span className="flex items-center gap-2 font-bold"><i className="size-3 rounded-full" style={{ backgroundColor: dot }} />{label}<small className="rounded-full bg-slate-200 px-2 py-0.5">{note}</small></span><b className="text-xl">{money(value)}</b></div>; }
function ReportRow({ icon: Icon, title, description, value }: { icon: typeof Banknote; title: string; description: string; value: number }) { return <div className="flex items-center gap-4 border-b p-6 last:border-0"><Icon className="size-6 text-slate-400" /><div className="flex-1"><p className="font-black">{title}</p><p className="text-sm text-slate-400">{description}</p></div><b className="text-xl">{money(value)}</b><ChevronRight className="size-5 text-slate-300" /></div>; }

function SettingsView({ data, connected, scriptUrl, setScriptUrl, onConnect, onAdd, onEdit, onArchive }: { data: QuickBootstrap; connected: boolean; scriptUrl: string; setScriptUrl: (value: string) => void; onConnect: () => void; onAdd: () => void; onEdit: (product: QuickProduct) => void; onArchive: (product: QuickProduct) => void }) { return <main className="mx-auto max-w-5xl p-5 pb-32 lg:p-8"><div><p className="text-sm text-slate-400">ตั้งค่าร้าน</p><h1 className="text-3xl font-black">สินค้าและ Google Sheet</h1></div><section className="mt-6 rounded-[30px] bg-[#153f46] p-6 text-white"><div className="flex items-center gap-3"><Cloud className="size-7 text-[#55d5df]" /><div><p className="font-black">ฐานข้อมูล Google Sheet</p><p className="text-sm text-white/60">{connected ? "เชื่อมต่อและอ่านข้อมูลสดแล้ว" : "วาง Web App URL เพียงครั้งเดียว"}</p></div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="h-14 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm outline-none placeholder:text-white/30" /><Button onClick={onConnect} className="h-14 rounded-2xl bg-[#1697a8] px-6 font-black">เชื่อมต่อ</Button></div><p className="mt-3 text-xs leading-5 text-white/45">ใช้ไฟล์ google-apps-script/Code.gs ในโปรเจกต์เพื่อติดตั้ง Web App เข้ากับชีตฐานข้อมูล</p></section><section className="mt-7"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">รายการสินค้า</h2><p className="text-sm text-slate-400">แต่ละเมนูมีราคาจบในตัว จิ้มแล้วคิดเงินได้เลย</p></div><Button onClick={onAdd} className="h-12 rounded-full bg-[#1697a8] px-5 font-black"><CirclePlus className="size-5" />เพิ่มสินค้า</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.products.filter((product) => product.active).map((product) => <article key={product.id} className="flex items-center gap-4 rounded-[24px] bg-white p-4 shadow-sm"><div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#e2f4f5] text-3xl">🍞</div><div className="min-w-0 flex-1"><p className="truncate font-black">{product.name}</p><p className="text-sm text-slate-400">ขาย {money(product.price)} · ทุน {money(product.cost)}</p></div><button onClick={() => onEdit(product)} className="grid size-11 place-items-center rounded-xl bg-slate-100"><Pencil className="size-4" /></button><button onClick={() => onArchive(product)} className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-500"><Trash2 className="size-4" /></button></article>)}</div></section></main>; }
function AdvancedReportsView({ data, days, setDays }: { data: QuickBootstrap; days: number; setDays: (value: number) => void }) {
  const [section, setSection] = useState<"overview" | "products" | "advice">("overview");
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  periodStart.setDate(periodStart.getDate() - (days - 1));
  const previousStart = new Date(periodStart);
  previousStart.setDate(previousStart.getDate() - days);
  const completed = data.orders.filter((order) => order.status === "COMPLETED");
  const orders = completed.filter((order) => new Date(order.createdAt) >= periodStart);
  const previousOrders = completed.filter((order) => { const date = new Date(order.createdAt); return date >= previousStart && date < periodStart; });
  const expenses = data.expenses.filter((item) => new Date(item.createdAt) >= periodStart).reduce((sum, item) => sum + item.amount, 0);
  const waste = data.waste.filter((item) => new Date(item.createdAt) >= periodStart).reduce((sum, item) => sum + item.totalCost, 0);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const previousRevenue = previousOrders.reduce((sum, order) => sum + order.total, 0);
  const cost = orders.reduce((sum, order) => sum + order.cost, 0);
  const grossProfit = orders.reduce((sum, order) => sum + order.profit, 0);
  const netProfit = grossProfit - expenses - waste;
  const itemCount = orders.reduce((sum, order) => sum + order.itemCount, 0);
  const averageTicket = orders.length ? revenue / orders.length : 0;
  const grossMargin = revenue ? grossProfit / revenue * 100 : 0;
  const netMargin = revenue ? netProfit / revenue * 100 : 0;
  const growth = previousRevenue ? (revenue - previousRevenue) / previousRevenue * 100 : revenue ? 100 : 0;

  const productMap = new Map<string, { id: string; name: string; quantity: number; revenue: number; profit: number }>();
  orders.forEach((order) => order.items.forEach((item) => {
    const key = item.productId || item.productName;
    const current = productMap.get(key) || { id: key, name: item.productName, quantity: 0, revenue: 0, profit: 0 };
    current.quantity += item.quantity;
    current.revenue += item.lineTotal;
    current.profit += item.lineTotal - item.lineCost;
    productMap.set(key, current);
  }));
  const topProducts = [...productMap.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5);
  const maxProductQuantity = Math.max(1, ...topProducts.map((product) => product.quantity));

  const hourMap = new Map<number, number>();
  orders.forEach((order) => { const hour = new Date(order.createdAt).getHours(); hourMap.set(hour, (hourMap.get(hour) || 0) + order.total); });
  const peakHour = [...hourMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const cash = orders.filter((order) => order.paymentMethod === "CASH").reduce((sum, order) => sum + order.total, 0);
  const digital = revenue - cash;
  const storeSales = orders.filter((order) => order.channel === "STORE").reduce((sum, order) => sum + order.total, 0);
  const appSales = revenue - storeSales;

  const chartDayCount = Math.min(days, 14);
  const dailySales = Array.from({ length: chartDayCount }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (chartDayCount - index - 1));
    const total = orders.filter((order) => new Date(order.createdAt).toDateString() === date.toDateString()).reduce((sum, order) => sum + order.total, 0);
    return { key: date.toISOString(), label: date.toLocaleDateString("th-TH", { day: "numeric", month: "short" }), total };
  });
  const maxDailySales = Math.max(1, ...dailySales.map((day) => day.total));

  const recommendations: Array<{ title: string; detail: string; tone: "good" | "warn" | "idea" }> = [];
  if (!orders.length) {
    recommendations.push({ title: "เริ่มเก็บข้อมูลการขาย", detail: "ยังไม่มีบิลในช่วงนี้ ลองจัดชุดเมนูขายง่ายและบันทึกทุกบิลเพื่อให้ระบบวิเคราะห์ได้แม่นขึ้น", tone: "idea" });
  } else {
    if (growth < -10) recommendations.push({ title: "ยอดขายลดจากช่วงก่อน", detail: `ยอดขายลดลง ${Math.abs(growth).toFixed(0)}% ควรลองโปรโมชันช่วงเงียบหรือชวนลูกค้าเดิมกลับมาซื้อ`, tone: "warn" });
    else if (growth > 10) recommendations.push({ title: "ยอดขายกำลังเติบโต", detail: `ยอดขายเพิ่มขึ้น ${growth.toFixed(0)}% รักษาสต็อกเมนูขายดีและจังหวะการผลิตช่วงพีกไว้`, tone: "good" });
    if (averageTicket < 60) recommendations.push({ title: "เพิ่มยอดต่อบิลด้วยชุดสินค้า", detail: `บิลเฉลี่ย ${money(averageTicket)} ลองทำชุด 2–3 ชิ้นหรือเพิ่มเมนูเสริมราคาเล็กน้อยที่กดขายได้ในครั้งเดียว`, tone: "idea" });
    if (grossMargin < 45) recommendations.push({ title: "ตรวจราคาขายและต้นทุน", detail: `อัตรากำไรขั้นต้น ${grossMargin.toFixed(1)}% ควรทบทวนต้นทุนวัตถุดิบ ปริมาณต่อชิ้น หรือปรับราคาเมนูที่กำไรต่ำ`, tone: "warn" });
    if (waste > revenue * 0.03) recommendations.push({ title: "ลดสินค้าทิ้ง", detail: `ของเสียคิดเป็น ${revenue ? (waste / revenue * 100).toFixed(1) : "0"}% ของยอดขาย ควรลดการผลิตล่วงหน้าและผลิตเพิ่มใกล้ช่วงเวลาขายดี`, tone: "warn" });
    if (topProducts[0]) recommendations.push({ title: `ดันเมนู ${topProducts[0].name}`, detail: `ขายดีที่สุด ${topProducts[0].quantity} ชิ้น ใช้เป็นเมนูเด่นหน้าร้านและจับคู่กับสินค้าที่ขายน้อยเพื่อเพิ่มยอดต่อบิล`, tone: "good" });
    if (peakHour) recommendations.push({ title: `เตรียมของก่อน ${String(peakHour[0]).padStart(2, "0")}:00 น.`, detail: `ช่วงนี้ทำยอดสูงสุด ${money(peakHour[1])} ควรเตรียมสินค้า เงินทอน และวัตถุดิบให้พร้อมก่อนช่วงพีก`, tone: "idea" });
  }

  const toneClass = { good: "bg-emerald-50 text-emerald-800", warn: "bg-amber-50 text-amber-900", idea: "bg-cyan-50 text-cyan-900" };
  return <main className="mx-auto max-w-6xl p-4 pb-40 sm:p-5 sm:pb-40 lg:h-[calc(100dvh-5rem)] lg:overflow-hidden lg:p-5 lg:pb-5">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-slate-400">วิเคราะห์จากยอดขายจริง</p><h1 className="text-2xl font-black">รายงานและคำแนะนำ</h1></div><span className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">{new Date().toLocaleDateString("th-TH", { dateStyle: "medium" })}</span></div>
    <div className="mt-3 grid grid-cols-2 gap-3"><div className="grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">{[{ value: 1, label: "วันนี้" }, { value: 7, label: "7 วัน" }, { value: 30, label: "30 วัน" }].map((item) => <button key={item.value} onClick={() => setDays(item.value)} className={`min-h-11 rounded-xl font-black ${days === item.value ? "bg-[#1697a8] text-white" : "text-slate-500"}`}>{item.label}</button>)}</div><div className="grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">{([{ value: "overview", label: "ภาพรวม" }, { value: "products", label: "สินค้า" }, { value: "advice", label: "คำแนะนำ" }] as const).map((item) => <button key={item.value} onClick={() => setSection(item.value)} className={`min-h-11 rounded-xl font-black ${section === item.value ? "bg-[#153f46] text-white" : "text-slate-500"}`}>{item.label}</button>)}</div></div>

    {section === "overview" && <><section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <ReportKpi icon={Banknote} label="ยอดขาย" value={money(revenue)} note={`${orders.length} บิล`} />
      <ReportKpi icon={TrendingUp} label="กำไรสุทธิ" value={money(netProfit)} note={`${netMargin.toFixed(1)}% ของยอดขาย`} positive={netProfit >= 0} />
      <ReportKpi icon={ReceiptText} label="บิลเฉลี่ย" value={money(averageTicket)} note={`${itemCount} ชิ้นทั้งหมด`} />
      <ReportKpi icon={growth >= 0 ? ArrowUpRight : ArrowDownRight} label="เทียบช่วงก่อน" value={`${growth >= 0 ? "+" : ""}${growth.toFixed(0)}%`} note={`ช่วงก่อน ${money(previousRevenue)}`} positive={growth >= 0} />
    </section>

    <section className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-[28px] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">แนวโน้มยอดขาย</h2><p className="text-sm text-slate-400">{days > 14 ? "แสดง 14 วันล่าสุด" : `แสดง ${days} วันล่าสุด`}</p></div><b className="text-2xl">{money(revenue)}</b></div><div className="mt-6 flex h-44 items-end gap-2 border-b border-slate-100 px-1">{dailySales.map((day) => <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="hidden text-[10px] font-bold text-slate-400 sm:block">{day.total ? money(day.total) : ""}</span><div title={`${day.label}: ${money(day.total)}`} className="w-full min-w-3 rounded-t-lg bg-gradient-to-t from-[#168f9f] to-[#55d5df]" style={{ height: `${Math.max(day.total ? 8 : 3, day.total / maxDailySales * 100)}%` }} /><span className="truncate text-[10px] text-slate-400">{day.label}</span></div>)}</div></div>
      <div className="rounded-[28px] bg-[#153f46] p-5 text-white"><h2 className="text-xl font-black">กำไรและต้นทุน</h2><div className="mt-5 space-y-4"><ReportAmount label="ต้นทุนสินค้า" value={cost} /><ReportAmount label="กำไรขั้นต้น" value={grossProfit} accent /><ReportAmount label="ค่าใช้จ่าย" value={expenses} /><ReportAmount label="สินค้าทิ้ง" value={waste} /><div className="border-t border-white/15 pt-4"><ReportAmount label="กำไรสุทธิ" value={netProfit} accent /></div></div><p className="mt-5 rounded-xl bg-white/10 p-3 text-xs">อัตรากำไรขั้นต้น {grossMargin.toFixed(1)}% · สุทธิ {netMargin.toFixed(1)}%</p></div>
    </section></>}

    {section === "products" && <section className="mt-3 grid gap-3 lg:grid-cols-2">
      <div className="rounded-[28px] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Trophy className="size-6 text-amber-500" /><div><h2 className="text-xl font-black">สินค้าขายดี</h2><p className="text-sm text-slate-400">เรียงตามจำนวนชิ้น</p></div></div><div className="mt-5 space-y-4">{topProducts.map((product, index) => <div key={product.id}><div className="flex items-center justify-between gap-3"><span className="truncate font-bold"><b className="mr-2 text-[#1697a8]">#{index + 1}</b>{product.name}</span><span className="shrink-0 text-sm"><b>{product.quantity}</b> ชิ้น · {money(product.revenue)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1697a8]" style={{ width: `${product.quantity / maxProductQuantity * 100}%` }} /></div></div>)}{!topProducts.length && <p className="py-10 text-center font-bold text-slate-400">ยังไม่มีข้อมูลสินค้าในช่วงนี้</p>}</div></div>
      <div className="grid gap-4 sm:grid-cols-2"><ReportSplit title="ช่องทางการขาย" icon={Store} rows={[{ label: "หน้าร้าน", value: storeSales }, { label: "แอป", value: appSales }]} total={revenue} /><ReportSplit title="การรับเงิน" icon={Wallet} rows={[{ label: "เงินสด", value: cash }, { label: "โอน/บัตร", value: digital }]} total={revenue} /><div className="rounded-[24px] bg-white p-5 shadow-sm sm:col-span-2"><div className="flex items-center gap-3"><Clock3 className="size-6 text-[#1697a8]" /><div><p className="font-black">ช่วงเวลาขายดีที่สุด</p><p className="text-sm text-slate-400">{peakHour ? `${String(peakHour[0]).padStart(2, "0")}:00–${String((peakHour[0] + 1) % 24).padStart(2, "0")}:00 น. · ${money(peakHour[1])}` : "ยังไม่มีข้อมูลเพียงพอ"}</p></div></div></div></div>
    </section>}

    {section === "advice" && <section className="mt-3 rounded-[28px] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Lightbulb className="size-6" /></div><div><h2 className="text-xl font-black">คำแนะนำพัฒนาร้าน</h2><p className="text-sm text-slate-400">สร้างอัตโนมัติจากยอดขาย ต้นทุน และพฤติกรรมการซื้อในช่วงที่เลือก</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{recommendations.slice(0, 6).map((recommendation, index) => <article key={`${recommendation.title}-${index}`} className={`rounded-2xl p-4 ${toneClass[recommendation.tone]}`}><h3 className="font-black">{recommendation.title}</h3><p className="mt-1 text-sm leading-6 opacity-80">{recommendation.detail}</p></article>)}</div><p className="mt-4 text-xs text-slate-400">คำแนะนำเป็นแนวทางจากข้อมูลที่บันทึก ควรพิจารณาสภาพอากาศ เทศกาล และเหตุการณ์หน้าร้านร่วมด้วย</p></section>}
  </main>;
}

function ReportKpi({ icon: Icon, label, value, note, positive }: { icon: typeof Banknote; label: string; value: string; note: string; positive?: boolean }) { return <article className="rounded-[24px] bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-bold text-slate-400"><Icon className={`size-5 ${positive === false ? "text-rose-500" : "text-[#1697a8]"}`} />{label}</div><p className={`mt-3 text-2xl font-black sm:text-3xl ${positive === false ? "text-rose-600" : ""}`}>{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></article>; }
function ReportAmount({ label, value, accent }: { label: string; value: number; accent?: boolean }) { return <div className="flex items-center justify-between gap-4"><span className="text-sm text-white/65">{label}</span><b className={accent ? "text-xl text-[#69e0e7]" : ""}>{money(value)}</b></div>; }
function ReportSplit({ title, icon: Icon, rows, total }: { title: string; icon: typeof Store; rows: Array<{ label: string; value: number }>; total: number }) { return <article className="rounded-[24px] bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Icon className="size-5 text-[#1697a8]" /><h3 className="font-black">{title}</h3></div><div className="mt-4 space-y-3">{rows.map((row) => <div key={row.label}><div className="flex justify-between text-sm"><span>{row.label}</span><b>{money(row.value)}</b></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1697a8]" style={{ width: `${total ? row.value / total * 100 : 0}%` }} /></div></div>)}</div></article>; }

function EasyProductDialog({ open, onOpenChange, product, setProduct, saving, appPricingEnabled, onSave }: { open: boolean; onOpenChange: (value: boolean) => void; product: QuickProduct; setProduct: (value: QuickProduct) => void; saving: boolean; appPricingEnabled: boolean; onSave: () => void }) {
  const input = "mt-2 h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-4 text-lg font-bold outline-none focus:border-[#1697a8]";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[32px] sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-2xl font-black">{product.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle>
        <DialogDescription>ใส่ชื่อ ราคา และต้นทุน จากนั้นกดบันทึกได้เลย</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <label className="text-sm font-bold">ชื่อสินค้า *<input autoFocus value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} placeholder="เช่น ขนมปังช็อกโกแลต" className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">ราคาขาย *<input inputMode="decimal" type="number" min="0" value={product.price || ""} onChange={(event) => setProduct({ ...product, price: Number(event.target.value) })} className={input} /></label>
          <label className="text-sm font-bold">ต้นทุน<input inputMode="decimal" type="number" min="0" value={product.cost || ""} onChange={(event) => setProduct({ ...product, cost: Number(event.target.value) })} className={input} /></label>
        </div>
        <label className="text-sm font-bold">หมวดหมู่<input value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} placeholder="ขนมปัง" className={input} /></label>
        {appPricingEnabled && <label className="rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-[#126f7a]">ราคาแอป<input inputMode="decimal" type="number" min="0" value={product.appPrice || ""} onChange={(event) => setProduct({ ...product, appPrice: Number(event.target.value) })} className={input} /></label>}
        <details className="rounded-2xl border-2 border-slate-100">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-bold">ข้อมูลเพิ่มเติม <ChevronDown className="size-5" /></summary>
          <div className="grid gap-4 border-t p-4">
            <label className="text-sm font-bold">ลิงก์รูปสินค้า<input value={product.imageUrl} onChange={(event) => setProduct({ ...product, imageUrl: event.target.value })} placeholder="https://... (ไม่บังคับ)" className={`${input} text-sm`} /></label>
            <label className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-slate-100 px-4"><input type="checkbox" checked={product.trackStock} onChange={(event) => setProduct({ ...product, trackStock: event.target.checked })} className="size-6 accent-[#1697a8]" /><span className="font-bold">นับสต็อกสินค้านี้</span></label>
            {product.trackStock && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">คงเหลือ<input inputMode="numeric" type="number" min="0" value={product.currentStock} onChange={(event) => setProduct({ ...product, currentStock: Number(event.target.value) })} className={input} /></label><label className="text-sm font-bold">เตือนเมื่อเหลือ<input inputMode="numeric" type="number" min="0" value={product.minStock} onChange={(event) => setProduct({ ...product, minStock: Number(event.target.value) })} className={input} /></label></div>}
          </div>
        </details>
        <Button disabled={saving} onClick={onSave} className="h-16 rounded-2xl bg-[#1697a8] text-lg font-black">{saving ? "กำลังบันทึก..." : "บันทึกสินค้า"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function EasySettingsView({ data, connected, pendingSyncCount, syncing, appPricingEnabled, onAppPricingChange, onRefresh, onSync, onAdd, onEdit, onArchive }: { data: QuickBootstrap; connected: boolean; pendingSyncCount: number; syncing: boolean; appPricingEnabled: boolean; onAppPricingChange: (enabled: boolean) => void; onRefresh: () => void; onSync: () => void; onAdd: () => void; onEdit: (product: QuickProduct) => void; onArchive: (product: QuickProduct) => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const products = data.products.filter((product) => product.active && product.name.toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")));
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleProducts = products.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return <main className="mx-auto max-w-5xl p-4 pb-40 sm:p-5 sm:pb-40 lg:h-[calc(100dvh-5rem)] lg:overflow-hidden lg:p-5 lg:pb-5">
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-sm text-slate-400">ตั้งค่าร้าน</p><h1 className="text-3xl font-black">จัดการสินค้า</h1></div>
      <Button onClick={onAdd} className="h-14 rounded-2xl bg-[#1697a8] px-5 font-black"><CirclePlus className="size-5" />เพิ่มสินค้า</Button>
    </div>

    <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#153f46] p-3 text-white">
      <div className="flex min-w-0 items-center gap-3"><Cloud className="size-6 shrink-0 text-[#55d5df]" /><div className="min-w-0"><p className="font-black">บันทึกเร็วใน iPad และซิงก์อัตโนมัติ</p><p className="truncate text-xs text-white/60">{pendingSyncCount > 0 ? `${syncing ? "กำลังส่ง" : "รอส่ง"} ${pendingSyncCount} บิลไป Google Sheet` : connected ? "ข้อมูลทั้งหมดส่งไป Google Sheet แล้ว" : "ข้อมูลใหม่จะเก็บในเครื่องจนกว่าอินเทอร์เน็ตกลับมา"}</p></div></div>
      <div className="flex gap-2"><button onClick={onRefresh} className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10" aria-label="โหลดข้อมูลสินค้าใหม่"><RefreshCw className="size-5" /></button><Button onClick={onSync} disabled={syncing || pendingSyncCount === 0} className="h-12 rounded-xl bg-[#1697a8] px-4 font-black">{syncing ? "กำลังซิงก์" : pendingSyncCount > 0 ? `ซิงก์ตอนนี้ (${pendingSyncCount})` : "ซิงก์แล้ว"}</Button></div>
    </section>

    <section className="mt-3 rounded-2xl bg-white px-4 py-2 shadow-sm">
      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4">
        <span><b className="block">ใช้ราคาแอป</b><small className="text-slate-400">ปิดไว้เพื่อป้องกันการเลือกผิด เปิดเมื่อต้องขายผ่านแอป</small></span>
        <input type="checkbox" checked={appPricingEnabled} onChange={(event) => onAppPricingChange(event.target.checked)} className="size-7 shrink-0 accent-[#1697a8]" />
      </label>
    </section>

    <section className="mt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">สินค้าที่เปิดขาย ({data.products.filter((product) => product.active).length})</h2><p className="text-sm text-slate-400">แตะดินสอเพื่อแก้ไข หรือถังขยะเพื่อซ่อนจากหน้าขาย</p></div><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="ค้นหาสินค้า" className="h-11 rounded-2xl border-2 border-slate-100 bg-white px-4 outline-none focus:border-[#1697a8] sm:w-64" /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {visibleProducts.map((product) => <article key={product.id} className="flex min-h-20 items-center gap-3 rounded-[22px] bg-white p-2.5 shadow-sm">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#e2f4f5] bg-cover bg-center text-2xl" style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}>{!product.imageUrl && "🍞"}</div>
          <div className="min-w-0 flex-1"><p className="truncate font-black">{product.name}</p><p className="text-sm text-slate-500">ขาย {money(product.price)} · ทุน {money(product.cost)}</p>{appPricingEnabled && <p className="text-xs font-bold text-[#168f9f]">ราคาแอป {money(product.appPrice || product.price)}</p>}</div>
          <button onClick={() => onEdit(product)} className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-100" aria-label={`แก้ไข ${product.name}`}><Pencil className="size-5" /></button>
          <button onClick={() => onArchive(product)} className="grid size-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500" aria-label={`ซ่อน ${product.name}`}><Trash2 className="size-5" /></button>
        </article>)}
        {products.length === 0 && <div className="col-span-full rounded-2xl bg-white p-8 text-center font-bold text-slate-400">ไม่พบสินค้า</div>}
      </div>
      {pageCount > 1 && <Pager page={safePage} pageCount={pageCount} onPageChange={setPage} />}
    </section>
  </main>;
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Store; label: string; onClick: () => void }) { return <button onClick={onClick} className={`flex min-w-28 flex-col items-center justify-center gap-1 rounded-full px-5 py-2 font-bold ${active ? "bg-[#def3f5] text-[#117c88]" : "text-slate-400"}`}><Icon className="size-6" /><span className="text-sm">{label}</span></button>; }
function TopNavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Store; label: string; onClick: () => void }) { return <button onClick={onClick} className={`flex min-h-12 items-center gap-2 rounded-xl px-4 font-black transition ${active ? "bg-white text-[#117c88] shadow-sm" : "text-slate-500 hover:bg-white/60"}`}><Icon className="size-5" /><span>{label}</span></button>; }
function Pager({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) { return <div className="mt-3 flex items-center justify-center gap-3"><button disabled={page === 0} onClick={() => onPageChange(page - 1)} className="min-h-11 rounded-xl bg-white px-5 font-black shadow-sm disabled:opacity-30">ก่อนหน้า</button><span className="min-w-20 text-center text-sm font-black">หน้า {page + 1}/{pageCount}</span><button disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)} className="min-h-11 rounded-xl bg-white px-5 font-black shadow-sm disabled:opacity-30">ถัดไป</button></div>; }
