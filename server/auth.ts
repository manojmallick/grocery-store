import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin";
// Sessions survive restarts only when SESSION_SECRET is set — fine for a single admin.
const SECRET = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
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
