import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { giftsFetch, safeItemId, safeOrderNumber } from "../../../../../../lib/gifts";
import { sessionCookie, unseal } from "../../../../../../lib/session";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ order: string; item: string }> }) {
  const { order, item } = await params;
  if (!safeOrderNumber(order) || !safeItemId(item)) {
    return NextResponse.json({ error: "Некорректные параметры." }, { status: 400 });
  }

  try {
    const store = await cookies();
    const raw = store.get(sessionCookie.name)?.value;
    if (!raw) return NextResponse.json({ error: "Сначала войдите." }, { status: 401 });
    const giftsCookie = unseal(raw);
    const url = "/drawing?action=getOrderItemPdf&orderitemid=" + encodeURIComponent(item);
    const res = await giftsFetch(url, giftsCookie);
    const bytes = await res.arrayBuffer();
    if (!res.ok || bytes.byteLength < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return NextResponse.json({ error: "gifts.ru не вернул PDF." }, { status: 502 });
    }
    return new NextResponse(bytes, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${order}_${item}.pdf"`,
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
