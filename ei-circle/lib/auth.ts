const AUTH_SECRET = process.env.AUTH_SECRET || "";

export function generateToken(email: string): string {
  return Buffer.from(`${email}:${AUTH_SECRET}`).toString("base64");
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const separatorIndex = decoded.lastIndexOf(":");
    if (separatorIndex === -1) return null;

    const email = decoded.slice(0, separatorIndex);
    const secret = decoded.slice(separatorIndex + 1);

    if (secret !== AUTH_SECRET || !email) return null;

    return email;
  } catch {
    return null;
  }
}

export function getAuthCookie(cookies: any): string | null {
  if (!cookies) return null;
  return cookies.get("ei_token")?.value ?? cookies.ei_token ?? null;
}
