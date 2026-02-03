import { db } from "./db";
import { eq, desc, and, gte, or, ilike } from "drizzle-orm";
import {
  clients,
  clientUsers,
  superAdmins,
  contacts,
  careerHistory,
  contactConnections,
  newsArticles,
  matters,
  researchDocuments,
  researchConversations,
  researchMessages,
  kbCategories,
  kbArticles,
  kbTooltips,
  securityStatus,
  securityControls,
  clientPortals,
  portalMatterAccess,
  youtubeWatchList,
  trackedBills,
  billChangeHistory,
  billTrackingAlerts,
  clientApplications,
  trackedSocialAccounts,
  socialTrackingKeywords,
  trackedSocialPosts,
  type Client,
  type InsertClient,
  type ClientUser,
  type InsertClientUser,
  type SuperAdmin,
  type InsertSuperAdmin,
  type Contact,
  type InsertContact,
  type CareerHistory,
  type InsertCareerHistory,
  type ContactConnection,
  type InsertContactConnection,
  type NewsArticle,
  type InsertNewsArticle,
  type Matter,
  type InsertMatter,
  type ResearchDocument,
  type InsertResearchDocument,
  type ResearchConversation,
  type InsertResearchConversation,
  type ResearchMessage,
  type InsertResearchMessage,
  type KbCategory,
  type InsertKbCategory,
  type KbArticle,
  type InsertKbArticle,
  type KbTooltip,
  type InsertKbTooltip,
  type SecurityStatus,
  type InsertSecurityStatus,
  type SecurityControl,
  type InsertSecurityControl,
  type ClientPortal,
  type InsertClientPortal,
  type PortalMatterAccess,
  type InsertPortalMatterAccess,
  type YoutubeWatchList,
  type InsertYoutubeWatchList,
  type TrackedBill,
  type InsertTrackedBill,
  type BillChangeHistory,
  type InsertBillChangeHistory,
  type BillTrackingAlert,
  type InsertBillTrackingAlert,
  type ClientApplication,
  type InsertClientApplication,
  type TrackedSocialAccount,
  type InsertTrackedSocialAccount,
  type SocialTrackingKeyword,
  type InsertSocialTrackingKeyword,
  type TrackedSocialPost,
  type InsertTrackedSocialPost,
} from "@shared/schema";

export interface IStorage {
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientBySlug(slug: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  getRecentClients(limit?: number): Promise<Client[]>;

  // Client Users
  getClientUsers(clientId: string): Promise<ClientUser[]>;
  getClientUserByUserId(userId: string): Promise<ClientUser | undefined>;
  createClientUser(clientUser: InsertClientUser): Promise<ClientUser>;
  deleteClientUser(id: string): Promise<void>;

  // Super Admins
  getSuperAdmins(): Promise<SuperAdmin[]>;
  getSuperAdminByUserId(userId: string): Promise<SuperAdmin | undefined>;
  createSuperAdmin(superAdmin: InsertSuperAdmin): Promise<SuperAdmin>;
  deleteSuperAdmin(id: string): Promise<void>;

  // Contacts
  getContacts(clientId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<void>;
  getRecentContacts(clientId: string, limit?: number): Promise<Contact[]>;
  getContactsWithHistory(clientId: string): Promise<(Contact & { careerHistory: CareerHistory[] })[]>;

  // Career History
  getCareerHistory(contactId: string): Promise<CareerHistory[]>;
  createCareerHistory(history: InsertCareerHistory): Promise<CareerHistory>;
  deleteCareerHistory(id: string): Promise<void>;

  // Contact Connections
  getContactConnections(contactId: string): Promise<ContactConnection[]>;
  createContactConnection(connection: InsertContactConnection): Promise<ContactConnection>;
  deleteContactConnection(id: string): Promise<void>;

  // News Articles
  getNewsArticles(clientId: string): Promise<NewsArticle[]>;
  getNewsArticle(id: string): Promise<NewsArticle | undefined>;
  createNewsArticle(article: InsertNewsArticle): Promise<NewsArticle>;
  updateNewsArticle(id: string, article: Partial<InsertNewsArticle>): Promise<NewsArticle | undefined>;
  deleteNewsArticle(id: string): Promise<void>;
  getRecentNews(clientId: string, limit?: number): Promise<NewsArticle[]>;

  // Matters (sub-clients)
  getMatters(clientId: string): Promise<Matter[]>;
  getMatter(id: string): Promise<Matter | undefined>;
  createMatter(matter: InsertMatter): Promise<Matter>;
  updateMatter(id: string, matter: Partial<InsertMatter>): Promise<Matter | undefined>;
  deleteMatter(id: string): Promise<void>;

  // Research Documents
  getResearchDocuments(matterId: string): Promise<ResearchDocument[]>;
  getResearchDocument(id: string): Promise<ResearchDocument | undefined>;
  createResearchDocument(doc: InsertResearchDocument): Promise<ResearchDocument>;
  deleteResearchDocument(id: string): Promise<void>;
  getAllResearchDocumentsForMatter(matterId: string): Promise<ResearchDocument[]>;

  // Research Conversations
  getResearchConversations(matterId: string): Promise<ResearchConversation[]>;
  getResearchConversation(id: string): Promise<ResearchConversation | undefined>;
  createResearchConversation(conv: InsertResearchConversation): Promise<ResearchConversation>;
  deleteResearchConversation(id: string): Promise<void>;

  // Research Messages
  getResearchMessages(conversationId: string): Promise<ResearchMessage[]>;
  createResearchMessage(msg: InsertResearchMessage): Promise<ResearchMessage>;

  // Knowledge Base Categories
  getKbCategories(scope: string): Promise<KbCategory[]>;
  getKbCategory(id: string): Promise<KbCategory | undefined>;
  createKbCategory(category: InsertKbCategory): Promise<KbCategory>;
  updateKbCategory(id: string, category: Partial<InsertKbCategory>): Promise<KbCategory | undefined>;
  deleteKbCategory(id: string): Promise<void>;

  // Knowledge Base Articles
  getKbArticles(scope: string): Promise<KbArticle[]>;
  getKbArticle(id: string): Promise<KbArticle | undefined>;
  getKbArticleBySlug(slug: string, scope: string): Promise<KbArticle | undefined>;
  createKbArticle(article: InsertKbArticle): Promise<KbArticle>;
  updateKbArticle(id: string, article: Partial<InsertKbArticle>): Promise<KbArticle | undefined>;
  deleteKbArticle(id: string): Promise<void>;
  searchKbArticles(scope: string, query: string): Promise<KbArticle[]>;

  // KB Tooltips
  getKbTooltips(scope: string): Promise<KbTooltip[]>;
  getKbTooltipByKey(key: string): Promise<KbTooltip | undefined>;
  createKbTooltip(tooltip: InsertKbTooltip): Promise<KbTooltip>;
  updateKbTooltip(id: string, tooltip: Partial<InsertKbTooltip>): Promise<KbTooltip | undefined>;
  deleteKbTooltip(id: string): Promise<void>;

  // Security Status
  getSecurityStatus(scope: string, clientId?: string): Promise<SecurityStatus | undefined>;
  createSecurityStatus(status: InsertSecurityStatus): Promise<SecurityStatus>;
  updateSecurityStatus(id: string, status: Partial<InsertSecurityStatus>): Promise<SecurityStatus | undefined>;

  // Security Controls
  getSecurityControls(scope: string, clientId?: string): Promise<SecurityControl[]>;
  createSecurityControl(control: InsertSecurityControl): Promise<SecurityControl>;
  updateSecurityControl(id: string, control: Partial<InsertSecurityControl>): Promise<SecurityControl | undefined>;
  deleteSecurityControl(id: string): Promise<void>;

  // Client Portals
  getClientPortals(clientId: string): Promise<ClientPortal[]>;
  getClientPortal(id: string): Promise<ClientPortal | undefined>;
  getClientPortalBySlug(clientId: string, slug: string): Promise<ClientPortal | undefined>;
  createClientPortal(portal: InsertClientPortal): Promise<ClientPortal>;
  updateClientPortal(id: string, portal: Partial<InsertClientPortal>): Promise<ClientPortal | undefined>;
  deleteClientPortal(id: string): Promise<void>;

  // Portal Matter Access
  getPortalMatterAccess(portalId: string): Promise<PortalMatterAccess[]>;
  createPortalMatterAccess(access: InsertPortalMatterAccess): Promise<PortalMatterAccess>;
  deletePortalMatterAccess(id: string): Promise<void>;
  deletePortalMatterAccessByPortal(portalId: string): Promise<void>;

  // YouTube Watch List
  getYoutubeWatchList(clientId: string): Promise<YoutubeWatchList[]>;
  getYoutubeWatchListItem(id: string): Promise<YoutubeWatchList | undefined>;
  getYoutubeWatchListByStatus(clientId: string, status: string): Promise<YoutubeWatchList[]>;
  createYoutubeWatchListItem(item: InsertYoutubeWatchList): Promise<YoutubeWatchList>;
  updateYoutubeWatchListItem(id: string, item: Partial<InsertYoutubeWatchList & { lastCheckedAt: Date }>): Promise<YoutubeWatchList | undefined>;
  deleteYoutubeWatchListItem(id: string): Promise<void>;

  // Tracked Bills
  getTrackedBills(clientId: string): Promise<TrackedBill[]>;
  getTrackedBill(id: string): Promise<TrackedBill | undefined>;
  getTrackedBillByNumber(clientId: string, congress: number, billType: string, billNumber: number): Promise<TrackedBill | undefined>;
  createTrackedBill(bill: InsertTrackedBill): Promise<TrackedBill>;
  updateTrackedBill(id: string, bill: Partial<InsertTrackedBill & { lastSyncedAt: Date }>): Promise<TrackedBill | undefined>;
  deleteTrackedBill(id: string): Promise<void>;

  // Bill Change History
  getBillChangeHistory(trackedBillId: string): Promise<BillChangeHistory[]>;
  getUnreadBillChanges(clientId: string): Promise<(BillChangeHistory & { bill: TrackedBill })[]>;
  createBillChange(change: InsertBillChangeHistory): Promise<BillChangeHistory>;
  markBillChangeAsRead(id: string): Promise<void>;
  markAllBillChangesAsRead(trackedBillId: string): Promise<void>;

  // Bill Tracking Alerts
  getBillTrackingAlert(trackedBillId: string): Promise<BillTrackingAlert | undefined>;
  createBillTrackingAlert(alert: InsertBillTrackingAlert): Promise<BillTrackingAlert>;
  updateBillTrackingAlert(id: string, alert: Partial<InsertBillTrackingAlert>): Promise<BillTrackingAlert | undefined>;
  deleteBillTrackingAlert(trackedBillId: string): Promise<void>;

  // Client Applications
  getClientApplications(): Promise<ClientApplication[]>;
  getClientApplication(id: string): Promise<ClientApplication | undefined>;
  getClientApplicationByEmail(email: string): Promise<ClientApplication | undefined>;
  getClientApplicationByToken(token: string): Promise<ClientApplication | undefined>;
  createClientApplication(app: InsertClientApplication & { emailVerificationToken: string; emailVerificationExpires: Date }): Promise<ClientApplication>;
  updateClientApplication(id: string, app: Partial<ClientApplication>): Promise<ClientApplication | undefined>;
  deleteClientApplication(id: string): Promise<void>;

  // Stats
  getAdminStats(): Promise<{
    totalClients: number;
    activeClients: number;
    totalUsers: number;
    totalContacts: number;
    totalNews: number;
  }>;
  getClientStats(clientId: string): Promise<{
    totalContacts: number;
    highPriorityContacts: number;
    totalNews: number;
    unreadNews: number;
    totalMatters: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Clients
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientBySlug(slug: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.slug, slug));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getRecentClients(limit = 5): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt)).limit(limit);
  }

  // Client Users
  async getClientUsers(clientId: string): Promise<ClientUser[]> {
    return db.select().from(clientUsers).where(eq(clientUsers.clientId, clientId));
  }

  async getClientUserByUserId(userId: string): Promise<ClientUser | undefined> {
    const [clientUser] = await db.select().from(clientUsers).where(eq(clientUsers.userId, userId));
    return clientUser;
  }

  async createClientUser(clientUser: InsertClientUser): Promise<ClientUser> {
    const [newClientUser] = await db.insert(clientUsers).values(clientUser).returning();
    return newClientUser;
  }

  async deleteClientUser(id: string): Promise<void> {
    await db.delete(clientUsers).where(eq(clientUsers.id, id));
  }

  // Super Admins
  async getSuperAdmins(): Promise<SuperAdmin[]> {
    return db.select().from(superAdmins);
  }

  async getSuperAdminByUserId(userId: string): Promise<SuperAdmin | undefined> {
    const [superAdmin] = await db.select().from(superAdmins).where(eq(superAdmins.userId, userId));
    return superAdmin;
  }

  async createSuperAdmin(superAdmin: InsertSuperAdmin): Promise<SuperAdmin> {
    const [newSuperAdmin] = await db.insert(superAdmins).values(superAdmin).returning();
    return newSuperAdmin;
  }

  async deleteSuperAdmin(id: string): Promise<void> {
    await db.delete(superAdmins).where(eq(superAdmins.id, id));
  }

  // Contacts
  async getContacts(clientId: string): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.clientId, clientId)).orderBy(desc(contacts.updatedAt));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  async updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined> {
    const [updated] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getRecentContacts(clientId: string, limit = 5): Promise<Contact[]> {
    return db
      .select()
      .from(contacts)
      .where(eq(contacts.clientId, clientId))
      .orderBy(desc(contacts.updatedAt))
      .limit(limit);
  }

  async getContactsWithHistory(clientId: string): Promise<(Contact & { careerHistory: CareerHistory[] })[]> {
    const allContacts = await this.getContacts(clientId);
    const result = await Promise.all(
      allContacts.map(async (contact) => {
        const history = await this.getCareerHistory(contact.id);
        return { ...contact, careerHistory: history };
      })
    );
    return result;
  }

  // Career History
  async getCareerHistory(contactId: string): Promise<CareerHistory[]> {
    return db
      .select()
      .from(careerHistory)
      .where(eq(careerHistory.contactId, contactId))
      .orderBy(desc(careerHistory.startYear));
  }

  async createCareerHistory(history: InsertCareerHistory): Promise<CareerHistory> {
    const [newHistory] = await db.insert(careerHistory).values(history).returning();
    return newHistory;
  }

  async deleteCareerHistory(id: string): Promise<void> {
    await db.delete(careerHistory).where(eq(careerHistory.id, id));
  }

  // Contact Connections
  async getContactConnections(contactId: string): Promise<ContactConnection[]> {
    return db.select().from(contactConnections).where(eq(contactConnections.contactId, contactId));
  }

  async createContactConnection(connection: InsertContactConnection): Promise<ContactConnection> {
    const [newConnection] = await db.insert(contactConnections).values(connection).returning();
    return newConnection;
  }

  async deleteContactConnection(id: string): Promise<void> {
    await db.delete(contactConnections).where(eq(contactConnections.id, id));
  }

  // News Articles
  async getNewsArticles(clientId: string): Promise<NewsArticle[]> {
    return db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.clientId, clientId))
      .orderBy(desc(newsArticles.createdAt));
  }

  async getNewsArticle(id: string): Promise<NewsArticle | undefined> {
    const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, id));
    return article;
  }

  async createNewsArticle(article: InsertNewsArticle): Promise<NewsArticle> {
    const [newArticle] = await db.insert(newsArticles).values(article).returning();
    return newArticle;
  }

  async updateNewsArticle(id: string, article: Partial<InsertNewsArticle>): Promise<NewsArticle | undefined> {
    const [updated] = await db.update(newsArticles).set(article).where(eq(newsArticles.id, id)).returning();
    return updated;
  }

  async deleteNewsArticle(id: string): Promise<void> {
    await db.delete(newsArticles).where(eq(newsArticles.id, id));
  }

  async getRecentNews(clientId: string, limit = 5): Promise<NewsArticle[]> {
    return db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.clientId, clientId))
      .orderBy(desc(newsArticles.createdAt))
      .limit(limit);
  }

  // Stats
  async getAdminStats() {
    const allClients = await db.select().from(clients);
    const activeClients = allClients.filter((c) => c.isActive);
    const allClientUsers = await db.select().from(clientUsers);
    const allContacts = await db.select().from(contacts);
    const allNews = await db.select().from(newsArticles);

    return {
      totalClients: allClients.length,
      activeClients: activeClients.length,
      totalUsers: allClientUsers.length,
      totalContacts: allContacts.length,
      totalNews: allNews.length,
    };
  }

  async getClientStats(clientId: string) {
    const clientContacts = await db.select().from(contacts).where(eq(contacts.clientId, clientId));
    const highPriority = clientContacts.filter((c) => c.priority && c.priority >= 4);
    const clientNews = await db.select().from(newsArticles).where(eq(newsArticles.clientId, clientId));
    const unread = clientNews.filter((n) => !n.isRead);
    const clientMatters = await db.select().from(matters).where(eq(matters.clientId, clientId));

    return {
      totalContacts: clientContacts.length,
      highPriorityContacts: highPriority.length,
      totalNews: clientNews.length,
      unreadNews: unread.length,
      totalMatters: clientMatters.length,
    };
  }

  // Matters (sub-clients)
  async getMatters(clientId: string): Promise<Matter[]> {
    return db.select().from(matters).where(eq(matters.clientId, clientId)).orderBy(desc(matters.updatedAt));
  }

  async getMatter(id: string): Promise<Matter | undefined> {
    const [matter] = await db.select().from(matters).where(eq(matters.id, id));
    return matter;
  }

  async createMatter(matter: InsertMatter): Promise<Matter> {
    const [newMatter] = await db.insert(matters).values(matter).returning();
    return newMatter;
  }

  async updateMatter(id: string, matter: Partial<InsertMatter>): Promise<Matter | undefined> {
    const [updated] = await db
      .update(matters)
      .set({ ...matter, updatedAt: new Date() })
      .where(eq(matters.id, id))
      .returning();
    return updated;
  }

  async deleteMatter(id: string): Promise<void> {
    await db.delete(researchDocuments).where(eq(researchDocuments.matterId, id));
    await db.delete(researchConversations).where(eq(researchConversations.matterId, id));
    await db.delete(matters).where(eq(matters.id, id));
  }

  // Research Documents
  async getResearchDocuments(matterId: string): Promise<ResearchDocument[]> {
    return db.select().from(researchDocuments).where(eq(researchDocuments.matterId, matterId)).orderBy(desc(researchDocuments.createdAt));
  }

  async getResearchDocument(id: string): Promise<ResearchDocument | undefined> {
    const [doc] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, id));
    return doc;
  }

  async createResearchDocument(doc: InsertResearchDocument): Promise<ResearchDocument> {
    const [newDoc] = await db.insert(researchDocuments).values(doc).returning();
    return newDoc;
  }

  async deleteResearchDocument(id: string): Promise<void> {
    await db.delete(researchDocuments).where(eq(researchDocuments.id, id));
  }

  async getAllResearchDocumentsForMatter(matterId: string): Promise<ResearchDocument[]> {
    return db.select().from(researchDocuments).where(eq(researchDocuments.matterId, matterId));
  }

  // Research Conversations
  async getResearchConversations(matterId: string): Promise<ResearchConversation[]> {
    return db.select().from(researchConversations).where(eq(researchConversations.matterId, matterId)).orderBy(desc(researchConversations.createdAt));
  }

  async getResearchConversation(id: string): Promise<ResearchConversation | undefined> {
    const [conv] = await db.select().from(researchConversations).where(eq(researchConversations.id, id));
    return conv;
  }

  async createResearchConversation(conv: InsertResearchConversation): Promise<ResearchConversation> {
    const [newConv] = await db.insert(researchConversations).values(conv).returning();
    return newConv;
  }

  async deleteResearchConversation(id: string): Promise<void> {
    await db.delete(researchMessages).where(eq(researchMessages.conversationId, id));
    await db.delete(researchConversations).where(eq(researchConversations.id, id));
  }

  // Research Messages
  async getResearchMessages(conversationId: string): Promise<ResearchMessage[]> {
    return db.select().from(researchMessages).where(eq(researchMessages.conversationId, conversationId)).orderBy(researchMessages.createdAt);
  }

  async createResearchMessage(msg: InsertResearchMessage): Promise<ResearchMessage> {
    const [newMsg] = await db.insert(researchMessages).values(msg).returning();
    return newMsg;
  }

  // Knowledge Base Categories
  async getKbCategories(scope: string): Promise<KbCategory[]> {
    return db.select().from(kbCategories).where(eq(kbCategories.scope, scope)).orderBy(kbCategories.sortOrder);
  }

  async getKbCategory(id: string): Promise<KbCategory | undefined> {
    const [category] = await db.select().from(kbCategories).where(eq(kbCategories.id, id));
    return category;
  }

  async createKbCategory(category: InsertKbCategory): Promise<KbCategory> {
    const [newCategory] = await db.insert(kbCategories).values(category).returning();
    return newCategory;
  }

  async updateKbCategory(id: string, category: Partial<InsertKbCategory>): Promise<KbCategory | undefined> {
    const [updated] = await db.update(kbCategories).set(category).where(eq(kbCategories.id, id)).returning();
    return updated;
  }

  async deleteKbCategory(id: string): Promise<void> {
    await db.delete(kbCategories).where(eq(kbCategories.id, id));
  }

  // Knowledge Base Articles
  async getKbArticles(scope: string): Promise<KbArticle[]> {
    return db.select().from(kbArticles).where(eq(kbArticles.scope, scope)).orderBy(desc(kbArticles.updatedAt));
  }

  async getKbArticle(id: string): Promise<KbArticle | undefined> {
    const [article] = await db.select().from(kbArticles).where(eq(kbArticles.id, id));
    return article;
  }

  async getKbArticleBySlug(slug: string, scope: string): Promise<KbArticle | undefined> {
    const [article] = await db.select().from(kbArticles).where(and(eq(kbArticles.slug, slug), eq(kbArticles.scope, scope)));
    return article;
  }

  async createKbArticle(article: InsertKbArticle): Promise<KbArticle> {
    const [newArticle] = await db.insert(kbArticles).values(article).returning();
    return newArticle;
  }

  async updateKbArticle(id: string, article: Partial<InsertKbArticle>): Promise<KbArticle | undefined> {
    const [updated] = await db.update(kbArticles).set({ ...article, updatedAt: new Date() }).where(eq(kbArticles.id, id)).returning();
    return updated;
  }

  async deleteKbArticle(id: string): Promise<void> {
    await db.delete(kbArticles).where(eq(kbArticles.id, id));
  }

  async searchKbArticles(scope: string, query: string): Promise<KbArticle[]> {
    return db.select().from(kbArticles).where(
      and(
        eq(kbArticles.scope, scope),
        eq(kbArticles.isPublished, true),
        or(
          ilike(kbArticles.title, `%${query}%`),
          ilike(kbArticles.summary, `%${query}%`),
          ilike(kbArticles.content, `%${query}%`)
        )
      )
    ).orderBy(desc(kbArticles.updatedAt));
  }

  // KB Tooltips
  async getKbTooltips(scope: string): Promise<KbTooltip[]> {
    return db.select().from(kbTooltips).where(eq(kbTooltips.scope, scope));
  }

  async getKbTooltipByKey(key: string): Promise<KbTooltip | undefined> {
    const [tooltip] = await db.select().from(kbTooltips).where(eq(kbTooltips.key, key));
    return tooltip;
  }

  async createKbTooltip(tooltip: InsertKbTooltip): Promise<KbTooltip> {
    const [newTooltip] = await db.insert(kbTooltips).values(tooltip).returning();
    return newTooltip;
  }

  async updateKbTooltip(id: string, tooltip: Partial<InsertKbTooltip>): Promise<KbTooltip | undefined> {
    const [updated] = await db.update(kbTooltips).set(tooltip).where(eq(kbTooltips.id, id)).returning();
    return updated;
  }

  async deleteKbTooltip(id: string): Promise<void> {
    await db.delete(kbTooltips).where(eq(kbTooltips.id, id));
  }

  // Security Status
  async getSecurityStatus(scope: string, clientId?: string): Promise<SecurityStatus | undefined> {
    if (scope === 'owner') {
      const [status] = await db.select().from(securityStatus).where(eq(securityStatus.scope, 'owner'));
      return status;
    }
    const [status] = await db.select().from(securityStatus).where(
      and(eq(securityStatus.scope, 'client'), eq(securityStatus.clientId, clientId!))
    );
    return status;
  }

  async createSecurityStatus(status: InsertSecurityStatus): Promise<SecurityStatus> {
    const [newStatus] = await db.insert(securityStatus).values(status).returning();
    return newStatus;
  }

  async updateSecurityStatus(id: string, status: Partial<InsertSecurityStatus>): Promise<SecurityStatus | undefined> {
    const [updated] = await db.update(securityStatus).set({ ...status, updatedAt: new Date() }).where(eq(securityStatus.id, id)).returning();
    return updated;
  }

  // Security Controls
  async getSecurityControls(scope: string, clientId?: string): Promise<SecurityControl[]> {
    if (scope === 'owner') {
      return db.select().from(securityControls).where(eq(securityControls.scope, 'owner'));
    }
    return db.select().from(securityControls).where(
      and(eq(securityControls.scope, 'client'), eq(securityControls.clientId, clientId!))
    );
  }

  async createSecurityControl(control: InsertSecurityControl): Promise<SecurityControl> {
    const [newControl] = await db.insert(securityControls).values(control).returning();
    return newControl;
  }

  async updateSecurityControl(id: string, control: Partial<InsertSecurityControl>): Promise<SecurityControl | undefined> {
    const [updated] = await db.update(securityControls).set(control).where(eq(securityControls.id, id)).returning();
    return updated;
  }

  async deleteSecurityControl(id: string): Promise<void> {
    await db.delete(securityControls).where(eq(securityControls.id, id));
  }

  // Client Portals
  async getClientPortals(clientId: string): Promise<ClientPortal[]> {
    return db.select().from(clientPortals).where(eq(clientPortals.clientId, clientId)).orderBy(desc(clientPortals.createdAt));
  }

  async getClientPortal(id: string): Promise<ClientPortal | undefined> {
    const [portal] = await db.select().from(clientPortals).where(eq(clientPortals.id, id));
    return portal;
  }

  async getClientPortalBySlug(clientId: string, slug: string): Promise<ClientPortal | undefined> {
    const [portal] = await db.select().from(clientPortals).where(
      and(eq(clientPortals.clientId, clientId), eq(clientPortals.slug, slug))
    );
    return portal;
  }

  async createClientPortal(portal: InsertClientPortal): Promise<ClientPortal> {
    const [newPortal] = await db.insert(clientPortals).values(portal).returning();
    return newPortal;
  }

  async updateClientPortal(id: string, portal: Partial<InsertClientPortal>): Promise<ClientPortal | undefined> {
    const [updated] = await db.update(clientPortals).set({ ...portal, updatedAt: new Date() }).where(eq(clientPortals.id, id)).returning();
    return updated;
  }

  async deleteClientPortal(id: string): Promise<void> {
    await db.delete(portalMatterAccess).where(eq(portalMatterAccess.portalId, id));
    await db.delete(clientPortals).where(eq(clientPortals.id, id));
  }

  // Portal Matter Access
  async getPortalMatterAccess(portalId: string): Promise<PortalMatterAccess[]> {
    return db.select().from(portalMatterAccess).where(eq(portalMatterAccess.portalId, portalId));
  }

  async createPortalMatterAccess(access: InsertPortalMatterAccess): Promise<PortalMatterAccess> {
    const [newAccess] = await db.insert(portalMatterAccess).values(access).returning();
    return newAccess;
  }

  async deletePortalMatterAccess(id: string): Promise<void> {
    await db.delete(portalMatterAccess).where(eq(portalMatterAccess.id, id));
  }

  async deletePortalMatterAccessByPortal(portalId: string): Promise<void> {
    await db.delete(portalMatterAccess).where(eq(portalMatterAccess.portalId, portalId));
  }

  // YouTube Watch List
  async getYoutubeWatchList(clientId: string): Promise<YoutubeWatchList[]> {
    return db.select().from(youtubeWatchList).where(eq(youtubeWatchList.clientId, clientId)).orderBy(desc(youtubeWatchList.createdAt));
  }

  async getYoutubeWatchListItem(id: string): Promise<YoutubeWatchList | undefined> {
    const [item] = await db.select().from(youtubeWatchList).where(eq(youtubeWatchList.id, id));
    return item;
  }

  async getYoutubeWatchListByStatus(clientId: string, status: string): Promise<YoutubeWatchList[]> {
    return db.select().from(youtubeWatchList).where(and(eq(youtubeWatchList.clientId, clientId), eq(youtubeWatchList.status, status)));
  }

  async createYoutubeWatchListItem(item: InsertYoutubeWatchList): Promise<YoutubeWatchList> {
    const [newItem] = await db.insert(youtubeWatchList).values(item).returning();
    return newItem;
  }

  async updateYoutubeWatchListItem(id: string, item: Partial<InsertYoutubeWatchList & { lastCheckedAt: Date }>): Promise<YoutubeWatchList | undefined> {
    const [updated] = await db.update(youtubeWatchList).set(item).where(eq(youtubeWatchList.id, id)).returning();
    return updated;
  }

  async deleteYoutubeWatchListItem(id: string): Promise<void> {
    await db.delete(youtubeWatchList).where(eq(youtubeWatchList.id, id));
  }

  // Tracked Bills
  async getTrackedBills(clientId: string): Promise<TrackedBill[]> {
    return db.select().from(trackedBills).where(eq(trackedBills.clientId, clientId)).orderBy(desc(trackedBills.createdAt));
  }

  async getTrackedBill(id: string): Promise<TrackedBill | undefined> {
    const [bill] = await db.select().from(trackedBills).where(eq(trackedBills.id, id));
    return bill;
  }

  async getTrackedBillByNumber(clientId: string, congress: number, billType: string, billNumber: number): Promise<TrackedBill | undefined> {
    const [bill] = await db.select().from(trackedBills).where(
      and(
        eq(trackedBills.clientId, clientId),
        eq(trackedBills.congress, congress),
        eq(trackedBills.billType, billType),
        eq(trackedBills.billNumber, billNumber)
      )
    );
    return bill;
  }

  async createTrackedBill(bill: InsertTrackedBill): Promise<TrackedBill> {
    const [newBill] = await db.insert(trackedBills).values(bill).returning();
    return newBill;
  }

  async updateTrackedBill(id: string, bill: Partial<InsertTrackedBill & { lastSyncedAt: Date }>): Promise<TrackedBill | undefined> {
    const [updated] = await db.update(trackedBills).set(bill).where(eq(trackedBills.id, id)).returning();
    return updated;
  }

  async deleteTrackedBill(id: string): Promise<void> {
    await db.delete(trackedBills).where(eq(trackedBills.id, id));
  }

  // Client Applications
  async getClientApplications(): Promise<ClientApplication[]> {
    return db.select().from(clientApplications).orderBy(desc(clientApplications.createdAt));
  }

  async getClientApplication(id: string): Promise<ClientApplication | undefined> {
    const [app] = await db.select().from(clientApplications).where(eq(clientApplications.id, id));
    return app;
  }

  async getClientApplicationByEmail(email: string): Promise<ClientApplication | undefined> {
    const [app] = await db.select().from(clientApplications).where(eq(clientApplications.email, email));
    return app;
  }

  async getClientApplicationByToken(token: string): Promise<ClientApplication | undefined> {
    const [app] = await db.select().from(clientApplications).where(eq(clientApplications.emailVerificationToken, token));
    return app;
  }

  async createClientApplication(app: InsertClientApplication & { emailVerificationToken: string; emailVerificationExpires: Date }): Promise<ClientApplication> {
    const [newApp] = await db.insert(clientApplications).values(app).returning();
    return newApp;
  }

  async updateClientApplication(id: string, app: Partial<ClientApplication>): Promise<ClientApplication | undefined> {
    const [updated] = await db.update(clientApplications).set({ ...app, updatedAt: new Date() }).where(eq(clientApplications.id, id)).returning();
    return updated;
  }

  async deleteClientApplication(id: string): Promise<void> {
    await db.delete(clientApplications).where(eq(clientApplications.id, id));
  }

  // Bill Change History
  async getBillChangeHistory(trackedBillId: string): Promise<BillChangeHistory[]> {
    return db.select().from(billChangeHistory).where(eq(billChangeHistory.trackedBillId, trackedBillId)).orderBy(desc(billChangeHistory.detectedAt));
  }

  async getUnreadBillChanges(clientId: string): Promise<(BillChangeHistory & { bill: TrackedBill })[]> {
    const bills = await db.select().from(trackedBills).where(eq(trackedBills.clientId, clientId));
    const billIds = bills.map(b => b.id);
    if (billIds.length === 0) return [];

    const changes = await db.select().from(billChangeHistory)
      .where(and(
        eq(billChangeHistory.isRead, false),
        or(...billIds.map(id => eq(billChangeHistory.trackedBillId, id)))
      ))
      .orderBy(desc(billChangeHistory.detectedAt));

    return changes.map(change => {
      const bill = bills.find(b => b.id === change.trackedBillId)!;
      return { ...change, bill };
    });
  }

  async createBillChange(change: InsertBillChangeHistory): Promise<BillChangeHistory> {
    const [newChange] = await db.insert(billChangeHistory).values(change).returning();
    return newChange;
  }

  async markBillChangeAsRead(id: string): Promise<void> {
    await db.update(billChangeHistory).set({ isRead: true }).where(eq(billChangeHistory.id, id));
  }

  async markAllBillChangesAsRead(trackedBillId: string): Promise<void> {
    await db.update(billChangeHistory).set({ isRead: true }).where(eq(billChangeHistory.trackedBillId, trackedBillId));
  }

  // Bill Tracking Alerts
  async getBillTrackingAlert(trackedBillId: string): Promise<BillTrackingAlert | undefined> {
    const [alert] = await db.select().from(billTrackingAlerts).where(eq(billTrackingAlerts.trackedBillId, trackedBillId));
    return alert;
  }

  async createBillTrackingAlert(alert: InsertBillTrackingAlert): Promise<BillTrackingAlert> {
    const [newAlert] = await db.insert(billTrackingAlerts).values(alert).returning();
    return newAlert;
  }

  async updateBillTrackingAlert(id: string, alert: Partial<InsertBillTrackingAlert>): Promise<BillTrackingAlert | undefined> {
    const [updated] = await db.update(billTrackingAlerts).set(alert).where(eq(billTrackingAlerts.id, id)).returning();
    return updated;
  }

  async deleteBillTrackingAlert(trackedBillId: string): Promise<void> {
    await db.delete(billTrackingAlerts).where(eq(billTrackingAlerts.trackedBillId, trackedBillId));
  }

  // Social Tracking - Accounts
  async getTrackedSocialAccounts(clientId: string): Promise<TrackedSocialAccount[]> {
    return db.select().from(trackedSocialAccounts).where(eq(trackedSocialAccounts.clientId, clientId)).orderBy(desc(trackedSocialAccounts.createdAt));
  }

  async getTrackedSocialAccount(id: string): Promise<TrackedSocialAccount | undefined> {
    const [account] = await db.select().from(trackedSocialAccounts).where(eq(trackedSocialAccounts.id, id));
    return account;
  }

  async createTrackedSocialAccount(account: InsertTrackedSocialAccount): Promise<TrackedSocialAccount> {
    const [newAccount] = await db.insert(trackedSocialAccounts).values(account).returning();
    return newAccount;
  }

  async updateTrackedSocialAccount(id: string, account: Partial<InsertTrackedSocialAccount>): Promise<TrackedSocialAccount | undefined> {
    const [updated] = await db.update(trackedSocialAccounts).set({ ...account, updatedAt: new Date() }).where(eq(trackedSocialAccounts.id, id)).returning();
    return updated;
  }

  async deleteTrackedSocialAccount(id: string): Promise<void> {
    await db.delete(trackedSocialAccounts).where(eq(trackedSocialAccounts.id, id));
  }

  // Social Tracking - Keywords
  async getSocialTrackingKeywords(clientId: string): Promise<SocialTrackingKeyword[]> {
    return db.select().from(socialTrackingKeywords).where(eq(socialTrackingKeywords.clientId, clientId)).orderBy(desc(socialTrackingKeywords.createdAt));
  }

  async getSocialTrackingKeywordsForAccount(accountId: string): Promise<SocialTrackingKeyword[]> {
    return db.select().from(socialTrackingKeywords).where(eq(socialTrackingKeywords.accountId, accountId));
  }

  async createSocialTrackingKeyword(keyword: InsertSocialTrackingKeyword): Promise<SocialTrackingKeyword> {
    const [newKeyword] = await db.insert(socialTrackingKeywords).values(keyword).returning();
    return newKeyword;
  }

  async deleteSocialTrackingKeyword(id: string): Promise<void> {
    await db.delete(socialTrackingKeywords).where(eq(socialTrackingKeywords.id, id));
  }

  // Social Tracking - Posts
  async getTrackedSocialPosts(clientId: string, limit: number = 100): Promise<TrackedSocialPost[]> {
    return db.select().from(trackedSocialPosts).where(eq(trackedSocialPosts.clientId, clientId)).orderBy(desc(trackedSocialPosts.createdAt)).limit(limit);
  }

  async getTrackedSocialPostsByAccount(accountId: string, limit: number = 100): Promise<TrackedSocialPost[]> {
    return db.select().from(trackedSocialPosts).where(eq(trackedSocialPosts.accountId, accountId)).orderBy(desc(trackedSocialPosts.createdAt)).limit(limit);
  }

  async createTrackedSocialPost(post: InsertTrackedSocialPost): Promise<TrackedSocialPost> {
    const [newPost] = await db.insert(trackedSocialPosts).values(post).returning();
    return newPost;
  }

  async updateTrackedSocialPost(id: string, post: Partial<InsertTrackedSocialPost>): Promise<TrackedSocialPost | undefined> {
    const [updated] = await db.update(trackedSocialPosts).set(post).where(eq(trackedSocialPosts.id, id)).returning();
    return updated;
  }

  async markSocialPostAsRead(id: string): Promise<void> {
    await db.update(trackedSocialPosts).set({ isRead: true }).where(eq(trackedSocialPosts.id, id));
  }

  async toggleSocialPostFlag(id: string): Promise<TrackedSocialPost | undefined> {
    const [post] = await db.select().from(trackedSocialPosts).where(eq(trackedSocialPosts.id, id));
    if (!post) return undefined;
    const [updated] = await db.update(trackedSocialPosts).set({ isFlagged: !post.isFlagged }).where(eq(trackedSocialPosts.id, id)).returning();
    return updated;
  }

  async socialPostExists(postId: string, accountId: string): Promise<boolean> {
    const [existing] = await db.select().from(trackedSocialPosts).where(and(eq(trackedSocialPosts.postId, postId), eq(trackedSocialPosts.accountId, accountId)));
    return !!existing;
  }
}

export const storage = new DatabaseStorage();
