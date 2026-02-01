import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import {
  insertClientSchema,
  insertContactSchema,
  insertNewsArticleSchema,
  insertCareerHistorySchema,
  insertMatterSchema,
} from "@shared/schema";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    impersonatingClientId?: string;
    impersonatingClientName?: string;
  }
}

const entityResearchSchema = z.object({
  entityName: z.string().min(1, "Entity name is required"),
  entityType: z.enum(["person", "organization", "company"]),
});

const extractDataSchema = z.object({
  urls: z.array(z.string().url()).min(1, "At least one URL is required"),
  prompt: z.string().min(1, "Prompt is required"),
  schema: z.record(z.unknown()).optional(),
});

const agentQuerySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  schema: z.record(z.unknown()).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // Helper to get user ID from request
  const getUserId = (req: any): string | undefined => {
    return req.user?.claims?.sub;
  };

  // Get user role endpoint
  app.get("/api/user/role", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if super admin
      let superAdmin = await storage.getSuperAdminByUserId(userId);
      
      // Auto-create first super admin if none exists
      if (!superAdmin) {
        const allSuperAdmins = await storage.getSuperAdmins();
        if (allSuperAdmins.length === 0) {
          // First user becomes super admin
          superAdmin = await storage.createSuperAdmin({ userId });
          console.log(`Auto-created super admin for user ${userId}`);
        }
      }
      
      if (superAdmin) {
        // Check if impersonating a client
        const impersonatingClientId = req.session?.impersonatingClientId;
        const impersonatingClientName = req.session?.impersonatingClientName;
        return res.json({ 
          isSuperAdmin: true,
          impersonatingClientId,
          impersonatingClientName,
        });
      }

      // Check if client user
      const clientUser = await storage.getClientUserByUserId(userId);
      if (clientUser) {
        const client = await storage.getClient(clientUser.clientId);
        return res.json({
          isSuperAdmin: false,
          clientId: clientUser.clientId,
          clientName: client?.name,
          role: clientUser.role,
        });
      }

      // No role assigned - user needs to be explicitly assigned to a client by super admin
      return res.json({ isSuperAdmin: false, needsAssignment: true });
    } catch (error) {
      console.error("Error getting user role:", error);
      res.status(500).json({ message: "Failed to get user role" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  // Admin: Get all clients
  app.get("/api/admin/clients", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error getting clients:", error);
      res.status(500).json({ message: "Failed to get clients" });
    }
  });

  // Admin: Get recent clients
  app.get("/api/admin/clients/recent", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const clients = await storage.getRecentClients(5);
      res.json(clients);
    } catch (error) {
      console.error("Error getting recent clients:", error);
      res.status(500).json({ message: "Failed to get recent clients" });
    }
  });

  // Admin: Create client
  app.post("/api/admin/clients", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }
      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Admin: Update client
  app.patch("/api/admin/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Admin: Delete client
  app.delete("/api/admin/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteClient(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Admin: Get stats
  app.get("/api/admin/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting admin stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Admin: Get client users
  app.get("/api/admin/clients/:clientId/users", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const users = await storage.getClientUsers(req.params.clientId);
      res.json(users);
    } catch (error) {
      console.error("Error getting client users:", error);
      res.status(500).json({ message: "Failed to get client users" });
    }
  });

  // Admin: Add user to client
  app.post("/api/admin/clients/:clientId/users", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { targetUserId, role } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ message: "targetUserId is required" });
      }
      const clientUser = await storage.createClientUser({
        userId: targetUserId,
        clientId: req.params.clientId,
        role: role || "member",
      });
      res.status(201).json(clientUser);
    } catch (error) {
      console.error("Error adding user to client:", error);
      res.status(500).json({ message: "Failed to add user to client" });
    }
  });

  // Admin: Remove user from client
  app.delete("/api/admin/client-users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteClientUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing user from client:", error);
      res.status(500).json({ message: "Failed to remove user from client" });
    }
  });

  // Admin: Impersonate a client
  app.post("/api/admin/impersonate/:clientId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const clientId = req.params.clientId as string;
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      req.session.impersonatingClientId = clientId;
      req.session.impersonatingClientName = client.name;
      
      res.json({ 
        success: true, 
        impersonatingClientId: clientId,
        impersonatingClientName: client.name,
      });
    } catch (error) {
      console.error("Error impersonating client:", error);
      res.status(500).json({ message: "Failed to impersonate client" });
    }
  });

  // Admin: Stop impersonating
  app.post("/api/admin/stop-impersonate", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      delete req.session.impersonatingClientId;
      delete req.session.impersonatingClientName;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // ==================== CLIENT USER ROUTES ====================

  // Helper to get client ID for current user (respects impersonation for super admins)
  const getClientId = async (req: any): Promise<string | null> => {
    const userId = getUserId(req);
    if (!userId) return null;
    
    // Check if super admin is impersonating
    const superAdmin = await storage.getSuperAdminByUserId(userId);
    if (superAdmin && req.session?.impersonatingClientId) {
      return req.session.impersonatingClientId;
    }
    
    const clientUser = await storage.getClientUserByUserId(userId);
    return clientUser?.clientId || null;
  };

  // Get client stats
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const stats = await storage.getClientStats(clientId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // ==================== CONTACTS ROUTES ====================

  // Get all contacts for client
  app.get("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contacts = await storage.getContacts(clientId);
      res.json(contacts);
    } catch (error) {
      console.error("Error getting contacts:", error);
      res.status(500).json({ message: "Failed to get contacts" });
    }
  });

  // Get recent contacts
  app.get("/api/contacts/recent", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contacts = await storage.getRecentContacts(clientId, 5);
      res.json(contacts);
    } catch (error) {
      console.error("Error getting recent contacts:", error);
      res.status(500).json({ message: "Failed to get recent contacts" });
    }
  });

  // Get contacts with history
  app.get("/api/contacts/with-history", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contacts = await storage.getContactsWithHistory(clientId);
      res.json(contacts);
    } catch (error) {
      console.error("Error getting contacts with history:", error);
      res.status(500).json({ message: "Failed to get contacts with history" });
    }
  });

  // Create contact
  app.post("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const parsed = insertContactSchema.safeParse({ ...req.body, clientId });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }
      const contact = await storage.createContact(parsed.data);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Update contact
  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contact = await storage.getContact(req.params.id);
      if (!contact || contact.clientId !== clientId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const updated = await storage.updateContact(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contact = await storage.getContact(req.params.id);
      if (!contact || contact.clientId !== clientId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      await storage.deleteContact(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // ==================== NEWS ROUTES ====================

  // Get all news for client
  app.get("/api/news", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const news = await storage.getNewsArticles(clientId);
      res.json(news);
    } catch (error) {
      console.error("Error getting news:", error);
      res.status(500).json({ message: "Failed to get news" });
    }
  });

  // Get recent news
  app.get("/api/news/recent", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const news = await storage.getRecentNews(clientId, 5);
      res.json(news);
    } catch (error) {
      console.error("Error getting recent news:", error);
      res.status(500).json({ message: "Failed to get recent news" });
    }
  });

  // Create news article
  app.post("/api/news", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const parsed = insertNewsArticleSchema.safeParse({ ...req.body, clientId });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }
      const article = await storage.createNewsArticle(parsed.data);
      res.status(201).json(article);
    } catch (error) {
      console.error("Error creating news article:", error);
      res.status(500).json({ message: "Failed to create news article" });
    }
  });

  // Update news article
  app.patch("/api/news/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const article = await storage.getNewsArticle(req.params.id);
      if (!article || article.clientId !== clientId) {
        return res.status(404).json({ message: "Article not found" });
      }
      const updated = await storage.updateNewsArticle(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating news article:", error);
      res.status(500).json({ message: "Failed to update news article" });
    }
  });

  // Delete news article
  app.delete("/api/news/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const article = await storage.getNewsArticle(req.params.id);
      if (!article || article.clientId !== clientId) {
        return res.status(404).json({ message: "Article not found" });
      }
      await storage.deleteNewsArticle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting news article:", error);
      res.status(500).json({ message: "Failed to delete news article" });
    }
  });

  // ==================== CAREER HISTORY ROUTES ====================

  // Add career history to contact
  app.post("/api/contacts/:contactId/career", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contact = await storage.getContact(req.params.contactId);
      if (!contact || contact.clientId !== clientId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const parsed = insertCareerHistorySchema.safeParse({
        ...req.body,
        contactId: req.params.contactId,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }
      const history = await storage.createCareerHistory(parsed.data);
      res.status(201).json(history);
    } catch (error) {
      console.error("Error creating career history:", error);
      res.status(500).json({ message: "Failed to create career history" });
    }
  });

  // ==================== MATTERS (SUB-CLIENTS) ROUTES ====================

  // Get all matters for client
  app.get("/api/matters", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const mattersList = await storage.getMatters(clientId);
      res.json(mattersList);
    } catch (error) {
      console.error("Error getting matters:", error);
      res.status(500).json({ message: "Failed to get matters" });
    }
  });

  // Get single matter
  app.get("/api/matters/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.id);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }
      res.json(matter);
    } catch (error) {
      console.error("Error getting matter:", error);
      res.status(500).json({ message: "Failed to get matter" });
    }
  });

  // Create matter
  app.post("/api/matters", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const parsed = insertMatterSchema.safeParse({ ...req.body, clientId });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }
      const matter = await storage.createMatter(parsed.data);
      res.status(201).json(matter);
    } catch (error) {
      console.error("Error creating matter:", error);
      res.status(500).json({ message: "Failed to create matter" });
    }
  });

  // Update matter
  app.patch("/api/matters/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.id);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }
      const updated = await storage.updateMatter(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating matter:", error);
      res.status(500).json({ message: "Failed to update matter" });
    }
  });

  // Delete matter
  app.delete("/api/matters/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.id);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }
      await storage.deleteMatter(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting matter:", error);
      res.status(500).json({ message: "Failed to delete matter" });
    }
  });

  // ==================== RESEARCH DOCUMENTS ROUTES ====================

  // Get documents for a matter
  app.get("/api/matters/:matterId/documents", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }
      const docs = await storage.getResearchDocuments(req.params.matterId);
      res.json(docs);
    } catch (error) {
      console.error("Error getting documents:", error);
      res.status(500).json({ message: "Failed to get documents" });
    }
  });

  // Add document from URL (uses Firecrawl/YouTube)
  app.post("/api/matters/:matterId/documents/url", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const { extractContentFromUrl, generateSummary } = await import("./services/research-agent");
      const extracted = await extractContentFromUrl(url);
      const summary = await generateSummary(extracted.content);

      const doc = await storage.createResearchDocument({
        matterId: req.params.matterId,
        clientId,
        title: extracted.title,
        type: extracted.type,
        sourceUrl: url,
        extractedContent: extracted.content,
        summary,
      });

      res.status(201).json(doc);
    } catch (error) {
      console.error("Error adding document from URL:", error);
      res.status(500).json({ message: `Failed to extract content: ${error}` });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const doc = await storage.getResearchDocument(req.params.id);
      if (!doc || doc.clientId !== clientId) {
        return res.status(404).json({ message: "Document not found" });
      }
      await storage.deleteResearchDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ==================== RESEARCH CONVERSATIONS ROUTES ====================

  // Get conversations for a matter
  app.get("/api/matters/:matterId/conversations", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }
      const convs = await storage.getResearchConversations(req.params.matterId);
      res.json(convs);
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).json({ message: "Failed to get conversations" });
    }
  });

  // Create conversation
  app.post("/api/matters/:matterId/conversations", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const conv = await storage.createResearchConversation({
        matterId: req.params.matterId,
        clientId,
        title: req.body.title || "New Research Session",
      });
      res.status(201).json(conv);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:convId/messages", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const conv = await storage.getResearchConversation(req.params.convId);
      if (!conv || conv.clientId !== clientId) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      const messages = await storage.getResearchMessages(req.params.convId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/conversations/:convId/chat", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const conv = await storage.getResearchConversation(req.params.convId);
      if (!conv || conv.clientId !== clientId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ message: "Question is required" });
      }

      // Save user message
      await storage.createResearchMessage({
        conversationId: req.params.convId,
        role: "user",
        content: question,
      });

      // Get all documents for this matter
      const docs = await storage.getAllResearchDocumentsForMatter(conv.matterId);
      const documentContext = docs.map((d) => ({
        title: d.title,
        content: d.extractedContent || "",
      }));

      // Get conversation history
      const history = await storage.getResearchMessages(req.params.convId);
      const chatHistory = history.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { chatWithContext } = await import("./services/research-agent");
      let fullResponse = "";

      for await (const chunk of chatWithContext(question, documentContext, chatHistory)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Save assistant message
      await storage.createResearchMessage({
        conversationId: req.params.convId,
        role: "assistant",
        content: fullResponse,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Chat failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to process chat" });
      }
    }
  });

  // ==================== CAREER ANALYSIS ROUTES ====================

  // Analyze staffer career
  app.get("/api/contacts/:contactId/career-analysis", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const contact = await storage.getContact(req.params.contactId);
      if (!contact || contact.clientId !== clientId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const history = await storage.getCareerHistory(req.params.contactId);
      if (history.length === 0) {
        return res.json({ summary: "No career history available", patterns: [], policyFocus: [], connections: [] });
      }

      const { analyzeStafferCareer } = await import("./services/research-agent");
      const analysis = await analyzeStafferCareer(history);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing career:", error);
      res.status(500).json({ message: "Failed to analyze career" });
    }
  });

  // ==================== AI AGENT RESEARCH ROUTES ====================

  // Research a political entity using Firecrawl agent
  app.post("/api/matters/:matterId/research/entity", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const parsed = entityResearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const { entityName, entityType } = parsed.data;
      const { researchPoliticalEntity, generateSummary } = await import("./services/research-agent");
      const result = await researchPoliticalEntity(entityName, entityType);
      const summary = await generateSummary(result.content);

      const doc = await storage.createResearchDocument({
        matterId: req.params.matterId,
        clientId,
        title: result.title,
        type: "agent",
        extractedContent: result.content,
        summary,
      });

      res.status(201).json(doc);
    } catch (error) {
      console.error("Error researching entity:", error);
      res.status(500).json({ message: "Failed to research entity. Please try again." });
    }
  });

  // Extract structured data from URLs using Firecrawl
  app.post("/api/matters/:matterId/research/extract", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const parsed = extractDataSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const { urls, prompt, schema } = parsed.data;
      const { extractStructuredData, generateSummary } = await import("./services/research-agent");
      const result = await extractStructuredData(urls, prompt, schema as any);
      const summary = await generateSummary(result.content);

      const doc = await storage.createResearchDocument({
        matterId: req.params.matterId,
        clientId,
        title: result.title,
        type: "extract",
        sourceUrl: urls[0],
        extractedContent: result.content,
        summary,
      });

      res.status(201).json(doc);
    } catch (error) {
      console.error("Error extracting data:", error);
      res.status(500).json({ message: "Failed to extract data. Please try again." });
    }
  });

  // Run a custom agent query
  app.post("/api/matters/:matterId/research/agent-query", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const matter = await storage.getMatter(req.params.matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const parsed = agentQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const { prompt, schema } = parsed.data;
      const { runAgentQuery, generateSummary } = await import("./services/research-agent");
      const result = await runAgentQuery(prompt, schema as any);

      const content = JSON.stringify(result.data, null, 2);
      const summary = await generateSummary(content);

      const doc = await storage.createResearchDocument({
        matterId: req.params.matterId,
        clientId,
        title: `Agent Query: ${prompt.slice(0, 40)}...`,
        type: "agent",
        extractedContent: content,
        summary,
      });

      res.status(201).json({ ...doc, sources: result.sources });
    } catch (error) {
      console.error("Error running agent query:", error);
      res.status(500).json({ message: "Agent query failed. Please try again." });
    }
  });

  return httpServer;
}
