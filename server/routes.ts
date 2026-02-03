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
import { kalshiApi } from "./services/kalshi-api";
import { syncAccountPosts, syncAllClientAccounts } from "./services/social-tracker";
import { z } from "zod";
import { sendEmail, sendDailyBrief, sendResearchUpdate, sendPasswordResetEmail } from "./services/email-service";

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

  // Password reset request
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Always return success to prevent email enumeration
      const successMessage = "If an account with that email exists, we've sent a password reset link.";
      
      const user = await authStorage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.json({ message: successMessage });
      }

      // Generate reset token (64 bytes = 128 hex chars)
      const token = randomBytes(64).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await authStorage.createPasswordResetToken(user.id, token, expiresAt);

      // Build reset URL - prefer APP_URL for production, fall back to dev domain
      const baseUrl = process.env.APP_URL 
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
        || (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null)
        || "http://localhost:5000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      await sendPasswordResetEmail({
        to: user.email!,
        firstName: user.firstName || "there",
        resetUrl,
      });

      res.json({ message: successMessage });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const resetToken = await authStorage.getValidPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      // Hash the new password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Update user password
      await authStorage.setUserPassword(resetToken.userId, passwordHash);
      
      // Mark token as used
      await authStorage.markTokenAsUsed(resetToken.id);

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
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
    console.log("Chat request received for conversation:", req.params.convId);
    try {
      const clientId = await getClientId(req);
      console.log("Client ID for chat:", clientId);
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
    } catch (error: any) {
      console.error("Error in chat:", error?.message || error);
      console.error("Error stack:", error?.stack);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error?.message || "Chat failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: error?.message || "Failed to process chat" });
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

  // Portal AI Chat - Get conversations for a portal
  app.get("/api/public/portal/:clientSlug/:portalSlug/conversations", async (req, res) => {
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

      const conversations = await storage.getPortalConversations(portal.id);
      res.json(conversations);
    } catch (error) {
      console.error("Error getting portal conversations:", error);
      res.status(500).json({ message: "Failed to get conversations" });
    }
  });

  // Portal AI Chat - Create new conversation
  app.post("/api/public/portal/:clientSlug/:portalSlug/conversations", async (req, res) => {
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

      const conversation = await storage.createPortalConversation({
        portalId: portal.id,
        title: req.body.title || "New Conversation",
      });
      res.json(conversation);
    } catch (error) {
      console.error("Error creating portal conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Portal AI Chat - Get messages for a conversation
  app.get("/api/public/portal/:clientSlug/:portalSlug/conversations/:convId/messages", async (req, res) => {
    try {
      const { clientSlug, portalSlug, convId } = req.params;
      
      const client = await storage.getClientBySlug(clientSlug);
      if (!client || !client.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const portal = await storage.getClientPortalBySlug(client.id, portalSlug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const conversation = await storage.getPortalConversation(convId);
      if (!conversation || conversation.portalId !== portal.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await storage.getPortalMessages(convId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting portal messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Portal AI Chat - Send message and get AI response (streaming)
  app.post("/api/public/portal/:clientSlug/:portalSlug/conversations/:convId/chat", async (req, res) => {
    try {
      const { clientSlug, portalSlug, convId } = req.params;
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      const client = await storage.getClientBySlug(clientSlug);
      if (!client || !client.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const portal = await storage.getClientPortalBySlug(client.id, portalSlug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ message: "Portal not found" });
      }

      const conversation = await storage.getPortalConversation(convId);
      if (!conversation || conversation.portalId !== portal.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Save user message
      await storage.createPortalMessage({
        conversationId: convId,
        role: "user",
        content: message,
      });

      // Get documents from all matters shared with this portal
      const portalAccess = await storage.getPortalMatterAccess(portal.id);
      const matterIds = portalAccess.map(a => a.matterId);
      
      let allDocuments: any[] = [];
      for (const matterId of matterIds) {
        const docs = await storage.getResearchDocuments(matterId);
        allDocuments = allDocuments.concat(docs);
      }

      // Get previous messages for context
      const existingMessages = await storage.getPortalMessages(convId);
      const conversationHistory = existingMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Build document context
      const documentContext = allDocuments
        .map((doc, i) => `[Document ${i + 1}: ${doc.title}]\n${doc.content?.slice(0, 5000) || doc.summary || ''}`)
        .join("\n\n---\n\n");

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const { chatWithPortalContext } = await import("./services/research-agent");
      
      let fullResponse = "";
      for await (const chunk of chatWithPortalContext(
        message,
        documentContext,
        conversationHistory,
        portal.name
      )) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Save assistant response
      await storage.createPortalMessage({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
      });

      // Update conversation title if first message
      if (existingMessages.length === 0) {
        const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
        await storage.updatePortalConversation(convId, { title });
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in portal AI chat:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to process chat" });
      } else {
        res.write(`data: ${JSON.stringify({ error: "Chat processing failed" })}\n\n`);
        res.end();
      }
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

      const { extractContentFromUrl, extractYouTubeContent, generateSummary } = await import("./services/research-agent");
      
      const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
      let result;
      
      if (isYouTube) {
        result = await extractYouTubeContent(url);
      } else {
        result = await extractContentFromUrl(url);
      }
      
      const summary = result.content ? await generateSummary(result.content) : undefined;
      
      res.json({
        title: result.title,
        content: result.content,
        summary: summary,
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
      const { researchPoliticalEntity } = await import("./services/research-agent");
      
      const result = await researchPoliticalEntity(entityName, entityType);
      
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

      const { runAgentQuery } = await import("./services/research-agent");
      
      const result = await runAgentQuery(prompt);
      
      res.json({
        title: prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""),
        content: JSON.stringify(result.data, null, 2),
        summary: `AI research query completed with ${result.sources?.length || 0} sources`,
        type: "query",
      });
    } catch (error) {
      console.error("Error running query:", error);
      res.status(500).json({ message: "Failed to run research query" });
    }
  });

  app.post("/api/research/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, context, history, provider } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const systemPrompt = `You are a political intelligence research assistant. You help analyze political news, track career movements of government officials and staffers, and provide insights on lobbying activities and policy developments.

IMPORTANT INSTRUCTIONS:
1. Always provide sources when citing facts, legislation, or specific information
2. Format sources as [Source: description] at the end of your response
3. Be concise but thorough
4. When you don't have specific sources, indicate that the information is based on general knowledge

${context ? `Context from recent research:\n${context}` : "No research context available yet."}`;

      let reply = "";
      let usedProvider = "unknown";

      // Try providers in order of preference: specified provider, then fallbacks
      const providers = provider ? [provider, "openai", "gemini", "anthropic"] : ["openai", "gemini", "anthropic"];
      const uniqueProviders = [...new Set(providers)];

      for (const currentProvider of uniqueProviders) {
        try {
          if (currentProvider === "openai") {
            const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
            const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
            
            if (!openaiApiKey) continue;

            const messages = [
              { role: "system" as const, content: systemPrompt },
              ...(history || []).map((h: any) => ({
                role: h.role as "user" | "assistant",
                content: h.content,
              })),
              { role: "user" as const, content: message }
            ];

            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({
              apiKey: openaiApiKey,
              baseURL: openaiBaseUrl,
            });

            const completion = await openai.chat.completions.create({
              model: "gpt-4.1",
              messages,
              max_completion_tokens: 1500,
            });

            reply = completion.choices?.[0]?.message?.content || "";
            if (reply) {
              usedProvider = "OpenAI GPT-4.1";
              break;
            }
          } else if (currentProvider === "gemini") {
            const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
            const geminiBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
            
            if (!geminiApiKey) continue;

            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({
              apiKey: geminiApiKey,
              httpOptions: {
                apiVersion: "",
                baseUrl: geminiBaseUrl,
              },
            });

            const chatHistory = (history || []).map((h: any) => ({
              role: h.role === "assistant" ? "model" : "user",
              parts: [{ text: h.content }],
            }));

            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                { role: "user", parts: [{ text: systemPrompt }] },
                ...chatHistory,
                { role: "user", parts: [{ text: message }] },
              ],
            });

            reply = response.text || "";
            if (reply) {
              usedProvider = "Google Gemini 2.5 Flash";
              break;
            }
          } else if (currentProvider === "anthropic") {
            const anthropicApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
            const anthropicBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
            
            if (!anthropicApiKey) continue;

            const Anthropic = (await import("@anthropic-ai/sdk")).default;
            const anthropic = new Anthropic({
              apiKey: anthropicApiKey,
              baseURL: anthropicBaseUrl,
            });

            const anthropicMessages = (history || []).map((h: any) => ({
              role: h.role as "user" | "assistant",
              content: h.content,
            }));
            anthropicMessages.push({ role: "user", content: message });

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 1500,
              system: systemPrompt,
              messages: anthropicMessages,
            });

            const textBlock = response.content.find((block: any) => block.type === "text");
            reply = textBlock ? (textBlock as any).text : "";
            if (reply) {
              usedProvider = "Anthropic Claude Sonnet 4.5";
              break;
            }
          }
        } catch (providerError) {
          console.error(`Error with ${currentProvider}:`, providerError);
          continue;
        }
      }

      if (!reply) {
        return res.status(500).json({ message: "I couldn't generate a response. Please try again." });
      }
      
      // Add source attribution
      const responseWithSource = `${reply}\n\n---\n*Powered by ${usedProvider}*`;
      
      res.json({ response: responseWithSource, provider: usedProvider });
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
      const keyword = (req.query.keyword || req.query.q) as string; // Support both q and keyword
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
      // Use getClientId to support admin impersonation
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const bills = await storage.getTrackedBills(clientId);
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

      // Use getClientId to support admin impersonation
      const clientId = await getClientId(req);
      if (!clientId) {
        // Check if this is a super admin who isn't impersonating
        const superAdmin = await storage.getSuperAdminByUserId(userId);
        if (superAdmin) {
          return res.status(403).json({ message: "Please impersonate a client first to track bills. Go to Admin > Clients and click 'Impersonate' on a client." });
        }
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      // Normalize bill type from display format ("H.R.", "S.") to API format ("hr", "s")
      let billType = req.body.billType || '';
      const typeNormalization: { [key: string]: string } = {
        'H.R.': 'hr', 'HR': 'hr', 'hr': 'hr',
        'S.': 's', 'S': 's', 's': 's',
        'H.J.RES.': 'hjres', 'HJRES': 'hjres', 'hjres': 'hjres',
        'S.J.RES.': 'sjres', 'SJRES': 'sjres', 'sjres': 'sjres',
        'H.CON.RES.': 'hconres', 'HCONRES': 'hconres', 'hconres': 'hconres',
        'S.CON.RES.': 'sconres', 'SCONRES': 'sconres', 'sconres': 'sconres',
        'H.RES.': 'hres', 'HRES': 'hres', 'hres': 'hres',
        'S.RES.': 'sres', 'SRES': 'sres', 'sres': 'sres',
      };
      const normalizedType = typeNormalization[billType] || billType.toLowerCase().replace(/\./g, '');

      // Ensure billNumber is an integer (API may return string)
      const billNumber = typeof req.body.billNumber === 'string' 
        ? parseInt(req.body.billNumber, 10) 
        : req.body.billNumber;

      // Validate billNumber is a valid number
      if (isNaN(billNumber) || billNumber === undefined || billNumber === null) {
        return res.status(400).json({ message: "Invalid bill number provided" });
      }

      const billData = insertTrackedBillSchema.parse({
        ...req.body,
        billType: normalizedType,
        billNumber,
        clientId,
      });

      // Check if already tracked
      const existing = await storage.getTrackedBillByNumber(
        clientId,
        billData.congress,
        billData.billType,
        billData.billNumber
      );

      if (existing) {
        return res.status(400).json({ message: "Bill already tracked" });
      }

      const bill = await storage.createTrackedBill(billData);
      res.json(bill);
    } catch (error: any) {
      console.error("Error tracking bill:", error);
      console.error("Request body:", req.body);
      console.error("Error details:", error?.message, error?.stack);
      res.status(500).json({ message: "Failed to track bill", error: error?.message });
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

  // ========== Members of Congress Search ==========
  
  // Get all current members of Congress with filtering
  app.get("/api/congress/members", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const { chamber, party, state, search } = req.query;
      const api = new CongressAPI(apiKey);
      
      const members = await api.searchMembers(
        (search as string) || '',
        {
          chamber: chamber as 'house' | 'senate' | undefined,
          party: party as 'D' | 'R' | 'I' | undefined,
          state: state as string | undefined,
        }
      );

      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  // Get member details by bioguide ID
  app.get("/api/congress/members/:bioguideId", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const api = new CongressAPI(apiKey);
      const member = await api.getMemberDetails(req.params.bioguideId);

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      res.json(member);
    } catch (error) {
      console.error("Error fetching member details:", error);
      res.status(500).json({ message: "Failed to fetch member details" });
    }
  });

  // Get member sponsored bills
  app.get("/api/congress/members/:bioguideId/bills", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const api = new CongressAPI(apiKey);
      const bills = await api.getMemberBills(req.params.bioguideId, 20);
      res.json(bills);
    } catch (error) {
      console.error("Error fetching member bills:", error);
      res.status(500).json({ message: "Failed to fetch member bills" });
    }
  });

  // ========== Favorite Congress Members ==========

  // Get all favorites for client
  app.get("/api/congress/favorites", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const favorites = await storage.getFavoriteCongressMembers(clientId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorite members:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Check if a member is a favorite
  app.get("/api/congress/favorites/:bioguideId/check", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const isFavorite = await storage.isFavoriteCongressMember(clientId, req.params.bioguideId);
      const favorite = isFavorite ? await storage.getFavoriteByBioguideId(clientId, req.params.bioguideId) : null;
      res.json({ isFavorite, favorite });
    } catch (error) {
      console.error("Error checking favorite status:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // Add member to favorites
  app.post("/api/congress/favorites", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const { bioguideId, name, party, state, chamber, imageUrl, matterId, notes } = req.body;
      
      // Check if already favorited
      const existing = await storage.getFavoriteByBioguideId(clientId, bioguideId);
      if (existing) {
        return res.status(400).json({ message: "Member already in favorites" });
      }
      
      const favorite = await storage.createFavoriteCongressMember({
        clientId,
        bioguideId,
        name,
        party,
        state,
        chamber,
        imageUrl,
        matterId: matterId || null,
        notes: notes || null,
      });
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite member:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  // Update favorite (assign to matter, add notes)
  app.patch("/api/congress/favorites/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const favorite = await storage.getFavoriteCongressMember(req.params.id);
      if (!favorite || favorite.clientId !== clientId) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      
      const updated = await storage.updateFavoriteCongressMember(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating favorite:", error);
      res.status(500).json({ message: "Failed to update favorite" });
    }
  });

  // Remove from favorites
  app.delete("/api/congress/favorites/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const favorite = await storage.getFavoriteCongressMember(req.params.id);
      if (!favorite || favorite.clientId !== clientId) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      
      await storage.deleteFavoriteCongressMember(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // Remove favorite by bioguideId
  app.delete("/api/congress/favorites/by-bioguide/:bioguideId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const favorite = await storage.getFavoriteByBioguideId(clientId, req.params.bioguideId);
      if (!favorite) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      
      await storage.deleteFavoriteCongressMember(favorite.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // ========== Customers Portal ==========

  // Get all customers for client
  app.get("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const query = req.query.q as string;
      let customerList;
      if (query) {
        customerList = await storage.searchCustomers(clientId, query);
      } else {
        customerList = await storage.getCustomers(clientId);
      }
      res.json(customerList);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Get customers by matter
  app.get("/api/customers/by-matter/:matterId", isAuthenticated, async (req, res) => {
    try {
      const customerList = await storage.getCustomersByMatter(req.params.matterId);
      res.json(customerList);
    } catch (error) {
      console.error("Error fetching customers by matter:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Get single customer
  app.get("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  // Create customer
  app.post("/api/customers", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const { name, title, organization, email, phone, party, state, sourceType, sourceId, imageUrl, notes, tags, matterId } = req.body;
      
      if (!name || !sourceType) {
        return res.status(400).json({ message: "Name and sourceType are required" });
      }

      // Check if already exists (for congress_member or staffer with sourceId)
      if (sourceId && sourceType !== 'manual') {
        const existing = await storage.getCustomerBySourceId(clientId, sourceType, sourceId);
        if (existing) {
          return res.status(409).json({ message: "This person is already in your customers list", existing });
        }
      }

      const customer = await storage.createCustomer({
        clientId,
        name,
        title,
        organization,
        email,
        phone,
        party,
        state,
        sourceType,
        sourceId,
        imageUrl,
        notes,
        tags,
        matterId,
      });
      
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const updated = await storage.updateCustomer(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", isAuthenticated, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      await storage.deleteCustomer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Check if person is already a customer (by sourceType and sourceId)
  app.get("/api/customers/check/:sourceType/:sourceId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const existing = await storage.getCustomerBySourceId(clientId, req.params.sourceType, req.params.sourceId);
      res.json({ isCustomer: !!existing, customer: existing });
    } catch (error) {
      console.error("Error checking customer status:", error);
      res.status(500).json({ message: "Failed to check customer status" });
    }
  });

  // ========== Kalshi Prediction Markets ==========

  // Get top political prediction markets
  app.get("/api/kalshi/political-markets", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const markets = await kalshiApi.getTopPoliticalEvents(limit);
      res.json(markets);
    } catch (error) {
      console.error("Error fetching Kalshi political markets:", error);
      res.status(500).json({ message: "Failed to fetch prediction markets" });
    }
  });

  // Get all open markets (filtered for political content)
  app.get("/api/kalshi/markets", isAuthenticated, async (req, res) => {
    try {
      const { series_ticker, event_ticker, limit } = req.query;
      const requestLimit = limit ? parseInt(limit as string) : 200;
      
      // If specific filters are provided, use them
      if (series_ticker || event_ticker) {
        const result = await kalshiApi.getMarkets({
          seriesTicker: series_ticker as string,
          eventTicker: event_ticker as string,
          status: "open",
          limit: requestLimit,
        });
        res.json(result || { markets: [], cursor: null });
      } else {
        // Otherwise, return political markets only
        const markets = await kalshiApi.searchPoliticalMarkets(requestLimit);
        res.json({ markets, cursor: null });
      }
    } catch (error) {
      console.error("Error fetching Kalshi markets:", error);
      res.status(500).json({ message: "Failed to fetch markets" });
    }
  });

  // Get specific market details
  app.get("/api/kalshi/markets/:ticker", isAuthenticated, async (req, res) => {
    try {
      const result = await kalshiApi.getMarket(req.params.ticker);
      if (!result) {
        return res.status(404).json({ message: "Market not found" });
      }
      res.json(result.market);
    } catch (error) {
      console.error("Error fetching Kalshi market:", error);
      res.status(500).json({ message: "Failed to fetch market" });
    }
  });

  // Get event details
  app.get("/api/kalshi/events/:eventTicker", isAuthenticated, async (req, res) => {
    try {
      const result = await kalshiApi.getEvent(req.params.eventTicker);
      if (!result) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(result.event);
    } catch (error) {
      console.error("Error fetching Kalshi event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Search for bill-related markets
  app.get("/api/kalshi/bill-markets/:billNumber", isAuthenticated, async (req, res) => {
    try {
      const markets = await kalshiApi.searchBillMarkets(req.params.billNumber);
      res.json(markets);
    } catch (error) {
      console.error("Error searching Kalshi bill markets:", error);
      res.status(500).json({ message: "Failed to search bill markets" });
    }
  });

  // ============= SOCIAL TRACKING ROUTES =============

  // Get all tracked social accounts for client
  app.get("/api/social/accounts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const accounts = await storage.getTrackedSocialAccounts(clientId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching tracked social accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  // Create tracked social account
  app.post("/api/social/accounts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const { username, displayName, platform } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      const cleanUsername = username.replace(/^@/, "").trim();
      const account = await storage.createTrackedSocialAccount({
        clientId,
        username: cleanUsername,
        displayName: displayName || cleanUsername,
        platform: platform || "x",
        profileUrl: `https://x.com/${cleanUsername}`,
        isActive: true,
      });
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating tracked social account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Update tracked social account
  app.patch("/api/social/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const account = await storage.getTrackedSocialAccount(req.params.id);
      if (!account || account.clientId !== clientId) {
        return res.status(404).json({ message: "Account not found" });
      }
      const updated = await storage.updateTrackedSocialAccount(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating tracked social account:", error);
      res.status(500).json({ message: "Failed to update account" });
    }
  });

  // Delete tracked social account
  app.delete("/api/social/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const account = await storage.getTrackedSocialAccount(req.params.id);
      if (!account || account.clientId !== clientId) {
        return res.status(404).json({ message: "Account not found" });
      }
      await storage.deleteTrackedSocialAccount(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tracked social account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Get all tracking keywords for client
  app.get("/api/social/keywords", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const keywords = await storage.getSocialTrackingKeywords(clientId);
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching tracking keywords:", error);
      res.status(500).json({ message: "Failed to fetch keywords" });
    }
  });

  // Create tracking keyword
  app.post("/api/social/keywords", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const { keyword, accountId } = req.body;
      if (!keyword || !keyword.trim()) {
        return res.status(400).json({ message: "Keyword is required" });
      }
      const newKeyword = await storage.createSocialTrackingKeyword({
        clientId,
        keyword: keyword.trim().toLowerCase(),
        accountId: accountId || null,
        isActive: true,
      });
      res.status(201).json(newKeyword);
    } catch (error) {
      console.error("Error creating tracking keyword:", error);
      res.status(500).json({ message: "Failed to create keyword" });
    }
  });

  // Delete tracking keyword
  app.delete("/api/social/keywords/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const keywords = await storage.getSocialTrackingKeywords(clientId);
      const keyword = keywords.find(k => k.id === req.params.id);
      if (!keyword) {
        return res.status(404).json({ message: "Keyword not found" });
      }
      await storage.deleteSocialTrackingKeyword(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tracking keyword:", error);
      res.status(500).json({ message: "Failed to delete keyword" });
    }
  });

  // Get tracked posts for client
  app.get("/api/social/posts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const posts = await storage.getTrackedSocialPosts(clientId, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching tracked posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Get posts for specific account
  app.get("/api/social/accounts/:accountId/posts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const account = await storage.getTrackedSocialAccount(req.params.accountId);
      if (!account || account.clientId !== clientId) {
        return res.status(404).json({ message: "Account not found" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const posts = await storage.getTrackedSocialPostsByAccount(req.params.accountId, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching account posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Mark post as read
  app.patch("/api/social/posts/:id/read", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const post = await storage.getTrackedSocialPost(req.params.id);
      if (!post || post.clientId !== clientId) {
        return res.status(404).json({ message: "Post not found" });
      }
      await storage.markSocialPostAsRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking post as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Toggle post flag
  app.patch("/api/social/posts/:id/flag", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const post = await storage.getTrackedSocialPost(req.params.id);
      if (!post || post.clientId !== clientId) {
        return res.status(404).json({ message: "Post not found" });
      }
      const updated = await storage.toggleSocialPostFlag(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error toggling post flag:", error);
      res.status(500).json({ message: "Failed to toggle flag" });
    }
  });

  // Sync specific account
  app.post("/api/social/accounts/:id/sync", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const account = await storage.getTrackedSocialAccount(req.params.id);
      if (!account || account.clientId !== clientId) {
        return res.status(404).json({ message: "Account not found" });
      }
      const result = await syncAccountPosts(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error syncing account:", error);
      res.status(500).json({ message: "Failed to sync account" });
    }
  });

  // Sync all accounts for client
  app.post("/api/social/sync", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const result = await syncAllClientAccounts(clientId);
      res.json(result);
    } catch (error) {
      console.error("Error syncing all accounts:", error);
      res.status(500).json({ message: "Failed to sync accounts" });
    }
  });

  // ============ Social Engagement History Routes ============

  // Get engagement history for an account
  app.get("/api/social/accounts/:accountId/engagement", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const limit = parseInt(req.query.limit as string) || 30;
      const history = await storage.getSocialEngagementHistory(req.params.accountId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching engagement history:", error);
      res.status(500).json({ message: "Failed to fetch engagement history" });
    }
  });

  // Get engagement history for a specific post
  app.get("/api/social/posts/:postId/engagement", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const limit = parseInt(req.query.limit as string) || 30;
      const history = await storage.getSocialPostEngagementHistory(req.params.postId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching post engagement history:", error);
      res.status(500).json({ message: "Failed to fetch post engagement history" });
    }
  });

  // ============ Social Keyword Alerts Routes ============

  // Get keyword alerts for client
  app.get("/api/social/alerts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const includeRead = req.query.includeRead === "true";
      const alerts = await storage.getSocialKeywordAlerts(clientId, includeRead);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Get unread alert count
  app.get("/api/social/alerts/count", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const count = await storage.getUnreadAlertCount(clientId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching alert count:", error);
      res.status(500).json({ message: "Failed to fetch alert count" });
    }
  });

  // Mark alert as read
  app.patch("/api/social/alerts/:id/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markAlertAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking alert as read:", error);
      res.status(500).json({ message: "Failed to mark alert as read" });
    }
  });

  // Dismiss alert
  app.patch("/api/social/alerts/:id/dismiss", isAuthenticated, async (req, res) => {
    try {
      await storage.dismissAlert(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing alert:", error);
      res.status(500).json({ message: "Failed to dismiss alert" });
    }
  });

  // Mark all alerts as read
  app.post("/api/social/alerts/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      await storage.markAllAlertsAsRead(clientId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all alerts as read:", error);
      res.status(500).json({ message: "Failed to mark all alerts as read" });
    }
  });

  // ============ Social Auto-Sync Configuration Routes ============

  // Get auto-sync configuration for client
  app.get("/api/social/auto-sync", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const config = await storage.getSocialAutoSyncConfig(clientId);
      res.json(config || { isEnabled: false, syncIntervalMinutes: 60 });
    } catch (error) {
      console.error("Error fetching auto-sync config:", error);
      res.status(500).json({ message: "Failed to fetch auto-sync configuration" });
    }
  });

  // Update auto-sync configuration
  app.post("/api/social/auto-sync", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const { isEnabled, syncIntervalMinutes } = req.body;
      
      let nextScheduledSync: Date | undefined;
      if (isEnabled && syncIntervalMinutes) {
        nextScheduledSync = new Date(Date.now() + syncIntervalMinutes * 60 * 1000);
      }
      
      const config = await storage.createOrUpdateAutoSyncConfig(clientId, {
        isEnabled,
        syncIntervalMinutes,
        nextScheduledSync,
      });
      res.json(config);
    } catch (error) {
      console.error("Error updating auto-sync config:", error);
      res.status(500).json({ message: "Failed to update auto-sync configuration" });
    }
  });

  // ============ Influencer Tracking Routes (Influencers Club API) ============

  // Get all tracked influencers for client
  app.get("/api/influencers", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const influencers = await storage.getTrackedInfluencers(clientId);
      res.json(influencers);
    } catch (error) {
      console.error("Error fetching influencers:", error);
      res.status(500).json({ message: "Failed to fetch influencers" });
    }
  });

  // Add new influencer to track
  app.post("/api/influencers", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const { username, platform, notes, keywords } = req.body;
      if (!username || !platform) {
        return res.status(400).json({ message: "Username and platform are required" });
      }
      
      const validPlatforms = ["instagram", "youtube", "tiktok", "twitter", "twitch", "onlyfans"];
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({ message: "Invalid platform" });
      }
      
      const exists = await storage.influencerExists(clientId, platform, username);
      if (exists) {
        return res.status(400).json({ message: "This influencer is already being tracked" });
      }

      const { enrichByHandle, parseInfluencerData, getPlatformProfileUrl } = await import("./services/influencers-api");
      
      const enrichResult = await enrichByHandle(username, platform, "raw");
      
      let influencerData: any = {
        clientId,
        platform,
        username: username.replace(/^@/, ""),
        profileUrl: getPlatformProfileUrl(platform, username.replace(/^@/, "")),
        notes,
        keywords: keywords && Array.isArray(keywords) ? keywords : null,
        isActive: true,
      };
      
      if (enrichResult.success && enrichResult.data) {
        const parsed = parseInfluencerData(platform, enrichResult.data);
        influencerData = {
          ...influencerData,
          displayName: parsed.displayName,
          bio: parsed.bio,
          followerCount: parsed.followerCount,
          followingCount: parsed.followingCount,
          postCount: parsed.postCount,
          profilePictureUrl: parsed.profilePictureUrl,
          isVerified: parsed.isVerified,
          engagementRate: parsed.engagementRate,
          location: parsed.location,
          email: parsed.email,
          rawData: JSON.stringify(enrichResult.data),
          lastSyncAt: new Date(),
        };
      } else {
        influencerData.lastSyncError = enrichResult.error || "Failed to fetch profile data";
      }
      
      const influencer = await storage.createTrackedInfluencer(influencerData);
      res.status(201).json(influencer);
    } catch (error) {
      console.error("Error adding influencer:", error);
      res.status(500).json({ message: "Failed to add influencer" });
    }
  });

  // Update influencer
  app.patch("/api/influencers/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const influencer = await storage.getTrackedInfluencer(req.params.id);
      if (!influencer || influencer.clientId !== clientId) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      const updated = await storage.updateTrackedInfluencer(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating influencer:", error);
      res.status(500).json({ message: "Failed to update influencer" });
    }
  });

  // Delete influencer
  app.delete("/api/influencers/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const influencer = await storage.getTrackedInfluencer(req.params.id);
      if (!influencer || influencer.clientId !== clientId) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      await storage.deleteTrackedInfluencer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer:", error);
      res.status(500).json({ message: "Failed to delete influencer" });
    }
  });

  // Sync/refresh influencer data
  app.post("/api/influencers/:id/sync", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const influencer = await storage.getTrackedInfluencer(req.params.id);
      if (!influencer || influencer.clientId !== clientId) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      
      const { enrichByHandle, parseInfluencerData } = await import("./services/influencers-api");
      const enrichResult = await enrichByHandle(influencer.username, influencer.platform as any, "raw");
      
      if (!enrichResult.success) {
        await storage.updateTrackedInfluencer(req.params.id, {
          lastSyncError: enrichResult.error || "Failed to fetch profile data",
        });
        return res.status(400).json({ message: enrichResult.error || "Failed to sync" });
      }
      
      const parsed = parseInfluencerData(influencer.platform as any, enrichResult.data);
      const updated = await storage.updateTrackedInfluencer(req.params.id, {
        displayName: parsed.displayName,
        bio: parsed.bio,
        followerCount: parsed.followerCount,
        followingCount: parsed.followingCount,
        postCount: parsed.postCount,
        profilePictureUrl: parsed.profilePictureUrl,
        isVerified: parsed.isVerified,
        engagementRate: parsed.engagementRate,
        location: parsed.location,
        email: parsed.email,
        rawData: JSON.stringify(enrichResult.data),
        lastSyncAt: new Date(),
        lastSyncError: null,
      });
      
      // Store posts if available
      if (parsed.posts && parsed.posts.length > 0) {
        for (const post of parsed.posts.slice(0, 20)) {
          const postId = post.id || post.post_id || `${Date.now()}-${Math.random()}`;
          const exists = await storage.influencerPostExists(postId, influencer.id);
          if (!exists) {
            await storage.createInfluencerPost({
              clientId,
              influencerId: influencer.id,
              platform: influencer.platform,
              postId,
              postUrl: post.post_url,
              content: post.caption || post.content,
              postType: post.media_type,
              likes: post.likes,
              comments: post.comments,
              shares: post.shares,
              views: post.views,
              engagementRate: post.engagement_rate?.toString(),
              hashtags: post.hashtags,
              postedAt: post.posted_at ? new Date(post.posted_at) : null,
              rawData: JSON.stringify(post),
            });
          }
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error syncing influencer:", error);
      res.status(500).json({ message: "Failed to sync influencer" });
    }
  });

  // Get influencer posts
  app.get("/api/influencers/posts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const posts = await storage.getInfluencerPosts(clientId, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching influencer posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Get posts for specific influencer
  app.get("/api/influencers/:id/posts", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const influencer = await storage.getTrackedInfluencer(req.params.id);
      if (!influencer || influencer.clientId !== clientId) {
        return res.status(404).json({ message: "Influencer not found" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const posts = await storage.getInfluencerPostsByInfluencer(req.params.id, limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching influencer posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Mark post as read
  app.patch("/api/influencer-posts/:id/read", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const post = await storage.getInfluencerPost(req.params.id);
      if (!post || post.clientId !== clientId) {
        return res.status(404).json({ message: "Post not found" });
      }
      await storage.markInfluencerPostAsRead(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking post as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Toggle post flag
  app.patch("/api/influencer-posts/:id/flag", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const post = await storage.getInfluencerPost(req.params.id);
      if (!post || post.clientId !== clientId) {
        return res.status(404).json({ message: "Post not found" });
      }
      const updated = await storage.toggleInfluencerPostFlag(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error toggling post flag:", error);
      res.status(500).json({ message: "Failed to toggle flag" });
    }
  });

  // Check API credits
  app.get("/api/influencers/credits", isAuthenticated, async (req, res) => {
    try {
      const { checkCredits } = await import("./services/influencers-api");
      const result = await checkCredits();
      res.json(result);
    } catch (error) {
      console.error("Error checking credits:", error);
      res.status(500).json({ message: "Failed to check credits" });
    }
  });

  // ================== STAFFERS API ==================
  
  // Search staffers
  app.get("/api/staffers/search", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const { q, member, chamber, party, state, specialty, limit, offset } = req.query;
      const result = await storage.searchStaffers(clientId, {
        q: q as string,
        member: member as string,
        chamber: chamber as string,
        party: party as string,
        state: state as string,
        specialty: specialty as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Error searching staffers:", error);
      res.status(500).json({ message: "Failed to search staffers" });
    }
  });

  // Get staffers by member
  app.get("/api/staffers/by-member/:memberName", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffersList = await storage.getStaffersByMember(clientId, req.params.memberName);
      res.json(staffersList);
    } catch (error) {
      console.error("Error fetching staffers by member:", error);
      res.status(500).json({ message: "Failed to fetch staffers" });
    }
  });

  // Get staffers by organization
  app.get("/api/staffers/by-organization/:orgName", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffersList = await storage.getStaffersByOrganization(clientId, req.params.orgName);
      res.json(staffersList);
    } catch (error) {
      console.error("Error fetching staffers by organization:", error);
      res.status(500).json({ message: "Failed to fetch staffers" });
    }
  });

  // Get staffer stats
  app.get("/api/staffers/stats", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const allStaffers = await storage.getStaffers(clientId);
      const chambers: Record<string, number> = {};
      const parties: Record<string, number> = {};
      const organizations: Record<string, number> = {};
      
      allStaffers.forEach(s => {
        if (s.chamber) chambers[s.chamber] = (chambers[s.chamber] || 0) + 1;
        if (s.party) parties[s.party] = (parties[s.party] || 0) + 1;
        if (s.currentOrganization) organizations[s.currentOrganization] = (organizations[s.currentOrganization] || 0) + 1;
      });

      res.json({
        totalStaffers: allStaffers.length,
        byChamber: chambers,
        byParty: parties,
        topOrganizations: Object.entries(organizations)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
      });
    } catch (error) {
      console.error("Error fetching staffer stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get all staffers
  app.get("/api/staffers", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffersList = await storage.getStaffers(clientId);
      res.json(staffersList);
    } catch (error) {
      console.error("Error fetching staffers:", error);
      res.status(500).json({ message: "Failed to fetch staffers" });
    }
  });

  // Get single staffer with career and connections
  app.get("/api/staffers/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const careerPositions = await storage.getStafferCareerPositions(req.params.id);
      const connections = await storage.getStafferConnections(req.params.id);
      res.json({ staffer, careerPositions, connections });
    } catch (error) {
      console.error("Error fetching staffer:", error);
      res.status(500).json({ message: "Failed to fetch staffer" });
    }
  });

  // Get staffer timeline
  app.get("/api/staffers/:id/timeline", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const positions = await storage.getStafferCareerPositions(req.params.id);
      
      // Calculate stats
      const currentYear = new Date().getFullYear();
      const totalYears = positions.reduce((sum, p) => {
        const end = p.endYear || currentYear;
        return sum + (end - p.startYear);
      }, 0);
      const organizations = new Set(positions.map(p => p.organization)).size;
      const longestPosition = positions.reduce((longest, p) => {
        const duration = (p.endYear || currentYear) - p.startYear;
        if (!longest || duration > longest.years) {
          return { position: p.position, years: duration };
        }
        return longest;
      }, null as { position: string; years: number } | null);

      res.json({
        staffer: { id: staffer.id, name: staffer.name },
        timeline: positions.map(p => ({
          ...p,
          durationYears: (p.endYear || currentYear) - p.startYear,
        })),
        stats: {
          totalYears,
          totalPositions: positions.length,
          organizations,
          longestPosition,
        },
      });
    } catch (error) {
      console.error("Error fetching staffer timeline:", error);
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });

  // Get staffer network
  app.get("/api/staffers/:id/network", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const connections = await storage.getStafferConnections(req.params.id);
      const positions = await storage.getStafferCareerPositions(req.params.id);

      // Build network nodes and edges
      const nodes: any[] = [
        { id: `s${staffer.id}`, label: staffer.name, group: "person", level: 0 },
      ];
      const edges: any[] = [];
      const orgSet = new Set<string>();

      // Add organizations from career
      positions.forEach(p => {
        if (!orgSet.has(p.organization)) {
          orgSet.add(p.organization);
          nodes.push({
            id: `o${p.organization}`,
            label: p.organization,
            group: "org",
            level: 1,
          });
        }
        edges.push({
          from: `s${staffer.id}`,
          to: `o${p.organization}`,
          label: p.isCurrent ? "works at" : "worked at",
        });
      });

      // Add connections
      connections.forEach(c => {
        nodes.push({
          id: `c${c.id}`,
          label: c.connectedToName,
          group: "person",
          level: 1,
        });
        edges.push({
          from: `s${staffer.id}`,
          to: `c${c.id}`,
          label: c.connectionType || "connected",
          years: c.yearsTogether,
        });
      });

      res.json({ nodes, edges });
    } catch (error) {
      console.error("Error fetching staffer network:", error);
      res.status(500).json({ message: "Failed to fetch network" });
    }
  });

  // Create staffer
  app.post("/api/staffers", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.createStaffer({ ...req.body, clientId });
      res.status(201).json(staffer);
    } catch (error) {
      console.error("Error creating staffer:", error);
      res.status(500).json({ message: "Failed to create staffer" });
    }
  });

  // Update staffer
  app.put("/api/staffers/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const updated = await storage.updateStaffer(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating staffer:", error);
      res.status(500).json({ message: "Failed to update staffer" });
    }
  });

  // Delete staffer
  app.delete("/api/staffers/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      await storage.deleteStaffer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting staffer:", error);
      res.status(500).json({ message: "Failed to delete staffer" });
    }
  });

  // Add career position
  app.post("/api/staffers/:id/positions", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const position = await storage.createStafferCareerPosition({
        ...req.body,
        stafferId: req.params.id,
      });
      res.status(201).json(position);
    } catch (error) {
      console.error("Error adding career position:", error);
      res.status(500).json({ message: "Failed to add position" });
    }
  });

  // Delete career position
  app.delete("/api/staffers/:id/positions/:positionId", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      await storage.deleteStafferCareerPosition(req.params.positionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting career position:", error);
      res.status(500).json({ message: "Failed to delete position" });
    }
  });

  // Add connection
  app.post("/api/staffers/:id/connections", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const connection = await storage.createStafferConnection({
        ...req.body,
        stafferId: req.params.id,
      });
      res.status(201).json(connection);
    } catch (error) {
      console.error("Error adding connection:", error);
      res.status(500).json({ message: "Failed to add connection" });
    }
  });

  // Delete connection
  app.delete("/api/staffers/:id/connections/:connectionId", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      await storage.deleteStafferConnection(req.params.connectionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // Export staffer data
  app.get("/api/staffers/:id/export", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const careerPositions = await storage.getStafferCareerPositions(req.params.id);
      const connections = await storage.getStafferConnections(req.params.id);

      const format = req.query.format || "json";

      if (format === "csv") {
        // Generate CSV for career and connections
        const careerCsv = ["position,organization,boss_name,start_year,end_year,org_type,chamber"];
        careerPositions.forEach(p => {
          careerCsv.push(`"${p.position}","${p.organization}","${p.bossName || ""}",${p.startYear},${p.endYear || ""},${p.orgType || ""},${p.chamber || ""}`);
        });

        const connectionsCsv = ["connected_to,connection_type,organization,years_together,strength"];
        connections.forEach(c => {
          connectionsCsv.push(`"${c.connectedToName}","${c.connectionType || ""}","${c.organization || ""}",${c.yearsTogether || ""},${c.strength || ""}`);
        });

        res.json({
          career: careerCsv.join("\n"),
          connections: connectionsCsv.join("\n"),
        });
      } else {
        res.json({ staffer, careerPositions, connections });
      }
    } catch (error) {
      console.error("Error exporting staffer:", error);
      res.status(500).json({ message: "Failed to export staffer" });
    }
  });

  // Export staffer to Miro
  app.post("/api/staffers/:id/export-miro", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      const staffer = await storage.getStaffer(req.params.id);
      if (!staffer || staffer.clientId !== clientId) {
        return res.status(404).json({ message: "Staffer not found" });
      }
      const careerPositions = await storage.getStafferCareerPositions(req.params.id);
      const connections = await storage.getStafferConnections(req.params.id);

      const { exportStafferToMiro } = await import("./services/miro-service");
      const result = await exportStafferToMiro({ staffer, careerPositions, connections });
      
      res.json(result);
    } catch (error) {
      console.error("Error exporting to Miro:", error);
      res.status(500).json({ message: "Failed to export to Miro: " + (error instanceof Error ? error.message : "Unknown error") });
    }
  });

  // Export office staffers to Miro (using staffers passed from frontend)
  app.post("/api/miro/map-office", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      
      const { memberName, staffers, chamber, party, state, district } = req.body;
      if (!memberName) {
        return res.status(400).json({ message: "memberName is required" });
      }

      // Use staffers passed from frontend (parsed from AI response)
      if (!staffers || !Array.isArray(staffers) || staffers.length === 0) {
        return res.status(400).json({ message: "No staffers provided" });
      }

      // Convert frontend staffers to the format expected by Miro service
      const formattedStaffers = staffers.map((s: { name: string; title: string; email?: string }) => ({
        id: crypto.randomUUID(),
        clientId,
        name: s.name,
        currentPosition: s.title,
        currentOrganization: `Office of ${memberName}`,
        member: memberName,
        email: s.email || null,
        party: party || null,
        pathwayType: null,
        yearsInCurrentRole: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const { exportOfficeToMiro } = await import("./services/miro-service");
      const result = await exportOfficeToMiro({ memberName, staffers: formattedStaffers });
      
      res.json(result);
    } catch (error) {
      console.error("Error exporting office to Miro:", error);
      res.status(500).json({ message: "Failed to export office to Miro: " + (error instanceof Error ? error.message : "Unknown error") });
    }
  });

  // Export multiple selected staffers to Miro
  app.post("/api/miro/map-multiple", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      
      const { stafferIds, boardName } = req.body;
      if (!stafferIds || !Array.isArray(stafferIds) || stafferIds.length === 0) {
        return res.status(400).json({ message: "stafferIds array is required" });
      }

      // Get all selected staffers with their data
      const staffersWithData = await Promise.all(
        stafferIds.map(async (id: string) => {
          const staffer = await storage.getStaffer(id);
          if (!staffer || staffer.clientId !== clientId) return null;
          const careerPositions = await storage.getStafferCareerPositions(id);
          const connections = await storage.getStafferConnections(id);
          return { ...staffer, careerPositions, connections };
        })
      );

      const validStaffers = staffersWithData.filter(Boolean);
      if (validStaffers.length === 0) {
        return res.status(404).json({ message: "No valid staffers found" });
      }

      const { exportMultipleStaffersToMiro } = await import("./services/miro-service");
      const result = await exportMultipleStaffersToMiro({ 
        boardName: boardName || `Selected Staffers Network`, 
        staffers: validStaffers as any
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error exporting multiple staffers to Miro:", error);
      res.status(500).json({ message: "Failed to export to Miro: " + (error instanceof Error ? error.message : "Unknown error") });
    }
  });

  // Import staffers from CSV
  app.post("/api/staffers/import", isAuthenticated, async (req, res) => {
    try {
      const clientId = getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not associated with a client" });
      }
      
      const { staffers: staffersData, positions: positionsData } = req.body;
      
      if (!staffersData || !Array.isArray(staffersData)) {
        return res.status(400).json({ message: "Invalid staffers data" });
      }

      const created: any[] = [];
      for (const stafferData of staffersData) {
        const staffer = await storage.createStaffer({ ...stafferData, clientId });
        created.push(staffer);
        
        // If positions are provided for this staffer
        if (positionsData) {
          const stafferPositions = positionsData.filter((p: any) => p.stafferName === stafferData.name);
          for (const pos of stafferPositions) {
            await storage.createStafferCareerPosition({
              stafferId: staffer.id,
              position: pos.position,
              organization: pos.organization,
              bossName: pos.bossName,
              startYear: pos.startYear,
              endYear: pos.endYear,
              isCurrent: pos.isCurrent,
              orgType: pos.orgType,
              chamber: pos.chamber,
              state: pos.state,
            });
          }
        }
      }

      res.status(201).json({ imported: created.length, staffers: created });
    } catch (error) {
      console.error("Error importing staffers:", error);
      res.status(500).json({ message: "Failed to import staffers" });
    }
  });

  return httpServer;
}
