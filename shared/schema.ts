import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, json } from "drizzle-orm/pg-core";
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
  address: text("address"),
  phone: text("phone"),
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

// Client applications (pending client signups)
export const clientApplications = pgTable("client_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  industry: text("industry"),
  companySize: text("company_size"),
  website: text("website"),
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  rejectionReason: text("rejection_reason"),
  approvedClientId: varchar("approved_client_id"),
  // Onboarding fields
  primaryGoals: text("primary_goals").array(), // legislation_tracking, contact_management, research, news_monitoring
  firmSize: text("firm_size"), // 1-5, 6-20, 21-50, 51-100, 100+
  howHeardAboutUs: text("how_heard_about_us"), // referral, search, conference, advertisement, social_media, other
  referralSource: text("referral_source"), // if referral, who referred
  currentTools: text("current_tools"), // what tools they currently use
  expectedUsers: text("expected_users"), // how many users expected
  urgency: text("urgency"), // immediate, within_month, exploring
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientApplicationSchema = createInsertSchema(clientApplications).omit({
  id: true,
  status: true,
  emailVerified: true,
  emailVerificationToken: true,
  emailVerificationExpires: true,
  rejectionReason: true,
  approvedClientId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientApplication = z.infer<typeof insertClientApplicationSchema>;
export type ClientApplication = typeof clientApplications.$inferSelect;

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
  externalId: varchar("external_id"), // Source's article ID for deduplication
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content"), // Full article content
  source: text("source"),
  author: text("author"),
  url: text("url"),
  category: text("category"), // legislation, executive, campaign, policy
  imageUrl: text("image_url"),
  relevanceScore: integer("relevance_score").default(0), // 0-100 score
  matchedTopics: jsonb("matched_topics"), // Array of matched topics
  isRead: boolean("is_read").default(false),
  isFlagged: boolean("is_flagged").default(false),
  isBookmarked: boolean("is_bookmarked").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;
export type NewsArticle = typeof newsArticles.$inferSelect;

// News preferences per client
export const newsPreferences = pgTable("news_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  preferredSources: jsonb("preferred_sources"), // Array of source names
  excludedSources: jsonb("excluded_sources"), // Sources to exclude
  trackedTopics: jsonb("tracked_topics"), // Topics to track for relevance
  alertThreshold: integer("alert_threshold").default(70), // Minimum score for alerts
  emailAlerts: boolean("email_alerts").default(true),
  alertFrequency: text("alert_frequency").default("daily"), // real_time, daily, weekly
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsPreferencesSchema = createInsertSchema(newsPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNewsPreferences = z.infer<typeof insertNewsPreferencesSchema>;
export type NewsPreferences = typeof newsPreferences.$inferSelect;

// RSS Feeds for news aggregation
export const rssFeeds = pgTable("rss_feeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  feedUrl: text("feed_url").notNull(),
  websiteUrl: text("website_url"),
  category: text("category").default("politics"), // politics, defense, policy, legislative
  tier: integer("tier").default(2), // 1 = essential, 2 = recommended, 3 = specialized
  isActive: boolean("is_active").default(true),
  fetchFrequency: integer("fetch_frequency").default(60), // Minutes between fetches
  lastFetchedAt: timestamp("last_fetched_at"),
  lastFetchStatus: text("last_fetch_status"), // success, error
  lastFetchError: text("last_fetch_error"),
  articleCount: integer("article_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRssFeedSchema = createInsertSchema(rssFeeds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRssFeed = z.infer<typeof insertRssFeedSchema>;
export type RssFeed = typeof rssFeeds.$inferSelect;

// RSS Feed Client Assignments - which clients can see which feeds
export const rssFeedClientAssignments = pgTable("rss_feed_client_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedId: varchar("feed_id").notNull(),
  clientId: varchar("client_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by"), // userId who assigned
});

export const insertRssFeedClientAssignmentSchema = createInsertSchema(rssFeedClientAssignments).omit({
  id: true,
  assignedAt: true,
});

export type InsertRssFeedClientAssignment = z.infer<typeof insertRssFeedClientAssignmentSchema>;
export type RssFeedClientAssignment = typeof rssFeedClientAssignments.$inferSelect;

// News alerts sent (track which alerts have been sent)
export const newsAlertsSent = pgTable("news_alerts_sent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull(),
  clientId: varchar("client_id").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

export type NewsAlertSent = typeof newsAlertsSent.$inferSelect;

// High Intent Keywords - keywords to watch for in news articles
export const highIntentKeywords = pgTable("high_intent_keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  keyword: text("keyword").notNull(),
  category: text("category"), // legislation, defense, healthcare, etc.
  priority: text("priority").default("normal"), // high, normal, low
  isActive: boolean("is_active").default(true),
  matchCount: integer("match_count").default(0), // how many articles matched
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHighIntentKeywordSchema = createInsertSchema(highIntentKeywords).omit({
  id: true,
  matchCount: true,
  createdAt: true,
});

export type InsertHighIntentKeyword = z.infer<typeof insertHighIntentKeywordSchema>;
export type HighIntentKeyword = typeof highIntentKeywords.$inferSelect;

// News Article Portal Assignments - assign articles to client portals
export const newsArticlePortalAssignments = pgTable("news_article_portal_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull(),
  portalId: varchar("portal_id").notNull(),
  clientId: varchar("client_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by"),
});

export const insertNewsArticlePortalAssignmentSchema = createInsertSchema(newsArticlePortalAssignments).omit({
  id: true,
  assignedAt: true,
});

export type InsertNewsArticlePortalAssignment = z.infer<typeof insertNewsArticlePortalAssignmentSchema>;
export type NewsArticlePortalAssignment = typeof newsArticlePortalAssignments.$inferSelect;

// Committee Meeting Portal Assignments - assign committee meetings to client portals
export const committeeMeetingPortalAssignments = pgTable("committee_meeting_portal_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: integer("event_id").notNull(),
  chamber: text("chamber").notNull(),
  congress: integer("congress").notNull(),
  title: text("title"),
  meetingDate: text("meeting_date"),
  committees: text("committees"),
  location: text("location"),
  portalId: varchar("portal_id").notNull(),
  clientId: varchar("client_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by"),
});

export const insertCommitteeMeetingPortalAssignmentSchema = createInsertSchema(committeeMeetingPortalAssignments).omit({
  id: true,
  assignedAt: true,
});

export type InsertCommitteeMeetingPortalAssignment = z.infer<typeof insertCommitteeMeetingPortalAssignmentSchema>;
export type CommitteeMeetingPortalAssignment = typeof committeeMeetingPortalAssignments.$inferSelect;

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

// Portal tracked bill access (which bills are shared with which portal)
export const portalTrackedBills = pgTable("portal_tracked_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalId: varchar("portal_id").notNull(),
  trackedBillId: varchar("tracked_bill_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortalTrackedBillSchema = createInsertSchema(portalTrackedBills).omit({
  id: true,
  createdAt: true,
});

export type InsertPortalTrackedBill = z.infer<typeof insertPortalTrackedBillSchema>;
export type PortalTrackedBill = typeof portalTrackedBills.$inferSelect;

// Portal AI Conversations (for Firm's Client portals)
export const portalConversations = pgTable("portal_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalId: varchar("portal_id").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalConversationSchema = createInsertSchema(portalConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPortalConversation = z.infer<typeof insertPortalConversationSchema>;
export type PortalConversation = typeof portalConversations.$inferSelect;

// Portal AI Messages
export const portalMessages = pgTable("portal_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortalMessageSchema = createInsertSchema(portalMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertPortalMessage = z.infer<typeof insertPortalMessageSchema>;
export type PortalMessage = typeof portalMessages.$inferSelect;

// YouTube watch list for auto-transcription
export const youtubeWatchList = pgTable("youtube_watch_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  videoUrl: text("video_url").notNull(),
  videoId: text("video_id").notNull(),
  title: text("title"),
  channelName: text("channel_name"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  transcriptAvailable: boolean("transcript_available").default(false),
  lastCheckedAt: timestamp("last_checked_at"),
  matterId: varchar("matter_id"), // optional - which matter to save to
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertYoutubeWatchListSchema = createInsertSchema(youtubeWatchList).omit({
  id: true,
  createdAt: true,
  lastCheckedAt: true,
});

export type InsertYoutubeWatchList = z.infer<typeof insertYoutubeWatchListSchema>;
export type YoutubeWatchList = typeof youtubeWatchList.$inferSelect;

// Bill tracking for clients
export const trackedBills = pgTable("tracked_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  congress: integer("congress").notNull(), // e.g., 119
  billType: text("bill_type").notNull(), // hr, s, hjres, sjres, etc.
  billNumber: integer("bill_number").notNull(),
  title: text("title"),
  sponsor: text("sponsor"),
  sponsorParty: text("sponsor_party"),
  sponsorState: text("sponsor_state"),
  introducedDate: text("introduced_date"),
  latestAction: text("latest_action"),
  latestActionDate: text("latest_action_date"),
  status: text("status"), // introduced, passed_house, passed_senate, enacted, etc.
  policyArea: text("policy_area"),
  notes: text("notes"),
  matterId: varchar("matter_id"), // optional - link to a matter
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrackedBillSchema = createInsertSchema(trackedBills).omit({
  id: true,
  createdAt: true,
  lastSyncedAt: true,
});

export type InsertTrackedBill = z.infer<typeof insertTrackedBillSchema>;
export type TrackedBill = typeof trackedBills.$inferSelect;

// Bill change history (to track what changed in tracked bills)
export const billChangeHistory = pgTable("bill_change_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackedBillId: varchar("tracked_bill_id").notNull(),
  changeType: text("change_type").notNull(), // status_change, action_update, amendment, cosponsors
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  description: text("description"),
  detectedAt: timestamp("detected_at").defaultNow(),
  isRead: boolean("is_read").default(false),
});

export const insertBillChangeHistorySchema = createInsertSchema(billChangeHistory).omit({
  id: true,
  detectedAt: true,
  isRead: true,
});

export type InsertBillChangeHistory = z.infer<typeof insertBillChangeHistorySchema>;
export type BillChangeHistory = typeof billChangeHistory.$inferSelect;

// Bill tracking alerts (user preferences for notifications)
export const billTrackingAlerts = pgTable("bill_tracking_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trackedBillId: varchar("tracked_bill_id").notNull(),
  clientId: varchar("client_id").notNull(),
  alertOnStatusChange: boolean("alert_on_status_change").default(true),
  alertOnNewAction: boolean("alert_on_new_action").default(true),
  alertOnAmendment: boolean("alert_on_amendment").default(true),
  alertOnCosponsorChange: boolean("alert_on_cosponsor_change").default(false),
  emailNotification: boolean("email_notification").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBillTrackingAlertSchema = createInsertSchema(billTrackingAlerts).omit({
  id: true,
  createdAt: true,
});

export type InsertBillTrackingAlert = z.infer<typeof insertBillTrackingAlertSchema>;
export type BillTrackingAlert = typeof billTrackingAlerts.$inferSelect;

// Social media accounts to track (X/Twitter)
export const trackedSocialAccounts = pgTable("tracked_social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  platform: text("platform").notNull().default("x"), // x, twitter
  username: text("username").notNull(), // @handle without the @
  displayName: text("display_name"),
  profileUrl: text("profile_url"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrackedSocialAccountSchema = createInsertSchema(trackedSocialAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrackedSocialAccount = z.infer<typeof insertTrackedSocialAccountSchema>;
export type TrackedSocialAccount = typeof trackedSocialAccounts.$inferSelect;

// Keywords to track for each social account
export const socialTrackingKeywords = pgTable("social_tracking_keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  accountId: varchar("account_id"), // optional - if null, applies to all accounts for this client
  keyword: text("keyword").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSocialTrackingKeywordSchema = createInsertSchema(socialTrackingKeywords).omit({
  id: true,
  createdAt: true,
});

export type InsertSocialTrackingKeyword = z.infer<typeof insertSocialTrackingKeywordSchema>;
export type SocialTrackingKeyword = typeof socialTrackingKeywords.$inferSelect;

// Tracked posts/comments from social media
export const trackedSocialPosts = pgTable("tracked_social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  accountId: varchar("account_id").notNull(),
  platform: text("platform").notNull().default("x"),
  postId: text("post_id").notNull(), // original post ID from platform
  postUrl: text("post_url"),
  content: text("content"),
  authorUsername: text("author_username"),
  authorDisplayName: text("author_display_name"),
  postType: text("post_type").notNull().default("post"), // post, reply, repost, quote
  matchedKeywords: text("matched_keywords").array(), // which keywords matched this post
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  replies: integer("replies").default(0),
  postedAt: timestamp("posted_at"),
  isRead: boolean("is_read").default(false),
  isFlagged: boolean("is_flagged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrackedSocialPostSchema = createInsertSchema(trackedSocialPosts).omit({
  id: true,
  createdAt: true,
});

export type InsertTrackedSocialPost = z.infer<typeof insertTrackedSocialPostSchema>;
export type TrackedSocialPost = typeof trackedSocialPosts.$inferSelect;

// Engagement history for tracking metrics over time
export const socialEngagementHistory = pgTable("social_engagement_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  accountId: varchar("account_id").notNull(),
  postId: varchar("post_id"), // if tracking a specific post, otherwise null for account-level
  followers: integer("followers"),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  replies: integer("replies").default(0),
  impressions: integer("impressions"),
  engagementRate: text("engagement_rate"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const insertSocialEngagementHistorySchema = createInsertSchema(socialEngagementHistory).omit({
  id: true,
  recordedAt: true,
});

export type InsertSocialEngagementHistory = z.infer<typeof insertSocialEngagementHistorySchema>;
export type SocialEngagementHistory = typeof socialEngagementHistory.$inferSelect;

// Keyword alerts for notifications when keywords are matched
export const socialKeywordAlerts = pgTable("social_keyword_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  keywordId: varchar("keyword_id").notNull(),
  postId: varchar("post_id").notNull(),
  matchedKeyword: text("matched_keyword").notNull(),
  postContent: text("post_content"),
  authorUsername: text("author_username"),
  postUrl: text("post_url"),
  isRead: boolean("is_read").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSocialKeywordAlertSchema = createInsertSchema(socialKeywordAlerts).omit({
  id: true,
  createdAt: true,
});

export type InsertSocialKeywordAlert = z.infer<typeof insertSocialKeywordAlertSchema>;
export type SocialKeywordAlert = typeof socialKeywordAlerts.$inferSelect;

// Auto-sync configuration for scheduled monitoring
export const socialAutoSyncConfig = pgTable("social_auto_sync_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  isEnabled: boolean("is_enabled").default(false),
  syncIntervalMinutes: integer("sync_interval_minutes").default(60), // default 1 hour
  lastAutoSyncAt: timestamp("last_auto_sync_at"),
  nextScheduledSync: timestamp("next_scheduled_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSocialAutoSyncConfigSchema = createInsertSchema(socialAutoSyncConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSocialAutoSyncConfig = z.infer<typeof insertSocialAutoSyncConfigSchema>;
export type SocialAutoSyncConfig = typeof socialAutoSyncConfig.$inferSelect;

// Favorite Congress members (for quick access without searching)
export const favoriteCongressMembers = pgTable("favorite_congress_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  bioguideId: varchar("bioguide_id").notNull(), // Congress.gov bioguide ID
  name: text("name").notNull(),
  party: text("party"),
  state: text("state"),
  chamber: text("chamber"), // House or Senate
  imageUrl: text("image_url"),
  matterId: varchar("matter_id"), // Optional: assigned to a specific matter
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFavoriteCongressMemberSchema = createInsertSchema(favoriteCongressMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertFavoriteCongressMember = z.infer<typeof insertFavoriteCongressMemberSchema>;
export type FavoriteCongressMember = typeof favoriteCongressMembers.$inferSelect;

// Customers - People tracked in the customers portal (Congress members, staffers, etc.)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  title: text("title"), // e.g., "Chief of Staff", "Senator", "Representative"
  organization: text("organization"), // e.g., "Office of Sen. Johnson", "House Ways and Means Committee"
  email: text("email"),
  phone: text("phone"),
  party: text("party"), // D, R, I for political figures
  state: text("state"),
  sourceType: text("source_type").notNull(), // 'congress_member', 'staffer', 'manual'
  sourceId: text("source_id"), // bioguideId for congress members, null for staffers
  imageUrl: text("image_url"),
  notes: text("notes"),
  tags: text("tags").array(), // for categorizing customers
  matterId: varchar("matter_id"), // optional: link to a matter
  portalId: varchar("portal_id"), // optional: link to a client portal for assignment
  isActive: boolean("is_active").default(true),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Customer Portal Assignments - Many-to-many relationship between customers and portals
export const customerPortalAssignments = pgTable("customer_portal_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  portalId: varchar("portal_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by"), // userId who assigned
});

export const insertCustomerPortalAssignmentSchema = createInsertSchema(customerPortalAssignments).omit({
  id: true,
  assignedAt: true,
});

export type InsertCustomerPortalAssignment = z.infer<typeof insertCustomerPortalAssignmentSchema>;
export type CustomerPortalAssignment = typeof customerPortalAssignments.$inferSelect;

// Tracked influencers (via Influencers Club API)
export const trackedInfluencers = pgTable("tracked_influencers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  platform: text("platform").notNull(), // instagram, youtube, tiktok, twitter, twitch, onlyfans
  username: text("username").notNull(),
  displayName: text("display_name"),
  profileUrl: text("profile_url"),
  profilePictureUrl: text("profile_picture_url"),
  bio: text("bio"),
  followerCount: integer("follower_count"),
  followingCount: integer("following_count"),
  postCount: integer("post_count"),
  engagementRate: text("engagement_rate"), // stored as string for precision
  isVerified: boolean("is_verified").default(false),
  location: text("location"),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  rawData: text("raw_data"), // JSON string of full API response for additional data
  notes: text("notes"),
  keywords: text("keywords").array(), // Keywords to watch for in posts and comments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrackedInfluencerSchema = createInsertSchema(trackedInfluencers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrackedInfluencer = z.infer<typeof insertTrackedInfluencerSchema>;
export type TrackedInfluencer = typeof trackedInfluencers.$inferSelect;

// Influencer posts tracked from the API
export const influencerPosts = pgTable("influencer_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  influencerId: varchar("influencer_id").notNull(),
  platform: text("platform").notNull(),
  postId: text("post_id").notNull(), // platform-specific post ID
  postUrl: text("post_url"),
  content: text("content"),
  postType: text("post_type"), // post, reel, short, video, story
  mediaType: text("media_type"), // image, video, carousel
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  views: integer("views"),
  engagementRate: text("engagement_rate"),
  hashtags: text("hashtags").array(),
  postedAt: timestamp("posted_at"),
  isRead: boolean("is_read").default(false),
  isFlagged: boolean("is_flagged").default(false),
  rawData: text("raw_data"), // JSON string for additional post data
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInfluencerPostSchema = createInsertSchema(influencerPosts).omit({
  id: true,
  createdAt: true,
});

export type InsertInfluencerPost = z.infer<typeof insertInfluencerPostSchema>;
export type InfluencerPost = typeof influencerPosts.$inferSelect;

// Political Staffers database
export const staffers = pgTable("staffers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  currentPosition: text("current_position"),
  currentOrganization: text("current_organization"),
  currentMember: text("current_member"), // The member they work for
  chamber: text("chamber"), // House, Senate, Both, Former
  party: text("party"), // Republican, Democrat, Independent
  state: varchar("state", { length: 2 }),
  specialty: text("specialty"), // Communications, Policy, Legal, Operations, etc.
  pathwayType: text("pathway_type"), // Career pathway classification
  yearsInCurrentRole: integer("years_in_current_role"),
  education: jsonb("education").$type<string[]>(), // Array of education entries
  contactEmail: text("contact_email"),
  linkedinUrl: text("linkedin_url"),
  photoUrl: text("photo_url"),
  bio: text("bio"),
  trackUpdates: boolean("track_updates").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStafferSchema = createInsertSchema(staffers).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export type InsertStaffer = z.infer<typeof insertStafferSchema>;
export type Staffer = typeof staffers.$inferSelect;

// Career positions for staffers
export const stafferCareerPositions = pgTable("staffer_career_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stafferId: varchar("staffer_id").notNull(),
  position: text("position").notNull(),
  organization: text("organization").notNull(),
  bossName: text("boss_name"),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"), // null if current
  isCurrent: boolean("is_current").default(false),
  orgType: text("org_type"), // Congressional Office, Campaign, Think Tank, etc.
  chamber: text("chamber"), // House, Senate
  state: varchar("state", { length: 2 }),
  concurrent: boolean("concurrent").default(false), // If held simultaneously with another position
  description: text("description"),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStafferCareerPositionSchema = createInsertSchema(stafferCareerPositions).omit({
  id: true,
  createdAt: true,
});

export type InsertStafferCareerPosition = z.infer<typeof insertStafferCareerPositionSchema>;
export type StafferCareerPosition = typeof stafferCareerPositions.$inferSelect;

// Connections between staffers
export const stafferConnections = pgTable("staffer_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stafferId: varchar("staffer_id").notNull(),
  connectedToName: text("connected_to_name").notNull(),
  connectedToId: varchar("connected_to_id"), // References another staffer if in system
  connectionType: text("connection_type"), // worked_with, reported_to, managed, etc.
  organization: text("organization"), // Where they connected
  yearsTogether: integer("years_together"),
  strength: text("strength").default("Medium"), // Strong, Medium, Weak
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStafferConnectionSchema = createInsertSchema(stafferConnections).omit({
  id: true,
  createdAt: true,
});

export type InsertStafferConnection = z.infer<typeof insertStafferConnectionSchema>;
export type StafferConnection = typeof stafferConnections.$inferSelect;

// Political organizations reference table
export const politicalOrganizations = pgTable("political_organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  name: text("name").notNull(),
  orgType: text("org_type"),
  chamber: text("chamber"),
  party: text("party"),
  state: varchar("state", { length: 2 }),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  industry: text("industry"),
  description: text("description"),
  employeeCount: integer("employee_count"),
  employeeCountRange: text("employee_count_range"),
  founded: integer("founded"),
  headquartersCity: text("headquarters_city"),
  headquartersState: text("headquarters_state"),
  headquartersCountry: text("headquarters_country"),
  tags: text("tags").array(),
  naicsCode: text("naics_code"),
  sicCode: text("sic_code"),
  isLobbyingFirm: boolean("is_lobbying_firm").default(false),
  isPAC: boolean("is_pac").default(false),
  isThinkTank: boolean("is_think_tank").default(false),
  isGovernmentAgency: boolean("is_government_agency").default(false),
  isPoliticalOrg: boolean("is_political_org").default(false),
  isCampaign: boolean("is_campaign").default(false),
  aiSummary: text("ai_summary"),
  aiSources: text("ai_sources").array(),
  pdlEnriched: boolean("pdl_enriched").default(false),
  isActive: boolean("is_active").default(true),
  isTracked: boolean("is_tracked").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPoliticalOrganizationSchema = createInsertSchema(politicalOrganizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPoliticalOrganization = z.infer<typeof insertPoliticalOrganizationSchema>;
export type PoliticalOrganization = typeof politicalOrganizations.$inferSelect;

// Congressional Staff Directory (cached from House directory)
export const congressionalStaffDirectory = pgTable("congressional_staff_directory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id"),
  name: text("name").notNull(),
  jobTitle: text("job_title").notNull(),
  officeCode: text("office_code"),
  officeName: text("office_name"),
  officeType: text("office_type"),
  telephone: text("telephone"),
  address: text("address"),
  parentOfficeCode: text("parent_office_code"),
  parentOfficeName: text("parent_office_name"),
  memberBioguideId: text("member_bioguide_id"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
});

export const insertCongressionalStaffDirectorySchema = createInsertSchema(congressionalStaffDirectory).omit({
  id: true,
  lastSyncedAt: true,
});

export type InsertCongressionalStaffDirectory = z.infer<typeof insertCongressionalStaffDirectorySchema>;
export type CongressionalStaffDirectory = typeof congressionalStaffDirectory.$inferSelect;

// Google Rank Tracking - queries to track in Google search rankings
export const rankTrackedQueries = pgTable("rank_tracked_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  query: text("query").notNull(),
  targetDomain: text("target_domain"),
  device: text("device").default("desktop"),
  location: text("location"),
  isActive: boolean("is_active").default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRankTrackedQuerySchema = createInsertSchema(rankTrackedQueries).omit({
  id: true,
  lastCheckedAt: true,
  createdAt: true,
});

export type InsertRankTrackedQuery = z.infer<typeof insertRankTrackedQuerySchema>;
export type RankTrackedQuery = typeof rankTrackedQueries.$inferSelect;

// Google Rank Tracking Results - stores the rank check results
export const rankTrackingResults = pgTable("rank_tracking_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryId: varchar("query_id").notNull(),
  clientId: varchar("client_id").notNull(),
  position: integer("position"),
  title: text("title"),
  link: text("link"),
  domain: text("domain"),
  snippet: text("snippet"),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export const insertRankTrackingResultSchema = createInsertSchema(rankTrackingResults).omit({
  id: true,
  checkedAt: true,
});

export type InsertRankTrackingResult = z.infer<typeof insertRankTrackingResultSchema>;
export type RankTrackingResult = typeof rankTrackingResults.$inferSelect;

// LegiStorm Congressional Staff Directory - cached from LegiStorm API
export const legistormStaffers = pgTable("legistorm_staffers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legistormId: integer("legistorm_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredFirstName: text("preferred_first_name"),
  preferredLastName: text("preferred_last_name"),
  fullName: text("full_name").notNull(),
  gender: text("gender"),
  party: text("party"),
  race: text("race"),
  email: text("email"),
  phone: text("phone"),
  officeAddress: text("office_address"),
  currentTitle: text("current_title"),
  currentOffice: text("current_office"),
  currentMemberName: text("current_member_name"),
  currentMemberId: integer("current_member_id"),
  chamber: text("chamber"),
  state: varchar("state", { length: 2 }),
  district: integer("district"),
  isCurrentStaff: boolean("is_current_staff").default(true),
  positions: jsonb("positions").$type<Array<{
    id: number;
    title: string;
    isCurrent: boolean;
    startDate: string | null;
    endDate: string | null;
    memberName: string | null;
    memberId: number | null;
    officeName: string | null;
    officeId: number | null;
    chamber: string | null;
    state: string | null;
    district: number | null;
  }>>(),
  linkedinUrl: text("linkedin_url"),
  careerResearch: text("career_research"),
  careerResearchedAt: timestamp("career_researched_at"),
  lastUpdatedFromApi: timestamp("last_updated_from_api"),
  syncedAt: timestamp("synced_at").defaultNow(),
});

export const insertLegistormStafferSchema = createInsertSchema(legistormStaffers).omit({
  id: true,
  syncedAt: true,
});

export type InsertLegistormStaffer = z.infer<typeof insertLegistormStafferSchema>;
export type LegistormStaffer = typeof legistormStaffers.$inferSelect;

// LegiStorm sync tracking
export const legistormSyncLog = pgTable("legistorm_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull(),
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  lastPage: integer("last_page").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type LegistormSyncLog = typeof legistormSyncLog.$inferSelect;

// Staffer-Bill Associations (maps staffers to bills they worked on across their career)
export const stafferBillAssociations = pgTable("staffer_bill_associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  stafferType: text("staffer_type").notNull(), // "contact" or "legistorm"
  stafferId: varchar("staffer_id").notNull(), // contacts.id or legistormStaffers.id
  stafferName: text("staffer_name").notNull(),
  trackedBillId: varchar("tracked_bill_id"), // link to tracked_bills.id (optional for untracked bills)
  billTitle: text("bill_title"),
  billType: text("bill_type"), // hr, s, hjres, etc.
  billNumber: integer("bill_number"),
  congress: integer("congress"),
  role: text("role"), // authored, co-sponsored, negotiated, staffed_committee, floor_managed, drafted, etc.
  positionTitle: text("position_title"), // what title they held when working on this bill
  positionOrganization: text("position_organization"), // which office/org they were at
  positionMemberName: text("position_member_name"), // which member they worked for
  yearStart: integer("year_start"), // when they worked on the bill
  yearEnd: integer("year_end"),
  confidence: text("confidence").default("confirmed"), // confirmed, high, medium, low
  source: text("source").default("manual"), // manual, ai_discovered, imported
  sourceDetails: text("source_details"), // AI research citation or import source
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStafferBillAssociationSchema = createInsertSchema(stafferBillAssociations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStafferBillAssociation = z.infer<typeof insertStafferBillAssociationSchema>;
export type StafferBillAssociation = typeof stafferBillAssociations.$inferSelect;

// Strategy Boards (Kanban boards for engagement pipeline)
export const strategyBoards = pgTable("strategy_boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  targetType: text("target_type"), // "member", "bill", "general"
  targetId: text("target_id"), // member bioguideId or bill ID
  targetName: text("target_name"),
  columns: jsonb("columns").default(sql`'["Identify","Research","Outreach","In Progress","Connected"]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStrategyBoardSchema = createInsertSchema(strategyBoards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStrategyBoard = z.infer<typeof insertStrategyBoardSchema>;
export type StrategyBoard = typeof strategyBoards.$inferSelect;

// Strategy Cards (items on the Kanban board)
export const strategyCards = pgTable("strategy_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull(),
  clientId: varchar("client_id").notNull(),
  entityType: text("entity_type").notNull(), // "staffer", "bill", "contact", "member"
  entityId: text("entity_id").notNull(),
  entityName: text("entity_name").notNull(),
  entityMeta: jsonb("entity_meta"), // title, office, party, etc.
  stage: text("stage").notNull().default("Identify"),
  position: integer("position").default(0),
  notes: text("notes"),
  priority: text("priority").default("medium"), // low, medium, high, critical
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStrategyCardSchema = createInsertSchema(strategyCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStrategyCard = z.infer<typeof insertStrategyCardSchema>;
export type StrategyCard = typeof strategyCards.$inferSelect;

export const veteranCongressMembers = pgTable("veteran_congress_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  bioguideId: text("bioguide_id").notNull(),
  memberName: text("member_name").notNull(),
  chamber: text("chamber"),
  state: text("state"),
  party: text("party"),
  isVeteran: boolean("is_veteran").default(false),
  serviceBranch: text("service_branch"),
  serviceDetails: text("service_details"),
  yearsOfService: text("years_of_service"),
  rank: text("rank"),
  source: text("source").default("ai_research"),
  confidence: text("confidence").default("medium"),
  researchedAt: timestamp("researched_at").defaultNow(),
});

export const insertVeteranCongressMemberSchema = createInsertSchema(veteranCongressMembers).omit({
  id: true,
  researchedAt: true,
});

export type InsertVeteranCongressMember = z.infer<typeof insertVeteranCongressMemberSchema>;
export type VeteranCongressMember = typeof veteranCongressMembers.$inferSelect;

// Platform Modules (add-on features firms can enable)
export const platformModules = pgTable("platform_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlatformModuleSchema = createInsertSchema(platformModules).omit({
  id: true,
  createdAt: true,
});

export type InsertPlatformModule = z.infer<typeof insertPlatformModuleSchema>;
export type PlatformModule = typeof platformModules.$inferSelect;

// Client Module Assignments (which firms have which modules enabled)
export const clientModules = pgTable("client_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  moduleId: varchar("module_id").notNull().references(() => platformModules.id),
  enabled: boolean("enabled").default(true),
  enabledAt: timestamp("enabled_at").defaultNow(),
});

export const insertClientModuleSchema = createInsertSchema(clientModules).omit({
  id: true,
  enabledAt: true,
});

export type InsertClientModule = z.infer<typeof insertClientModuleSchema>;
export type ClientModule = typeof clientModules.$inferSelect;

// Sports Teams / Franchises
export const sportsTeams = pgTable("sports_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  name: text("name").notNull(),
  league: text("league"),
  conference: text("conference"),
  division: text("division"),
  level: text("level").default("professional"),
  sport: text("sport"),
  city: text("city"),
  state: text("state"),
  venue: text("venue"),
  website: text("website"),
  logoUrl: text("logo_url"),
  socialTwitter: text("social_twitter"),
  socialInstagram: text("social_instagram"),
  socialFacebook: text("social_facebook"),
  communityUrl: text("community_url"),
  ticketPartnerUrl: text("ticket_partner_url"),
  estimatedAttendance: integer("estimated_attendance"),
  notes: text("notes"),
  aiResearch: text("ai_research"),
  aiResearchedAt: timestamp("ai_researched_at"),
  pdlEnriched: boolean("pdl_enriched").default(false),
  scrapedData: jsonb("scraped_data"),
  scrapedAt: timestamp("scraped_at"),
  outreachStatus: text("outreach_status").default("not_started"),
  outreachNotes: text("outreach_notes"),
  lastContactedAt: timestamp("last_contacted_at"),
  isTracked: boolean("is_tracked").default(true),
  isFavorite: boolean("is_favorite").default(false),
  abbreviation: text("abbreviation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSportsTeamSchema = createInsertSchema(sportsTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  aiResearchedAt: true,
  scrapedAt: true,
});

export type InsertSportsTeam = z.infer<typeof insertSportsTeamSchema>;
export type SportsTeam = typeof sportsTeams.$inferSelect;

// Sports Contacts (key people at teams/franchises)
export const sportsContacts = pgTable("sports_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  teamId: varchar("team_id").references(() => sportsTeams.id),
  name: text("name").notNull(),
  title: text("title"),
  department: text("department"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  imageUrl: text("image_url"),
  roleType: text("role_type"),
  source: text("source").default("manual"),
  notes: text("notes"),
  aiResearch: text("ai_research"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSportsContactSchema = createInsertSchema(sportsContacts).omit({
  id: true,
  createdAt: true,
});

export type InsertSportsContact = z.infer<typeof insertSportsContactSchema>;
export type SportsContact = typeof sportsContacts.$inferSelect;

export const marketingIntelligenceData = pgTable("marketing_intelligence_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  category: text("category").notNull(),
  label: text("label").notNull(),
  data: jsonb("data").notNull(),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMarketingIntelligenceDataSchema = createInsertSchema(marketingIntelligenceData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMarketingIntelligenceData = z.infer<typeof insertMarketingIntelligenceDataSchema>;
export type MarketingIntelligenceData = typeof marketingIntelligenceData.$inferSelect;

export const marketingAiRecommendations = pgTable("marketing_ai_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  priority: text("priority").default("medium"),
  status: text("status").default("new"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingAiRecommendationSchema = createInsertSchema(marketingAiRecommendations).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketingAiRecommendation = z.infer<typeof insertMarketingAiRecommendationSchema>;
export type MarketingAiRecommendation = typeof marketingAiRecommendations.$inferSelect;

export const demoVideos = pgTable("demo_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  sortOrder: integer("sort_order").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDemoVideoSchema = createInsertSchema(demoVideos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDemoVideo = z.infer<typeof insertDemoVideoSchema>;
export type DemoVideo = typeof demoVideos.$inferSelect;

export const demoAccessLogs = pgTable("demo_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  sessionStart: timestamp("session_start").defaultNow(),
  timeSpentSeconds: integer("time_spent_seconds").default(0),
  videosViewed: integer("videos_viewed").default(0),
  videosCompleted: integer("videos_completed").default(0),
  lastActivity: timestamp("last_activity").defaultNow(),
});

export const insertDemoAccessLogSchema = createInsertSchema(demoAccessLogs).omit({
  id: true,
  sessionStart: true,
  lastActivity: true,
});

export type InsertDemoAccessLog = z.infer<typeof insertDemoAccessLogSchema>;
export type DemoAccessLog = typeof demoAccessLogs.$inferSelect;

// ─── Decision Briefs ──────────────────────────────────────────────────────────

// BriefContent: the 5 enforced sections stored as JSONB on the brief row.
// [n] citation markers live inline in the strings; they map to brief_sources.citationNumber.
export interface BriefContent {
  situation: string;                                          // 2-3 sentences
  whyItMatters: string;                                      // 3-4 sentences
  stakes: { business: string; reputational: string; values: string };
  questions: string[];                                        // 3-5 items
  responses: { cautious: string; moderate: string; aggressive: string };
}

export const briefs = pgTable("briefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull(),
  // publicUuid is the magic-link token — separate from id so the internal PK is never exposed
  publicUuid: varchar("public_uuid").notNull().unique(),
  title: text("title").notNull(),
  clientContext: text("client_context"),
  sensitivity: text("sensitivity").notNull().default("internal"), // 'internal' | 'shareable'
  status: text("status").notNull().default("draft"),              // draft | generating | ready | failed
  content: jsonb("content").$type<BriefContent>(),
  modelUsed: text("model_used"),
  generationError: text("generation_error"),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBriefSchema = createInsertSchema(briefs).omit({
  id: true,
  publicUuid: true,
  status: true,
  content: true,
  modelUsed: true,
  generationError: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrief = z.infer<typeof insertBriefSchema>;
export type Brief = typeof briefs.$inferSelect;

// One row per source URL the lobbyist provided.
// citationNumber is the [n] index referenced inline in BriefContent strings.
export const briefSources = pgTable("brief_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  briefId: varchar("brief_id").notNull(),
  citationNumber: integer("citation_number").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  publication: text("publication"),       // human-readable outlet name (derived from domain)
  publishDate: text("publish_date"),      // YYYY-MM-DD from Extract/Search response
  tier: integer("tier").notNull(),        // 1 | 2 | 3 — hardcoded domain map
  excerpts: jsonb("excerpts").$type<string[]>(),          // Search API excerpts
  extractedContent: text("extracted_content"),            // Extract API full markdown (cached)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBriefSourceSchema = createInsertSchema(briefSources).omit({
  id: true,
  createdAt: true,
});

export type InsertBriefSource = z.infer<typeof insertBriefSourceSchema>;
export type BriefSource = typeof briefSources.$inferSelect;

// Express session store — managed by connect-pg-simple, not Drizzle mutations.
// Defined here so Drizzle sees it and does not attempt to drop it during db:push.
export const appSessions = pgTable("app_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
});

// One row per public-view visit. email is self-asserted (soft-capture gate).
export const briefViews = pgTable("brief_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  briefId: varchar("brief_id").notNull(),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const insertBriefViewSchema = createInsertSchema(briefViews).omit({
  id: true,
  viewedAt: true,
});

export type InsertBriefView = z.infer<typeof insertBriefViewSchema>;
export type BriefView = typeof briefViews.$inferSelect;

// ─── Government Press Release Ingestion ──────────────────────────────────────

// One row per agency source. fetch_type drives which parser is used.
export const governmentPressSources = pgTable("government_press_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  departmentSlug: text("department_slug").notNull().unique(), // 'dol', 'epa', etc.
  departmentName: text("department_name").notNull(),
  feedUrl: text("feed_url").notNull(),
  fetchType: text("fetch_type").notNull().default("rss"), // 'rss' | 'html'
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncStatus: text("last_sync_status"), // 'success' | 'error' | 'partial'
  lastSyncError: text("last_sync_error"),
  blockReason: text("block_reason"), // set when source is permanently unscrapable; distinct from transient lastSyncError
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGovernmentPressSourceSchema = createInsertSchema(governmentPressSources).omit({
  id: true,
  lastSyncedAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGovernmentPressSource = z.infer<typeof insertGovernmentPressSourceSchema>;
export type GovernmentPressSource = typeof governmentPressSources.$inferSelect;

// One row per press release. content_hash deduplicates on re-sync.
export const governmentPressReleases = pgTable("government_press_releases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull(),
  departmentSlug: text("department_slug").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  contentHash: text("content_hash").notNull(), // sha256(title + url + publishedAt)
  publishedAt: timestamp("published_at"),
  summary: text("summary"),
  fullText: text("full_text"),
  rawMetadata: jsonb("raw_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGovernmentPressReleaseSchema = createInsertSchema(governmentPressReleases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGovernmentPressRelease = z.infer<typeof insertGovernmentPressReleaseSchema>;
export type GovernmentPressRelease = typeof governmentPressReleases.$inferSelect;

// One row per sync run — tracks what happened when we polled a source.
export const governmentPressSyncRuns = pgTable("government_press_sync_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull(),
  departmentSlug: text("department_slug").notNull(),
  status: text("status").notNull().default("running"), // 'running' | 'success' | 'error' | 'partial'
  releasesFound: integer("releases_found").default(0),
  releasesInserted: integer("releases_inserted").default(0),
  releasesUpdated: integer("releases_updated").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type GovernmentPressSyncRun = typeof governmentPressSyncRuns.$inferSelect;

// ─── Client Context Profiles ──────────────────────────────────────────────────

export const clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().unique().references(() => clients.id),
  industries: text("industries").array().notNull().default(sql`'{}'::text[]`),
  watchlistTopics: text("watchlist_topics").array().notNull().default(sql`'{}'::text[]`),
  relevantAgencies: text("relevant_agencies").array().notNull().default(sql`'{}'::text[]`),
  relevantCommittees: text("relevant_committees").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfiles.$inferSelect;
