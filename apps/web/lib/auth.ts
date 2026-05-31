import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getAuthDb } from "@/lib/db";
import * as authSchema from "@sentry-clone/db/auth-schema";

const githubConfigured =
  Boolean(process.env.GITHUB_CLIENT_ID) && Boolean(process.env.GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "Sentry Clone",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
  database: drizzleAdapter(getAuthDb(), {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  ...(githubConfigured
    ? {
        socialProviders: {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        },
      }
    : {}),
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

export async function getSession() {
  const { headers } = await import("next/headers");
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
