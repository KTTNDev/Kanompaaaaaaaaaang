const allowedScriptUrl = (value: string) => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(value);

const resolveUrl = (request: Request) => {
  const headerUrl = request.headers.get("x-google-script-url")?.trim() ?? "";
  const configuredUrl = process.env.GOOGLE_SHEETS_WEB_APP_URL?.trim() ?? "";
  const url = headerUrl || configuredUrl;
  if (!allowedScriptUrl(url)) throw new Error("กรุณาใส่ Google Apps Script Web App URL ที่ถูกต้องในหน้าตั้งค่า");
  return url;
};

const relay = async (response: Response) => {
  const text = await response.text();
  return new Response(text, { status: response.ok ? 200 : response.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
};

export async function GET(request: Request) {
  try {
    const source = new URL(request.url);
    const target = new URL(resolveUrl(request));
    target.searchParams.set("action", source.searchParams.get("action") || "bootstrap");
    target.searchParams.set("_", Date.now().toString());
    return relay(await fetch(target, { cache: "no-store", redirect: "follow" }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "เชื่อม Google Sheet ไม่สำเร็จ" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    return relay(await fetch(resolveUrl(request), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, cache: "no-store", redirect: "follow" }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "บันทึก Google Sheet ไม่สำเร็จ" }, { status: 400 });
  }
}
