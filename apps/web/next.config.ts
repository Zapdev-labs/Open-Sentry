import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@sentry-clone/db"],
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  serverExternalPackages: ["postgres", "better-auth", "@better-auth/drizzle-adapter"],
};

export default nextConfig;
