import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Client firms (companies that license the SaaS)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Client users (users belonging to a client firm)
export const clientUsers = pgTable("client_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  clientId: varchar("client_id").notNull(),
  role: text("role").notNull().default("member"), // admin, member
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientUserSchema = createInsertSchema(clientUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertClientUser = z.infer<typeof insertClientUserSchema>;
export type ClientUser = typeof clientUsers.$inferSelect;

// Super admins (platform administrators for Newco)
export const superAdmins = pgTable("super_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSuperAdminSchema = createInsertSchema(superAdmins).omit({
  id: true,
  createdAt: true,
});

export type InsertSuperAdmin = z.infer<typeof insertSuperAdminSchema>;
export type SuperAdmin = typeof superAdmins.$inferSelect;

// Political contacts (staffers, officials, etc.)
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"),
  organization: text("organization"),
  email: text("email"),
  phone: text("phone"),
  party: text("party"),
  state: text("state"),
  chamber: text("chamber"), // House, Senate, Administration, etc.
  imageUrl: text("image_url"),
  notes: text("notes"),
  priority: integer("priority").default(0), // 0-5 priority level
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Career history for contacts (pattern of career)
export const careerHistory = pgTable("career_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  title: text("title").notNull(),
  organization: text("organization").notNull(),
  startYear: integer("start_year"),
  endYear: integer("end_year"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCareerHistorySchema = createInsertSchema(careerHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertCareerHistory = z.infer<typeof insertCareerHistorySchema>;
export type CareerHistory = typeof careerHistory.$inferSelect;

// Contact connections/relationships
export const contactConnections = pgTable("contact_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  connectedContactId: varchar("connected_contact_id").notNull(),
  relationship: text("relationship"), // mentor, colleague, former staff, etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactConnectionSchema = createInsertSchema(contactConnections).omit({
  id: true,
  createdAt: true,
});

export type InsertContactConnection = z.infer<typeof insertContactConnectionSchema>;
export type ContactConnection = typeof contactConnections.$inferSelect;

// News articles
export const newsArticles = pgTable("news_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  source: text("source"),
  url: text("url"),
  category: text("category"), // legislation, executive, judiciary, policy, etc.
  isRead: boolean("is_read").default(false),
  isFlagged: boolean("is_flagged").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;
export type NewsArticle = typeof newsArticles.$inferSelect;
