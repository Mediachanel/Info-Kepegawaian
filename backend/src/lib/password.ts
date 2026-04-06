import crypto from "crypto";

export function verifyPassword(input: string, stored: string | null | undefined): boolean {
  if (!stored) return false;

  // format: sha256$salt$hash
  if (stored.startsWith("sha256$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const hash = parts[2];

    const cand = crypto.createHash("sha256").update(salt + input).digest("hex");
    return cand === hash;
  }

  // fallback: plain text
  return input === stored;
}
