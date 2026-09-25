import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readBasket } from "../../../lib/gifts";
import { sessionCookie, unseal } from "../../../lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const store = await cookies();
    const raw = store.get(sessionCookie.name)?.value;
    if (!raw) return NextResponse.json({ error: "Сначала войдите в gifts.ru через Макетную." }, { status: 401 });
    const giftsCookie = unseal(raw);
    const numbers = await readBasket(giftsCookie);
    return NextResponse.json({ orders: numbers.map(number => ({ number })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
