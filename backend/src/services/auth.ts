import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import { prisma } from "../db.ts";

export const SESSION_COOKIE = "vx_admin";
const SESSION_HOURS = 8;

export interface Session {
  sub: string;
  email: string;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export function signSession(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email } satisfies Omit<Session, "sub">, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: `${SESSION_HOURS}h`,
    issuer: "voltex-api",
  });
}

export function verifySession(token: string): Session | null {
  try {
    const p = jwt.verify(token, config.JWT_SECRET, { issuer: "voltex-api" }) as jwt.JwtPayload;
    return p.sub && typeof p.email === "string" ? { sub: p.sub, email: p.email } : null;
  } catch {
    return null;
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProd,
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60 * 1000,
});

// Compared against when the email is unknown, so a wrong email and a wrong password take the same time.
let dummyHash: string | undefined;

export async function authenticate(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) return null;
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

/** Creates or updates the admin named in ADMIN_EMAIL / ADMIN_PASSWORD. Used by the create-admin script and tests. */
export async function upsertAdmin(email: string, password: string, name = "Administrator") {
  if (password.length < 12) throw new Error("Admin password must be at least 12 characters.");
  const passwordHash = await hashPassword(password);
  return prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), passwordHash, name },
    update: { passwordHash },
  });
}
