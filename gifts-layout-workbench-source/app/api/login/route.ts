import { NextResponse } from "next/server";
import { giftsLogin } from "../../../lib/gifts";
import { seal, sessionCookie } from "../../../lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const login = String(body.login || "").trim();
    const password = String(body.password || "");
    const code = String(body.code || "").trim();
    if (!login || !password) return NextResponse.json({ error: "Введите логин и пароль." }, { status: 400 });

    const giftsCookie = await giftsLogin(login, password, code);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie.name, seal(giftsCookie), sessionCookie.options);
    return response;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return response;
}
