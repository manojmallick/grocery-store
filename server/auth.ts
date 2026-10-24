import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? (IS_PRODUCTION ? "" : "admin");
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const SECRET = SESSION_SECRET || (IS_PRODUCTION ? "" : randomBytes(32).toString("hex"));
if (IS_PRODUCTION && Buffer.byteLength(ADMIN_PASSWORD) < 12) {
  throw new Error("ADMIN_PASSWORD must contain at least 12 bytes in production");
}
if (IS_PRODUCTION && Buffer.byteLength(SESSION_SECRET) < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 bytes in production");
}
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
export const COOKIE_NAME = "blog_session";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function createSessionToken(): string {
  const expires = String(Date.now() + SESSION_TTL_MS);
  return `${expires}.${sign(expires)}`;
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, mac] = token.split(".");
  if (!expires || !mac) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = sign(expires);
  return (
    mac.length === expected.length &&
    timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  );
}

export function checkPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionFromRequest(req: Request): string | undefined {
  const cookies = req.headers.cookie ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isValidSession(sessionFromRequest(req))) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}
