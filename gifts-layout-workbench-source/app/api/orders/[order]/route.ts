import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { giftsFetch, safeOrderNumber } from "../../../../lib/gifts";
import { sessionCookie, unseal } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ order: string }> }) {
  const { order } = await params;
  if (!safeOrderNumber(order)) return NextResponse.json({ error: "Некорректный номер заказа." }, { status: 400 });

  try {
    const store = await cookies();
    const raw = store.get(sessionCookie.name)?.value;
    if (!raw) return NextResponse.json({ error: "Сначала войдите в gifts.ru через Макетную." }, { status: 401 });
    const giftsCookie = unseal(raw);
    const res = await giftsFetch("/private/order/" + order, giftsCookie);
    const html = await res.text();
    if (!res.ok || /data-hash="https:\/\/gifts\.ru\/auth"|>войти<\/span>/i.test(html)) {
      return NextResponse.json({ error: "Сессия gifts.ru не активна." }, { status: 401 });
    }
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
