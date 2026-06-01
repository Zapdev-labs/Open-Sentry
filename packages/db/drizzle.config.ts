import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/schema.ts",
    "./src/auth-schema.ts",
    "./src/schema-enterprise.ts",
  ],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://sentry:sentry@localhost:5432/sentry_clone",
  },
});
