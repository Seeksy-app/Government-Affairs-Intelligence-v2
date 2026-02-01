import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes, authStorage } from "./replit_integrations/auth";
import {
  insertClientSchema,
  insertContactSchema,
  insertNewsArticleSchema,
  insertCareerHistorySchema,
  insertMatterSchema,
  insertKbCategorySchema,
  insertKbArticleSchema,
  insertKbTooltipSchema,
  insertSecurityStatusSchema,
  insertSecurityControlSchema,
  insertClientPortalSchema,
  insertPortalMatterAccessSchema,
  insertYoutubeWatchListSchema,
  insertTrackedBillSchema,
  insertClientApplicationSchema,
} from "@shared/schema";
import { extractVideoId, checkTranscriptAvailable, getTranscript, TRANSCRIPT_SOURCES, checkPendingWatchList } from "./services/youtube-watchlist";
import { CongressAPI, formatBillId, parseBillId } from "./services/congress-api";
import { z } from "zod";
import { sendEmail, sendDailyBrief, sendResearchUpdate } from "./services/email-service";

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

  // Public: Submit client application (signup)
  app.post("/api/client-applications", async (req, res) => {
    try {
      const parsed = insertClientApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid application data", errors: parsed.error.errors });
      }

      // Check if email already exists
      const existing = await storage.getClientApplicationByEmail(parsed.data.email);
      if (existing) {
        return res.status(400).json({ message: "An application with this email already exists" });
      }

      // Generate verification token
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const application = await storage.createClientApplication({
        ...parsed.data,
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      });

      // Send verification email - use the request host to get correct domain for both dev and production
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['host'] || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
      const verifyUrl = `${protocol}://${host}/verify-email?token=${token}`;
      
      await sendEmail({
        to: parsed.data.email,
        subject: "Verify your email - Political Intelligence Platform",
        html: `
          <h2>Welcome to the Political Intelligence Platform</h2>
          <p>Hi ${parsed.data.contactName},</p>
          <p>Thank you for applying to join the Political Intelligence Platform. Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:white;text-decoration:none;border-radius:4px;">Verify Email</a></p>
          <p>Or copy and paste this link: ${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
          <p>After verification, our team will review your application and you'll receive a notification once approved.</p>
          <p>Best regards,<br>The Political Intelligence Team</p>
        `,
      });

      res.status(201).json({ success: true, message: "Application submitted. Please check your email to verify." });
    } catch (error) {
      console.error("Error creating client application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Public: Verify email
  app.get("/api/client-applications/verify", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const application = await storage.getClientApplicationByToken(token);
      if (!application) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      if (application.emailVerificationExpires && new Date(application.emailVerificationExpires) < new Date()) {
        return res.status(400).json({ message: "Verification token has expired. Please submit a new application." });
      }

      if (application.emailVerified) {
        return res.json({ message: "Email already verified. You can log in.", approved: true });
      }

      // Auto-approve: Create the client immediately upon email verification
      const slug = application.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const client = await storage.createClient({
        name: application.companyName,
        slug: slug + "-" + randomBytes(4).toString("hex"),
        industry: application.industry || undefined,
        isActive: true,
      });

      // Generate password setup token
      const setupToken = randomBytes(32).toString("hex");
      const setupTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create the user record with the setup token
      const nameParts = application.contactName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      const user = await authStorage.createUser({
        email: application.email,
        firstName,
        lastName,
      });

      // Link user to client with admin role
      await storage.createClientUser({
        userId: user.id,
        clientId: client.id,
        role: "admin",
      });

      await storage.updateClientApplication(application.id, {
        emailVerified: true,
        emailVerificationToken: setupToken, // Reuse this field for password setup
        emailVerificationExpires: setupTokenExpires,
        status: "approved",
        approvedClientId: client.id,
      });

      // Don't send email yet - let user set password first
      res.json({ 
        message: "Email verified! Please set up your password.", 
        approved: true,
        setupToken,
        email: application.email,
      });
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Password Auth: Set password after email verification
  app.post("/api/auth/set-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Find application with this setup token
      const application = await storage.getClientApplicationByToken(token);
      if (!application) {
        return res.status(400).json({ message: "Invalid or expired setup token" });
      }

      if (application.emailVerificationExpires && new Date(application.emailVerificationExpires) < new Date()) {
        return res.status(400).json({ message: "Setup token has expired. Please contact support." });
      }

      // Find the user by email
      const user = await authStorage.getUserByEmail(application.email);
      if (!user) {
        return res.status(400).json({ message: "User not found. Please contact support." });
      }

      // Hash the password and save it
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      await authStorage.setUserPassword(user.id, passwordHash);

      // Clear the setup token
      await storage.updateClientApplication(application.id, {
        emailVerificationToken: null,
      });

      // Send welcome email
      const baseUrl = req.headers.host?.includes('localhost') 
        ? `http://${req.headers.host}` 
        : `https://${req.headers.host}`;
      
      await sendEmail({
        to: application.email,
        subject: "Welcome to the Political Intelligence Platform!",
        html: `
          <h2>Welcome Aboard!</h2>
          <p>Hi ${application.contactName},</p>
          <p>Your account for <strong>${application.companyName}</strong> is now fully set up!</p>
          <p>You can now log in using your email and password.</p>
          <p><a href="${baseUrl}/login" style="display:inline-block;padding:12px 24px;background:#0066cc;color:white;text-decoration:none;border-radius:4px;">Log In Now</a></p>
          <p>Welcome to the Political Intelligence Platform!</p>
          <p>Best regards,<br>The Political Intelligence Team</p>
        `,
      });

      res.json({ message: "Password set successfully. You can now log in." });
    } catch (error) {
      console.error("Error setting password:", error);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // Password Auth: Login with email and password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email
      const user = await authStorage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user has a password set
      if (!user.passwordHash) {
        return res.status(401).json({ message: "Password not set. Please complete your account setup." });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set up the session
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }

        // Determine user role
        (async () => {
          try {
            const superAdmin = await storage.getSuperAdminByUserId(user.id);
            const clientUser = await storage.getClientUserByUserId(user.id);
            
            let role = "client";
            if (superAdmin) {
              role = "admin";
            }
            
            res.json({ 
              message: "Login successful",
              role,
              user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              }
            });
          } catch (error) {
            console.error("Error determining role:", error);
            res.json({ message: "Login successful", role: "client" });
          }
        })();
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Password Auth: Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Admin: Get all client applications
  app.get("/api/admin/applications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const applications = await storage.getClientApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error getting applications:", error);
      res.status(500).json({ message: "Failed to get applications" });
    }
  });

  // Admin: Approve application
  app.post("/api/admin/applications/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const application = await storage.getClientApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (!application.emailVerified) {
        return res.status(400).json({ message: "Cannot approve application with unverified email" });
      }

      if (application.status !== "pending") {
        return res.status(400).json({ message: "Application already processed" });
      }

      // Create the client
      const slug = application.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const client = await storage.createClient({
        name: application.companyName,
        slug: slug + "-" + randomBytes(4).toString("hex"),
        industry: application.industry || undefined,
        isActive: true,
      });

      // Update application
      await storage.updateClientApplication(application.id, {
        status: "approved",
        approvedClientId: client.id,
      });

      // Send approval email
      await sendEmail({
        to: application.email,
        subject: "Your Application Has Been Approved! - Political Intelligence Platform",
        html: `
          <h2>Congratulations!</h2>
          <p>Hi ${application.contactName},</p>
          <p>Your application for <strong>${application.companyName}</strong> has been approved!</p>
          <p>Your account is now active. You can log in using your work email through our secure authentication system.</p>
          <p><a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:white;text-decoration:none;border-radius:4px;">Log In Now</a></p>
          <p>Welcome to the Political Intelligence Platform!</p>
          <p>Best regards,<br>The Political Intelligence Team</p>
        `,
      });

      res.json({ success: true, client });
    } catch (error) {
      console.error("Error approving application:", error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  // Admin: Reject application
  app.post("/api/admin/applications/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const application = await storage.getClientApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.status !== "pending") {
        return res.status(400).json({ message: "Application already processed" });
      }

      const { reason } = req.body;

      await storage.updateClientApplication(application.id, {
        status: "rejected",
        rejectionReason: reason || null,
      });

      // Send rejection email
      await sendEmail({
        to: application.email,
        subject: "Application Update - Political Intelligence Platform",
        html: `
          <h2>Application Update</h2>
          <p>Hi ${application.contactName},</p>
          <p>Thank you for your interest in the Political Intelligence Platform.</p>
          <p>After reviewing your application for <strong>${application.companyName}</strong>, we are unable to approve it at this time.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>If you believe this is an error or would like more information, please contact our support team.</p>
          <p>Best regards,<br>The Political Intelligence Team</p>
        `,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting application:", error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  // Admin: Delete application
  app.delete("/api/admin/applications/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const application = await storage.getClientApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      await storage.deleteClientApplication(application.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
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

  // ============ Knowledge Base Routes ============

  // Admin KB Categories (owner scope)
  app.get("/api/admin/kb/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const categories = await storage.getKbCategories("owner");
      res.json(categories);
    } catch (error) {
      console.error("Error getting KB categories:", error);
      res.status(500).json({ message: "Failed to get categories" });
    }
  });

  app.post("/api/admin/kb/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const parsed = insertKbCategorySchema.safeParse({ ...req.body, scope: "owner" });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const category = await storage.createKbCategory(parsed.data);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating KB category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch("/api/admin/kb/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const category = await storage.updateKbCategory(req.params.id, req.body);
      if (!category) return res.status(404).json({ message: "Category not found" });
      res.json(category);
    } catch (error) {
      console.error("Error updating KB category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/kb/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      await storage.deleteKbCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting KB category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Admin KB Articles (owner scope)
  app.get("/api/admin/kb/articles", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const articles = await storage.getKbArticles("owner");
      res.json(articles);
    } catch (error) {
      console.error("Error getting KB articles:", error);
      res.status(500).json({ message: "Failed to get articles" });
    }
  });

  app.post("/api/admin/kb/articles", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const parsed = insertKbArticleSchema.safeParse({ ...req.body, scope: "owner" });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const article = await storage.createKbArticle(parsed.data);
      res.status(201).json(article);
    } catch (error) {
      console.error("Error creating KB article:", error);
      res.status(500).json({ message: "Failed to create article" });
    }
  });

  app.get("/api/admin/kb/articles/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const article = await storage.getKbArticle(req.params.id);
      if (!article) return res.status(404).json({ message: "Article not found" });
      res.json(article);
    } catch (error) {
      console.error("Error getting KB article:", error);
      res.status(500).json({ message: "Failed to get article" });
    }
  });

  app.patch("/api/admin/kb/articles/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const article = await storage.updateKbArticle(req.params.id, req.body);
      if (!article) return res.status(404).json({ message: "Article not found" });
      res.json(article);
    } catch (error) {
      console.error("Error updating KB article:", error);
      res.status(500).json({ message: "Failed to update article" });
    }
  });

  app.delete("/api/admin/kb/articles/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      await storage.deleteKbArticle(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting KB article:", error);
      res.status(500).json({ message: "Failed to delete article" });
    }
  });

  // Client KB Categories (client scope)
  app.get("/api/kb/categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getKbCategories("client");
      res.json(categories);
    } catch (error) {
      console.error("Error getting KB categories:", error);
      res.status(500).json({ message: "Failed to get categories" });
    }
  });

  // Client KB Articles (client scope)
  app.get("/api/kb/articles", isAuthenticated, async (req, res) => {
    try {
      const articles = await storage.getKbArticles("client");
      // Only return published articles for clients
      const published = articles.filter(a => a.isPublished);
      res.json(published);
    } catch (error) {
      console.error("Error getting KB articles:", error);
      res.status(500).json({ message: "Failed to get articles" });
    }
  });

  app.get("/api/kb/articles/:slug", isAuthenticated, async (req, res) => {
    try {
      const article = await storage.getKbArticleBySlug(req.params.slug, "client");
      if (!article || !article.isPublished) {
        return res.status(404).json({ message: "Article not found" });
      }
      res.json(article);
    } catch (error) {
      console.error("Error getting KB article:", error);
      res.status(500).json({ message: "Failed to get article" });
    }
  });

  app.get("/api/kb/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json([]);
      }
      const articles = await storage.searchKbArticles("client", query);
      res.json(articles);
    } catch (error) {
      console.error("Error searching KB:", error);
      res.status(500).json({ message: "Failed to search" });
    }
  });

  // KB Tooltips
  app.get("/api/kb/tooltips", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      const scope = superAdmin ? "owner" : "client";
      const tooltips = await storage.getKbTooltips(scope);
      res.json(tooltips);
    } catch (error) {
      console.error("Error getting tooltips:", error);
      res.status(500).json({ message: "Failed to get tooltips" });
    }
  });

  // Admin KB Tooltips management
  app.post("/api/admin/kb/tooltips", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const parsed = insertKbTooltipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const tooltip = await storage.createKbTooltip(parsed.data);
      res.status(201).json(tooltip);
    } catch (error) {
      console.error("Error creating tooltip:", error);
      res.status(500).json({ message: "Failed to create tooltip" });
    }
  });

  // ============ Security Status Routes ============

  // Admin security status (platform-wide)
  app.get("/api/admin/security", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      let status = await storage.getSecurityStatus("owner");
      if (!status) {
        // Create default security status
        status = await storage.createSecurityStatus({
          scope: "owner",
          level: "standard",
          notes: "Platform security status",
        });
      }
      const controls = await storage.getSecurityControls("owner");
      res.json({ status, controls });
    } catch (error) {
      console.error("Error getting security status:", error);
      res.status(500).json({ message: "Failed to get security status" });
    }
  });

  app.patch("/api/admin/security/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const status = await storage.updateSecurityStatus(req.params.id, req.body);
      if (!status) return res.status(404).json({ message: "Status not found" });
      res.json(status);
    } catch (error) {
      console.error("Error updating security status:", error);
      res.status(500).json({ message: "Failed to update security status" });
    }
  });

  app.post("/api/admin/security/controls", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const parsed = insertSecurityControlSchema.safeParse({ ...req.body, scope: "owner" });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const control = await storage.createSecurityControl(parsed.data);
      res.status(201).json(control);
    } catch (error) {
      console.error("Error creating security control:", error);
      res.status(500).json({ message: "Failed to create control" });
    }
  });

  app.patch("/api/admin/security/controls/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      const control = await storage.updateSecurityControl(req.params.id, req.body);
      if (!control) return res.status(404).json({ message: "Control not found" });
      res.json(control);
    } catch (error) {
      console.error("Error updating security control:", error);
      res.status(500).json({ message: "Failed to update control" });
    }
  });

  app.delete("/api/admin/security/controls/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Admin access required" });

      await storage.deleteSecurityControl(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting security control:", error);
      res.status(500).json({ message: "Failed to delete control" });
    }
  });

  // Client security status
  app.get("/api/security", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      let status = await storage.getSecurityStatus("client", clientId);
      if (!status) {
        status = await storage.createSecurityStatus({
          scope: "client",
          clientId,
          level: "standard",
          notes: "Client security status",
        });
      }
      const controls = await storage.getSecurityControls("client", clientId);
      res.json({ status, controls });
    } catch (error) {
      console.error("Error getting security status:", error);
      res.status(500).json({ message: "Failed to get security status" });
    }
  });

  // ============ Client Info Route ============
  
  // Get current client info (for portal URL generation)
  app.get("/api/client/info", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      res.json({ client });
    } catch (error) {
      console.error("Error getting client info:", error);
      res.status(500).json({ message: "Failed to get client info" });
    }
  });

  // ============ Client Portal Routes ============

  // List portals for client
  app.get("/api/portals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portals = await storage.getClientPortals(clientId);
      res.json(portals);
    } catch (error) {
      console.error("Error getting portals:", error);
      res.status(500).json({ message: "Failed to get portals" });
    }
  });

  app.post("/api/portals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const parsed = insertClientPortalSchema.safeParse({ ...req.body, clientId });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }

      // Check slug uniqueness within client
      const existing = await storage.getClientPortalBySlug(clientId, parsed.data.slug);
      if (existing) {
        return res.status(400).json({ message: "A portal with this URL slug already exists" });
      }

      const portal = await storage.createClientPortal(parsed.data);
      res.status(201).json(portal);
    } catch (error) {
      console.error("Error creating portal:", error);
      res.status(500).json({ message: "Failed to create portal" });
    }
  });

  app.get("/api/portals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.clientId !== clientId) {
        return res.status(404).json({ message: "Portal not found" });
      }
      res.json(portal);
    } catch (error) {
      console.error("Error getting portal:", error);
      res.status(500).json({ message: "Failed to get portal" });
    }
  });

  app.patch("/api/portals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.clientId !== clientId) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const updated = await storage.updateClientPortal(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating portal:", error);
      res.status(500).json({ message: "Failed to update portal" });
    }
  });

  app.delete("/api/portals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.clientId !== clientId) {
        return res.status(404).json({ message: "Portal not found" });
      }

      await storage.deleteClientPortal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting portal:", error);
      res.status(500).json({ message: "Failed to delete portal" });
    }
  });

  // Portal matter access
  app.get("/api/portals/:id/matters", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.clientId !== clientId) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const access = await storage.getPortalMatterAccess(req.params.id);
      const matterIds = access.map(a => a.matterId);
      const allMatters = await storage.getMatters(clientId);
      const sharedMatters = allMatters.filter(m => matterIds.includes(m.id));
      res.json(sharedMatters);
    } catch (error) {
      console.error("Error getting portal matters:", error);
      res.status(500).json({ message: "Failed to get portal matters" });
    }
  });

  app.post("/api/portals/:id/matters", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.clientId !== clientId) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const { matterId } = req.body;
      const matter = await storage.getMatter(matterId);
      if (!matter || matter.clientId !== clientId) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const access = await storage.createPortalMatterAccess({
        portalId: req.params.id,
        matterId,
      });
      res.status(201).json(access);
    } catch (error) {
      console.error("Error adding portal matter:", error);
      res.status(500).json({ message: "Failed to add matter to portal" });
    }
  });

  app.delete("/api/portals/:portalId/matters/:matterId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientId = await getClientId(req, userId);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const portal = await storage.getClientPortal(req.params.portalId);
      if (!portal || portal.clientId !== clientId) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const access = await storage.getPortalMatterAccess(req.params.portalId);
      const toDelete = access.find(a => a.matterId === req.params.matterId);
      if (toDelete) {
        await storage.deletePortalMatterAccess(toDelete.id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing portal matter:", error);
      res.status(500).json({ message: "Failed to remove matter from portal" });
    }
  });

  // ============ Public Portal Routes (no auth) ============

  app.get("/api/public/portal/:clientSlug/:portalSlug", async (req, res) => {
    try {
      const { clientSlug, portalSlug } = req.params;
      
      const client = await storage.getClientBySlug(clientSlug);
      if (!client || !client.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const portal = await storage.getClientPortalBySlug(client.id, portalSlug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      res.json({
        id: portal.id,
        name: portal.name,
        description: portal.description,
        clientName: client.name,
        clientLogo: client.logoUrl,
        clientAddress: client.address,
        clientPhone: client.phone,
      });
    } catch (error) {
      console.error("Error getting public portal:", error);
      res.status(500).json({ message: "Failed to get portal" });
    }
  });

  app.get("/api/public/portal/:clientSlug/:portalSlug/matters", async (req, res) => {
    try {
      const { clientSlug, portalSlug } = req.params;
      
      const client = await storage.getClientBySlug(clientSlug);
      if (!client || !client.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const portal = await storage.getClientPortalBySlug(client.id, portalSlug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const access = await storage.getPortalMatterAccess(portal.id);
      const matterIds = access.map(a => a.matterId);
      const allMatters = await storage.getMatters(client.id);
      const sharedMatters = allMatters.filter(m => matterIds.includes(m.id));
      
      // Return minimal info for public view
      res.json(sharedMatters.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        status: m.status,
      })));
    } catch (error) {
      console.error("Error getting public portal matters:", error);
      res.status(500).json({ message: "Failed to get matters" });
    }
  });

  app.get("/api/public/portal/:clientSlug/:portalSlug/matters/:matterId/documents", async (req, res) => {
    try {
      const { clientSlug, portalSlug, matterId } = req.params;
      
      const client = await storage.getClientBySlug(clientSlug);
      if (!client || !client.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const portal = await storage.getClientPortalBySlug(client.id, portalSlug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      // Verify matter is shared with this portal
      const access = await storage.getPortalMatterAccess(portal.id);
      const hasAccess = access.some(a => a.matterId === matterId);
      if (!hasAccess) {
        return res.status(404).json({ message: "Matter not found" });
      }

      const documents = await storage.getResearchDocuments(matterId);
      
      // Return minimal info for public view (no extracted content)
      res.json(documents.map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        summary: d.summary,
        createdAt: d.createdAt,
      })));
    } catch (error) {
      console.error("Error getting public portal documents:", error);
      res.status(500).json({ message: "Failed to get documents" });
    }
  });

  // Email routes
  const sendEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
  });

  app.post("/api/email/send", isAuthenticated, async (req, res) => {
    try {
      const validation = sendEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const result = await sendEmail(validation.data);
      if (result.success) {
        res.json({ success: true, message: "Email sent successfully" });
      } else {
        res.status(500).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  const sendBriefSchema = z.object({
    to: z.string().email(),
    clientName: z.string(),
    matterName: z.string(),
    briefContent: z.string(),
    portalUrl: z.string().optional(),
  });

  app.post("/api/email/daily-brief", isAuthenticated, async (req, res) => {
    try {
      const validation = sendBriefSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const result = await sendDailyBrief(validation.data);
      if (result.success) {
        res.json({ success: true, message: "Daily brief sent successfully" });
      } else {
        res.status(500).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error sending daily brief:", error);
      res.status(500).json({ message: "Failed to send daily brief" });
    }
  });

  const sendUpdateSchema = z.object({
    to: z.string().email(),
    clientName: z.string(),
    matterName: z.string(),
    updateType: z.enum(["new_document", "ai_analysis", "question_answered"]),
    summary: z.string(),
    portalUrl: z.string().optional(),
  });

  app.post("/api/email/research-update", isAuthenticated, async (req, res) => {
    try {
      const validation = sendUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const result = await sendResearchUpdate(validation.data);
      if (result.success) {
        res.json({ success: true, message: "Research update sent successfully" });
      } else {
        res.status(500).json({ success: false, message: result.error });
      }
    } catch (error) {
      console.error("Error sending research update:", error);
      res.status(500).json({ message: "Failed to send research update" });
    }
  });

  // Open-ended research routes (no matter required)
  app.post("/api/research/extract-url", isAuthenticated, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const { ResearchAgent } = await import("./services/research-agent");
      const agent = new ResearchAgent();
      
      const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
      let result;
      
      if (isYouTube) {
        result = await agent.extractYouTubeTranscript(url);
      } else {
        result = await agent.extractUrlContent(url);
      }
      
      res.json({
        title: result.title,
        content: result.content,
        summary: result.summary,
        type: isYouTube ? "youtube" : "url",
      });
    } catch (error) {
      console.error("Error extracting URL:", error);
      res.status(500).json({ message: "Failed to extract content from URL" });
    }
  });

  app.post("/api/research/entity", isAuthenticated, async (req, res) => {
    try {
      const validation = entityResearchSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { entityName, entityType } = validation.data;
      const { ResearchAgent } = await import("./services/research-agent");
      const agent = new ResearchAgent();
      
      const result = await agent.researchEntity(entityName, entityType);
      
      res.json({
        title: `Research: ${entityName}`,
        content: result.content,
        summary: result.summary,
        type: "entity",
      });
    } catch (error) {
      console.error("Error researching entity:", error);
      res.status(500).json({ message: "Failed to research entity" });
    }
  });

  app.post("/api/research/query", isAuthenticated, async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Query is required" });
      }

      const { ResearchAgent } = await import("./services/research-agent");
      const agent = new ResearchAgent();
      
      const result = await agent.runAgentQuery(prompt);
      
      res.json({
        title: prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""),
        content: result.content,
        summary: result.summary,
        type: "query",
      });
    } catch (error) {
      console.error("Error running query:", error);
      res.status(500).json({ message: "Failed to run research query" });
    }
  });

  app.post("/api/research/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, context, history } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!openaiApiKey) {
        return res.status(500).json({ message: "OpenAI not configured" });
      }

      const messages = [
        {
          role: "system",
          content: `You are a political intelligence research assistant. You help analyze political news, track career movements of government officials and staffers, and provide insights on lobbying activities and policy developments. Be concise but thorough.

${context ? `Context from recent research:\n${context}` : "No research context available yet."}`
        },
        ...(history || []).map((h: any) => ({
          role: h.role,
          content: h.content,
        })),
        { role: "user", content: message }
      ];

      // Use the OpenAI SDK approach for better compatibility
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: openaiBaseUrl,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 1000,
      });

      const reply = completion.choices?.[0]?.message?.content || "I couldn't generate a response.";
      
      res.json({ response: reply });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // ============ YouTube Watch List Routes ============
  
  // Get transcript sources (quick links)
  app.get("/api/transcript-sources", isAuthenticated, async (req, res) => {
    res.json(TRANSCRIPT_SOURCES);
  });

  // Get YouTube watch list
  app.get("/api/youtube-watchlist", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientUser = await storage.getClientUserByUserId(userId);
      if (!clientUser) return res.status(403).json({ message: "Not assigned to a client" });

      const watchList = await storage.getYoutubeWatchList(clientUser.clientId);
      res.json(watchList);
    } catch (error) {
      console.error("Error getting watch list:", error);
      res.status(500).json({ message: "Failed to get watch list" });
    }
  });

  // Add video to watch list
  app.post("/api/youtube-watchlist", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientUser = await storage.getClientUserByUserId(userId);
      if (!clientUser) return res.status(403).json({ message: "Not assigned to a client" });

      const { videoUrl, title, channelName, matterId } = req.body;
      
      const videoId = extractVideoId(videoUrl);
      if (!videoId) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Check if transcript is already available
      const hasTranscript = await checkTranscriptAvailable(videoId);
      
      const item = await storage.createYoutubeWatchListItem({
        clientId: clientUser.clientId,
        videoUrl,
        videoId,
        title,
        channelName,
        matterId,
        status: hasTranscript ? "completed" : "pending",
        transcriptAvailable: hasTranscript,
      });

      // If transcript is available, fetch it
      if (hasTranscript) {
        const transcript = await getTranscript(videoId);
        res.json({ ...item, transcript });
      } else {
        res.json(item);
      }
    } catch (error) {
      console.error("Error adding to watch list:", error);
      res.status(500).json({ message: "Failed to add to watch list" });
    }
  });

  // Check pending items in watch list
  app.post("/api/youtube-watchlist/check", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientUser = await storage.getClientUserByUserId(userId);
      if (!clientUser) return res.status(403).json({ message: "Not assigned to a client" });

      const result = await checkPendingWatchList(clientUser.clientId);
      res.json(result);
    } catch (error) {
      console.error("Error checking watch list:", error);
      res.status(500).json({ message: "Failed to check watch list" });
    }
  });

  // Delete from watch list
  app.delete("/api/youtube-watchlist/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteYoutubeWatchListItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting from watch list:", error);
      res.status(500).json({ message: "Failed to delete from watch list" });
    }
  });

  // ============ Congress Bills Routes ============
  
  // Search bills
  app.get("/api/bills/search", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const congress = parseInt(req.query.congress as string) || 119;
      const billType = req.query.billType as string;
      const keyword = req.query.keyword as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const api = new CongressAPI(apiKey);
      
      if (keyword) {
        const bills = await api.searchByKeyword(keyword, congress, limit);
        res.json({ bills });
      } else {
        const result = await api.searchBills({ congress, billType, limit, offset });
        res.json(result);
      }
    } catch (error) {
      console.error("Error searching bills:", error);
      res.status(500).json({ message: "Failed to search bills" });
    }
  });

  // Get bill details
  app.get("/api/bills/:congress/:billType/:billNumber", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const { congress, billType, billNumber } = req.params;
      const api = new CongressAPI(apiKey);
      
      const details = await api.getBillDetails(
        parseInt(congress),
        billType,
        parseInt(billNumber)
      );
      res.json(details);
    } catch (error) {
      console.error("Error getting bill details:", error);
      res.status(500).json({ message: "Failed to get bill details" });
    }
  });

  // Get bill actions
  app.get("/api/bills/:congress/:billType/:billNumber/actions", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const { congress, billType, billNumber } = req.params;
      const api = new CongressAPI(apiKey);
      
      const actions = await api.getBillActions(
        parseInt(congress),
        billType,
        parseInt(billNumber)
      );
      res.json(actions);
    } catch (error) {
      console.error("Error getting bill actions:", error);
      res.status(500).json({ message: "Failed to get bill actions" });
    }
  });

  // Get tracked bills
  app.get("/api/tracked-bills", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientUser = await storage.getClientUserByUserId(userId);
      if (!clientUser) return res.status(403).json({ message: "Not assigned to a client" });

      const bills = await storage.getTrackedBills(clientUser.clientId);
      res.json(bills);
    } catch (error) {
      console.error("Error getting tracked bills:", error);
      res.status(500).json({ message: "Failed to get tracked bills" });
    }
  });

  // Track a bill
  app.post("/api/tracked-bills", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const clientUser = await storage.getClientUserByUserId(userId);
      if (!clientUser) return res.status(403).json({ message: "Not assigned to a client" });

      const billData = insertTrackedBillSchema.parse({
        ...req.body,
        clientId: clientUser.clientId,
      });

      // Check if already tracked
      const existing = await storage.getTrackedBillByNumber(
        clientUser.clientId,
        billData.congress,
        billData.billType,
        billData.billNumber
      );

      if (existing) {
        return res.status(400).json({ message: "Bill already tracked" });
      }

      const bill = await storage.createTrackedBill(billData);
      res.json(bill);
    } catch (error) {
      console.error("Error tracking bill:", error);
      res.status(500).json({ message: "Failed to track bill" });
    }
  });

  // Update tracked bill
  app.patch("/api/tracked-bills/:id", isAuthenticated, async (req, res) => {
    try {
      const bill = await storage.updateTrackedBill(req.params.id, req.body);
      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      console.error("Error updating tracked bill:", error);
      res.status(500).json({ message: "Failed to update tracked bill" });
    }
  });

  // Sync tracked bill with Congress.gov and detect changes
  app.post("/api/tracked-bills/:id/sync", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const bill = await storage.getTrackedBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }

      const api = new CongressAPI(apiKey);
      const details = await api.getBillDetails(bill.congress, bill.billType, bill.billNumber);
      
      let changed = false;
      const changes: Array<{ type: string; prev: string | null; next: string | null; desc: string }> = [];

      // Detect action changes
      if (bill.latestAction !== details.bill.latestAction?.text) {
        changes.push({
          type: "action_update",
          prev: bill.latestAction,
          next: details.bill.latestAction?.text || null,
          desc: `New action: ${details.bill.latestAction?.text || 'Unknown'}`,
        });
        changed = true;
      }

      // Record detected changes
      for (const change of changes) {
        await storage.createBillChange({
          trackedBillId: bill.id,
          changeType: change.type,
          previousValue: change.prev,
          newValue: change.next,
          description: change.desc,
        });
      }

      const updated = await storage.updateTrackedBill(bill.id, {
        title: details.bill.title,
        latestAction: details.bill.latestAction?.text,
        latestActionDate: details.bill.latestAction?.actionDate,
        lastSyncedAt: new Date(),
      });

      res.json({ ...updated, changed, changesDetected: changes.length });
    } catch (error) {
      console.error("Error syncing tracked bill:", error);
      res.status(500).json({ message: "Failed to sync bill" });
    }
  });

  // Delete tracked bill
  app.delete("/api/tracked-bills/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTrackedBill(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tracked bill:", error);
      res.status(500).json({ message: "Failed to delete tracked bill" });
    }
  });

  // Get unread bill changes
  app.get("/api/tracked-bills/changes/unread", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const clientUser = await storage.getClientUserByUserId(userId!);
      if (!clientUser) {
        return res.json([]);
      }
      const changes = await storage.getUnreadBillChanges(clientUser.clientId);
      res.json(changes);
    } catch (error) {
      console.error("Error getting unread bill changes:", error);
      res.status(500).json({ message: "Failed to get unread bill changes" });
    }
  });

  // Get change history for a specific bill
  app.get("/api/tracked-bills/:id/changes", isAuthenticated, async (req, res) => {
    try {
      const changes = await storage.getBillChangeHistory(req.params.id);
      res.json(changes);
    } catch (error) {
      console.error("Error getting bill change history:", error);
      res.status(500).json({ message: "Failed to get bill change history" });
    }
  });

  // Mark bill change as read
  app.post("/api/tracked-bills/changes/:changeId/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markBillChangeAsRead(req.params.changeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking change as read:", error);
      res.status(500).json({ message: "Failed to mark change as read" });
    }
  });

  // Get/update alert settings for a bill
  app.get("/api/tracked-bills/:id/alerts", isAuthenticated, async (req, res) => {
    try {
      const alert = await storage.getBillTrackingAlert(req.params.id);
      res.json(alert || { 
        alertOnStatusChange: true, 
        alertOnNewAction: true, 
        alertOnAmendment: true, 
        alertOnCosponsorChange: false,
        emailNotification: true 
      });
    } catch (error) {
      console.error("Error getting bill alerts:", error);
      res.status(500).json({ message: "Failed to get bill alerts" });
    }
  });

  app.patch("/api/tracked-bills/:id/alerts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const clientUser = await storage.getClientUserByUserId(userId!);
      if (!clientUser) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getBillTrackingAlert(req.params.id);
      if (existing) {
        const updated = await storage.updateBillTrackingAlert(existing.id, req.body);
        res.json(updated);
      } else {
        const newAlert = await storage.createBillTrackingAlert({
          trackedBillId: req.params.id,
          clientId: clientUser.clientId,
          ...req.body,
        });
        res.json(newAlert);
      }
    } catch (error) {
      console.error("Error updating bill alerts:", error);
      res.status(500).json({ message: "Failed to update bill alerts" });
    }
  });

  return httpServer;
}
