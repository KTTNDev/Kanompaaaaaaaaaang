const allowedScriptUrl = (value: string) => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(value);
const FIXED_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWG2DND6nKk4sMQnGyM5dohaXQ9ibNA3uM3Ckkx4T6hysC8sgT3np9z5m3A2hirhgyOA/exec";

const resolveUrl = () => {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL?.trim() || FIXED_SCRIPT_URL;
  if (!allowedScriptUrl(url)) throw new Error("ระบบฐานข้อมูล Google Sheet ตั้งค่าไม่ถูกต้อง");
  return url;
};

const relay = async (response: Response) => {
  const text = await response.text();
  return new Response(text, { status: response.ok ? 200 : response.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
};

export async function GET(request: Request) {
  try {
    const source = new URL(request.url);
    const target = new URL(resolveUrl());
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
    return relay(await fetch(resolveUrl(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, cache: "no-store", redirect: "follow" }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "บันทึก Google Sheet ไม่สำเร็จ" }, { status: 400 });
  }
}
