"use client";

import type { QuickPaymentMethod, QuickSalesChannel } from "@/types/sheets";

export interface QueuedOrderInput {
  clientOrderId: string;
  channel: QuickSalesChannel;
  paymentMethod: QuickPaymentMethod;
  discount: number;
  receivedAmount: number;
  items: Array<{ productId: string; quantity: number }>;
}

export interface PendingOrder {
  id: string;
  createdAt: string;
  order: QueuedOrderInput;
  attempts: number;
  lastError: string;
}

const DB_NAME = "breadflow-pos";
const STORE_NAME = "pending-orders";
const FALLBACK_KEY = "breadflow-pending-orders-v1";

function readFallback(): PendingOrder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(FALLBACK_KEY) || "[]") as PendingOrder[];
  } catch {
    return [];
  }
}

function writeFallback(orders: PendingOrder[]) {
  window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(orders));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB ไม่พร้อมใช้งาน"));
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("เปิดฐานข้อมูลในเครื่องไม่สำเร็จ"));
  });
}

async function writeIndexed(order: PendingOrder): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(order);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("บันทึกคิวไม่สำเร็จ"));
  });
  database.close();
}

async function readIndexed(): Promise<PendingOrder[]> {
  const database = await openDatabase();
  const orders = await new Promise<PendingOrder[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingOrder[]);
    request.onerror = () => reject(request.error || new Error("อ่านคิวไม่สำเร็จ"));
  });
  database.close();
  return orders;
}

async function removeIndexed(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("ลบคิวไม่สำเร็จ"));
  });
  database.close();
}

export async function savePendingOrder(order: PendingOrder): Promise<void> {
  try {
    await writeIndexed(order);
  } catch {
    const orders = readFallback().filter((item) => item.id !== order.id);
    writeFallback([...orders, order]);
  }
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  let indexed: PendingOrder[] = [];
  try {
    indexed = await readIndexed();
  } catch {
    // Safari private mode can reject IndexedDB; localStorage remains the fallback.
  }
  const merged = new Map<string, PendingOrder>();
  [...indexed, ...readFallback()].forEach((order) => merged.set(order.id, order));
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removePendingOrder(id: string): Promise<void> {
  try {
    await removeIndexed(id);
  } catch {
    // The order may live only in the localStorage fallback.
  }
  writeFallback(readFallback().filter((order) => order.id !== id));
}

export async function markPendingOrderFailed(order: PendingOrder, error: unknown): Promise<void> {
  await savePendingOrder({
    ...order,
    attempts: order.attempts + 1,
    lastError: error instanceof Error ? error.message : "เชื่อมต่อ Google Sheet ไม่สำเร็จ",
  });
}
