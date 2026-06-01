import { randomBytes } from "node:crypto";
import { hashToken, verifyToken } from "@/lib/tokens";
import { findActiveScimTokenByHash, touchScimTokenLastUsed } from "@/lib/queries-scim";

export interface ScimAuthResult {
  organizationId: string;
  tokenId: string;
}

const SCIM_TOKEN_PREFIX = "scim_";

/**
 * Extract a SCIM bearer token from the Authorization header and verify it.
 * Returns the resolved org on success, or null on failure.
 */
export async function authenticateScimRequest(
  request: Request
): Promise<ScimAuthResult | null> {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(auth.trim());
  if (!match || !match[1]) return null;
  const token = match[1];
  if (!token.startsWith(SCIM_TOKEN_PREFIX)) return null;

  const tokenHash = hashToken(token);
  const record = await findActiveScimTokenByHash(tokenHash);
  if (!record) return null;

  // Defense in depth: re-verify via constant-time compare against stored hash
  if (!verifyToken(token, record.tokenHash)) return null;

  // Update lastUsedAt fire-and-forget; never block the response
  void touchScimTokenLastUsed(record.id).catch(() => {});

  return { organizationId: record.organizationId, tokenId: record.id };
}

export function scimError(
  status: number,
  detail: string,
  scimType?: string
): Response {
  const body: Record<string, unknown> = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail,
    status,
  };
  if (scimType) body.scimType = scimType;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/scim+json" },
  });
}

export function scimJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/scim+json" },
  });
}

export function issueScimToken(): { plaintext: string; lastFour: string; hash: string } {
  const random = randomBytes(24).toString("hex");
  const plaintext = `${SCIM_TOKEN_PREFIX}${random}`;
  return {
    plaintext,
    lastFour: plaintext.slice(-4),
    hash: hashToken(plaintext),
  };
}
