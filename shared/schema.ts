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
  organizationType: text("organization_type"), // senate, house, agency, lobbying_firm, think_tank, etc.
  startYear: integer("start_year"),
  endYear: integer("end_year"),
  startMonth: integer("start_month"),
  endMonth: integer("end_month"),
  policyAreas: text("policy_areas").array(), // healthcare, defense, environment, etc.
  supervisor: text("supervisor"), // Who they worked for
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

// Matters (sub-clients - Adam's own clients for research)
export const matters = pgTable("matters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"), // active, archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMatterSchema = createInsertSchema(matters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMatter = z.infer<typeof insertMatterSchema>;
export type Matter = typeof matters.$inferSelect;

// Research documents (URLs, PDFs, Word docs) for each matter
export const researchDocuments = pgTable("research_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matterId: varchar("matter_id").notNull(),
  clientId: varchar("client_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(), // url, youtube, pdf, docx, article
  sourceUrl: text("source_url"),
  originalFilename: text("original_filename"),
  extractedContent: text("extracted_content"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertResearchDocumentSchema = createInsertSchema(researchDocuments).omit({
  id: true,
  createdAt: true,
});

export type InsertResearchDocument = z.infer<typeof insertResearchDocumentSchema>;
export type ResearchDocument = typeof researchDocuments.$inferSelect;

// Research conversations (AI Q&A per matter)
export const researchConversations = pgTable("research_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matterId: varchar("matter_id").notNull(),
  clientId: varchar("client_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertResearchConversationSchema = createInsertSchema(researchConversations).omit({
  id: true,
  createdAt: true,
});

export type InsertResearchConversation = z.infer<typeof insertResearchConversationSchema>;
export type ResearchConversation = typeof researchConversations.$inferSelect;

// Research messages (individual Q&A in a conversation)
export const researchMessages = pgTable("research_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertResearchMessageSchema = createInsertSchema(researchMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertResearchMessage = z.infer<typeof insertResearchMessageSchema>;
export type ResearchMessage = typeof researchMessages.$inferSelect;

// AI chat conversations and messages for the built-in chat feature
export const conversations = pgTable("conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Knowledge Base categories
export const kbCategories = pgTable("kb_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(), // 'owner' or 'client'
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKbCategorySchema = createInsertSchema(kbCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertKbCategory = z.infer<typeof insertKbCategorySchema>;
export type KbCategory = typeof kbCategories.$inferSelect;

// Knowledge Base articles
export const kbArticles = pgTable("kb_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(), // 'owner' or 'client'
  categoryId: varchar("category_id"),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  summary: text("summary"),
  content: text("content"), // markdown content
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKbArticleSchema = createInsertSchema(kbArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKbArticle = z.infer<typeof insertKbArticleSchema>;
export type KbArticle = typeof kbArticles.$inferSelect;

// Tooltips linking to KB articles
export const kbTooltips = pgTable("kb_tooltips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(), // 'owner' or 'client'
  key: text("key").notNull().unique(), // unique identifier for the tooltip location
  articleId: varchar("article_id"),
  label: text("label").notNull(), // tooltip text
  page: text("page"), // which page this tooltip appears on
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKbTooltipSchema = createInsertSchema(kbTooltips).omit({
  id: true,
  createdAt: true,
});

export type InsertKbTooltip = z.infer<typeof insertKbTooltipSchema>;
export type KbTooltip = typeof kbTooltips.$inferSelect;

// Security status for owner and clients
export const securityStatus = pgTable("security_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(), // 'owner' for platform, 'client' for specific client
  clientId: varchar("client_id"), // null for owner scope
  level: text("level").notNull().default("standard"), // basic, standard, enhanced, enterprise
  notes: text("notes"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSecurityStatusSchema = createInsertSchema(securityStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSecurityStatus = z.infer<typeof insertSecurityStatusSchema>;
export type SecurityStatus = typeof securityStatus.$inferSelect;

// Security controls (individual security measures)
export const securityControls = pgTable("security_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(), // 'owner' or 'client'
  clientId: varchar("client_id"), // null for owner scope
  name: text("name").notNull(),
  category: text("category"), // access, encryption, audit, compliance
  status: text("status").notNull().default("enabled"), // enabled, disabled, pending
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSecurityControlSchema = createInsertSchema(securityControls).omit({
  id: true,
  createdAt: true,
});

export type InsertSecurityControl = z.infer<typeof insertSecurityControlSchema>;
export type SecurityControl = typeof securityControls.$inferSelect;

// Client portals (client-client sub-portals)
export const clientPortals = pgTable("client_portals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  slug: text("slug").notNull(), // unique per client
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientPortalSchema = createInsertSchema(clientPortals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientPortal = z.infer<typeof insertClientPortalSchema>;
export type ClientPortal = typeof clientPortals.$inferSelect;

// Portal matter access (which matters are shared with which portal)
export const portalMatterAccess = pgTable("portal_matter_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalId: varchar("portal_id").notNull(),
  matterId: varchar("matter_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortalMatterAccessSchema = createInsertSchema(portalMatterAccess).omit({
  id: true,
  createdAt: true,
});

export type InsertPortalMatterAccess = z.infer<typeof insertPortalMatterAccessSchema>;
export type PortalMatterAccess = typeof portalMatterAccess.$inferSelect;
