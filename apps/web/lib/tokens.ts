import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = {
  org: "osco",
  project: "oscp",
} as const;

export type TokenKind = keyof typeof TOKEN_PREFIX;

export interface IssuedToken {
  plaintext: string;
  lastFour: string;
  hash: string;
}

export function issueToken(kind: TokenKind): IssuedToken {
  const prefix = TOKEN_PREFIX[kind];
  const random = randomBytes(24).toString("hex");
  const plaintext = `${prefix}_${random}`;
  return {
    plaintext,
    lastFour: plaintext.slice(-4),
    hash: hashToken(plaintext),
  };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function verifyToken(plaintext: string, hash: string): boolean {
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(hashToken(plaintext), "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
