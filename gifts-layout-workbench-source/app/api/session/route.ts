import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookie, unseal } from "../../../lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const store = await cookies();
    const raw = store.get(sessionCookie.name)?.value;
    if (!raw) return NextResponse.json({ active: false });
    unseal(raw);
    return NextResponse.json({ active: true });
  } catch {
    return NextResponse.json({ active: false });
  }
}
