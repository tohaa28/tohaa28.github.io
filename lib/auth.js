import { createJar, serializeJar } from "./gifts.js";
import { readSession, writeSession } from "./session.js";

export function sessionJar(req) {
  const session = readSession(req);
  if (!session?.jar) return null;
  try { return createJar(session.jar); } catch { return null; }
}

export async function persistJar(res, jar) {
  writeSession(res, { jar: await serializeJar(jar), updatedAt: Date.now() });
}
