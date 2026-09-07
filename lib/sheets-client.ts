"use client";

const URL_KEY = "breadflow-google-script-url";

export function getSavedScriptUrl(): string {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(URL_KEY) ?? "";
}

export function saveScriptUrl(url: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(URL_KEY, url.trim());
}

export async function sheetRequest<T>(action: string, payload?: Record<string, unknown>, scriptUrl = getSavedScriptUrl()): Promise<T> {
  if (!scriptUrl) throw new Error("ยังไม่ได้เชื่อม Google Apps Script");
  const response = await fetch(payload ? "/api/sheets" : `/api/sheets?action=${encodeURIComponent(action)}`, {
    method: payload ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "x-google-script-url": scriptUrl,
    },
    body: payload ? JSON.stringify({ action, ...payload }) : undefined,
    cache: "no-store",
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok || result.error) throw new Error(result.error || "Google Sheet ไม่ตอบสนอง");
  return result;
}
