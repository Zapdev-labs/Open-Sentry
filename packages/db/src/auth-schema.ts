import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Clerk organization id (`org_…`) is the primary key. */
export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organization_slug_unique").on(table.slug)]
);

/** Clerk user id (`user_…`) is the primary key. */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)]
);

/** Clerk organization membership id (`orgmem_…`) is the primary key. */
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_org_user_unique").on(table.organizationId, table.userId),
  ]
);
