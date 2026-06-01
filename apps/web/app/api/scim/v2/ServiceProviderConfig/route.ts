import { authenticateScimRequest, scimError, scimJson } from "@/lib/scim-auth";

export async function GET(request: Request) {
  const auth = await authenticateScimRequest(request);
  if (!auth) return scimError(401, "Invalid or missing SCIM bearer token");
  return scimJson({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://docs.example.com/scim",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 1, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "SCIM Bearer Token",
        description: "Use a SCIM token issued from the Sentry-clone settings page.",
        specUri: "https://tools.ietf.org/html/rfc6750",
      },
    ],
  });
}
