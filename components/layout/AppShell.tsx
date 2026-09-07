"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  PackageSearch,
  Settings,
  Store,
  WalletCards,
  Clock3,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/pos", label: "หน้าขาย", icon: CreditCard },
  { href: "/dashboard", label: "ภาพรวมร้าน", icon: BarChart3 },
  { href: "/products", label: "สินค้าและราคา", icon: PackageSearch },
  { href: "/inventory", label: "สต็อกและของเสีย", icon: Boxes },
  { href: "/orders", label: "ประวัติการขาย", icon: ClipboardList },
  { href: "/expenses", label: "ค่าใช้จ่าย", icon: WalletCards },
  { href: "/shifts", label: "กะและเงินสด", icon: Clock3 },
  { href: "/settings", label: "ตั้งค่าร้าน", icon: Settings },
];

interface AppShellProps {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function AppShell({ title, description, children, actions }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[#f6f7f9] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-slate-950 text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
            <Store className="size-6" />
          </div>
          <div>
            <p className="font-black tracking-tight">BreadFlow POS</p>
            <p className="text-xs text-slate-400">บริหารร้านให้เห็นกำไร</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 p-4">
          {navigation.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition",
                  active
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-5 text-xs leading-5 text-slate-400">
          ข้อมูลต้นทุนและกำไรอัปเดตจากทุกออเดอร์
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">{title}</h1>
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            </div>
            {actions}
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-5 pb-28 lg:p-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white p-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:hidden">
        {navigation.slice(0, 6).map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-24 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold",
                active ? "bg-slate-950 text-white" : "text-slate-500",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
