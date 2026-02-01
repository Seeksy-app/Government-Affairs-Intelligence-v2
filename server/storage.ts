import { db } from "./db";
import { eq, desc, and, gte } from "drizzle-orm";
import {
  clients,
  clientUsers,
  superAdmins,
  contacts,
  careerHistory,
  contactConnections,
  newsArticles,
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

    return {
      totalContacts: clientContacts.length,
      highPriorityContacts: highPriority.length,
      totalNews: clientNews.length,
      unreadNews: unread.length,
    };
  }
}

export const storage = new DatabaseStorage();
