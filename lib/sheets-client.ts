"use client";

export async function sheetRequest<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch(payload ? "/api/sheets" : `/api/sheets?action=${encodeURIComponent(action)}`, {
    method: payload ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify({ action, ...payload }) : undefined,
    cache: "no-store",
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok || result.error) throw new Error(result.error || "Google Sheet ไม่ตอบสนอง");
  return result;
}
