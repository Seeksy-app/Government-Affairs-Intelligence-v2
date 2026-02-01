import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import {
  insertClientSchema,
  insertContactSchema,
  insertNewsArticleSchema,
  insertCareerHistorySchema,
} from "@shared/schema";

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
        return res.json({ isSuperAdmin: true });
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

  // ==================== CLIENT USER ROUTES ====================

  // Helper to get client ID for current user
  const getClientId = async (req: any): Promise<string | null> => {
    const userId = getUserId(req);
    if (!userId) return null;
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

  return httpServer;
}
