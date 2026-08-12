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
  strategyBoards,
  strategyCards,
  insertStrategyBoardSchema,
  insertStrategyCardSchema,
  legistormStaffers,
  stafferBillAssociations,
  veteranCongressMembers,
  insertMarketingIntelligenceDataSchema,
  insertMarketingAiRecommendationSchema,
} from "@shared/schema";
import { extractVideoId, checkTranscriptAvailable, getTranscript, TRANSCRIPT_SOURCES, checkPendingWatchList } from "./services/youtube-watchlist";
import { CongressAPI, formatBillId, parseBillId, lookupMemberPortrait } from "./services/congress-api";
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

function extractRelevantSnippet(text: string, keywords: string[], maxLength = 200): string {
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) return text.slice(0, maxLength) + "...";
  const start = Math.max(0, bestIdx - 60);
  const end = Math.min(text.length, start + maxLength);
  let snippet = text.slice(start, end).replace(/\n+/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet += "...";
  return snippet;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup session + passport (replaces Replit OIDC setupAuth for VPS deployment)
  const { getSession } = await import("./replit_integrations/auth/replitAuth");
  app.use(getSession());

  // Minimal passport setup so req.login works for password-based auth
  const passport = (await import("passport")).default;
  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((user: any, done) => done(null, user));
  app.use(passport.initialize());
  app.use(passport.session());

  registerAuthRoutes(app);

  // Register object storage routes for file serving
  // const { registerObjectStorageRoutes } = await import("./replit_integrations/object_storage");
  // registerObjectStorageRoutes(app);

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

      // Bootstrap: on a fresh deploy with no super admins, promote ONLY the
      // user whose email matches SUPER_ADMIN_BOOTSTRAP_EMAIL. The previous
      // behavior (first user to log in wins) was an account-takeover primitive
      // on any fresh deploy with public signup enabled.
      if (!superAdmin) {
        const bootstrapEmail = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
        const userEmail = (req.user as any)?.claims?.email?.trim().toLowerCase();
        if (bootstrapEmail && userEmail && bootstrapEmail === userEmail) {
          const allSuperAdmins = await storage.getSuperAdmins();
          if (allSuperAdmins.length === 0) {
            superAdmin = await storage.createSuperAdmin({ userId });
            console.log(`Bootstrapped super admin for ${userEmail} (matched SUPER_ADMIN_BOOTSTRAP_EMAIL)`);
          }
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

      // Auto-enable all modules for new client
      try {
        const allModules = await storage.getModules();
        for (const mod of allModules) {
          await storage.enableClientModule(client.id, mod.id);
        }
      } catch (modErr) {
        console.error("Failed to auto-enable modules for new client:", modErr);
      }

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

      // Send alert email to all super admins
      try {
        const superAdmins = await storage.getSuperAdmins();
        const adminEmails: string[] = [];
        for (const sa of superAdmins) {
          const adminUser = await authStorage.getUser(sa.userId);
          if (adminUser?.email) adminEmails.push(adminUser.email);
        }
        if (adminEmails.length > 0) {
          const goalsLabel = (parsed.data.primaryGoals || []).join(", ") || "Not specified";
          const toolsLabel = parsed.data.currentTools || "Not specified";
          const appUrl = `${protocol}://${host}/admin/applications`;
          await sendEmail({
            to: adminEmails,
            subject: `New Client Signup: ${parsed.data.companyName}`,
            html: `
              <h2>New Client Application Received</h2>
              <table style="border-collapse:collapse;width:100%;max-width:500px;">
                <tr><td style="padding:8px;font-weight:bold;color:#555;">Company</td><td style="padding:8px;">${parsed.data.companyName}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555;">Contact</td><td style="padding:8px;">${parsed.data.contactName}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555;">Email</td><td style="padding:8px;">${parsed.data.email}</td></tr>
                ${parsed.data.phone ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Phone</td><td style="padding:8px;">${parsed.data.phone}</td></tr>` : ""}
                ${parsed.data.firmSize ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Firm Size</td><td style="padding:8px;">${parsed.data.firmSize}</td></tr>` : ""}
                ${parsed.data.industry ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Industry</td><td style="padding:8px;">${parsed.data.industry}</td></tr>` : ""}
                ${parsed.data.website ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Website</td><td style="padding:8px;">${parsed.data.website}</td></tr>` : ""}
                <tr><td style="padding:8px;font-weight:bold;color:#555;">Goals</td><td style="padding:8px;">${goalsLabel}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555;">Current Tools</td><td style="padding:8px;">${toolsLabel}</td></tr>
                ${parsed.data.urgency ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Urgency</td><td style="padding:8px;">${parsed.data.urgency}</td></tr>` : ""}
                ${parsed.data.howHeardAboutUs ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">How They Found Us</td><td style="padding:8px;">${parsed.data.howHeardAboutUs}</td></tr>` : ""}
                ${parsed.data.message ? `<tr><td style="padding:8px;font-weight:bold;color:#555;">Message</td><td style="padding:8px;">${parsed.data.message}</td></tr>` : ""}
              </table>
              <p style="margin-top:20px;"><a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:white;text-decoration:none;border-radius:4px;">Review Application</a></p>
            `,
          });
        }
      } catch (alertErr) {
        console.error("Failed to send admin alert email:", alertErr);
      }

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

      // Auto-enable all modules for new client
      try {
        const allModules = await storage.getModules();
        for (const mod of allModules) {
          await storage.enableClientModule(client.id, mod.id);
        }
      } catch (modErr) {
        console.error("Failed to auto-enable modules for new client:", modErr);
      }

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

  // ── Sign in with LinkedIn (OpenID Connect) ──────────────────────────────
  // Existing users (matched by verified email) log straight in; unknown
  // emails are sent to /signup with LinkedIn profile fields prefilled so
  // account creation still flows through the application/approval funnel.
  const linkedInRedirectUri = (req: any): string => {
    const host = (req.headers["host"] as string) || "localhost:5000";
    const proto = host.startsWith("localhost")
      ? "http"
      : (req.headers["x-forwarded-proto"] as string) || "https";
    return `${proto}://${host}/api/auth/linkedin/callback`;
  };

  app.get("/api/auth/linkedin", async (req, res) => {
    const { isLinkedInConfigured, buildLinkedInAuthUrl } = await import("./services/linkedin-auth");
    if (!isLinkedInConfigured()) {
      return res.redirect("/login?error=linkedin_unavailable");
    }
    const state = randomBytes(16).toString("hex");
    (req.session as any).linkedinOAuthState = state;
    req.session.save(() => {
      res.redirect(buildLinkedInAuthUrl(linkedInRedirectUri(req), state));
    });
  });

  app.get("/api/auth/linkedin/callback", async (req, res) => {
    try {
      const { exchangeLinkedInCode, fetchLinkedInUserInfo } = await import("./services/linkedin-auth");
      const { code, state, error } = req.query as Record<string, string | undefined>;

      if (error || !code) {
        return res.redirect("/login?error=linkedin_denied");
      }
      const savedState = (req.session as any).linkedinOAuthState;
      delete (req.session as any).linkedinOAuthState;
      if (!state || !savedState || state !== savedState) {
        return res.redirect("/login?error=linkedin_state");
      }

      const accessToken = await exchangeLinkedInCode(code, linkedInRedirectUri(req));
      const info = await fetchLinkedInUserInfo(accessToken);
      if (!info.email) {
        return res.redirect("/login?error=linkedin_no_email");
      }

      const user = await authStorage.getUserByEmail(info.email.toLowerCase());

      if (!user) {
        // No account yet — prefill the signup application from LinkedIn.
        const q = new URLSearchParams({ from: "linkedin", email: info.email });
        const fullName = [info.given_name, info.family_name].filter(Boolean).join(" ") || info.name || "";
        if (fullName) q.set("name", fullName);
        return res.redirect(`/signup?${q.toString()}`);
      }

      // Backfill the profile photo from LinkedIn if we don't have one.
      if (!user.profileImageUrl && info.picture) {
        try {
          await authStorage.upsertUser({ id: user.id, email: user.email, profileImageUrl: info.picture });
        } catch (e) {
          console.error("[linkedin-auth] profile image backfill failed:", e);
        }
      }

      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 1 week, same as password login
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[linkedin-auth] session login error:", err);
          return res.redirect("/login?error=linkedin_session");
        }
        res.redirect("/dashboard");
      });
    } catch (e) {
      console.error("[linkedin-auth] callback failed:", e);
      res.redirect("/login?error=linkedin_failed");
    }
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

      // Auto-enable all modules for new client
      try {
        const allModules = await storage.getModules();
        for (const mod of allModules) {
          await storage.enableClientModule(client.id, mod.id);
        }
      } catch (modErr) {
        console.error("Failed to auto-enable modules for approved client:", modErr);
      }

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
      
      req.session.save((err: any) => {
        if (err) {
          console.error("Error saving session after impersonation:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }
        res.json({ 
          success: true, 
          impersonatingClientId: clientId,
          impersonatingClientName: client.name,
        });
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

  // Look up contacts by names to get career history for network map
  app.post("/api/contacts/lookup-career", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const { names } = req.body;
      if (!names || !Array.isArray(names)) {
        return res.status(400).json({ message: "names array required" });
      }
      
      const contactsWithHistory = await storage.getContactsWithHistory(clientId);
      const matches: Record<string, any> = {};
      
      for (const name of names) {
        const normalizedName = name.toLowerCase().trim();
        const matchingContact = contactsWithHistory.find(c => {
          const contactName = `${c.firstName} ${c.lastName}`.toLowerCase();
          return contactName === normalizedName || 
                 contactName.includes(normalizedName) || 
                 normalizedName.includes(contactName);
        });
        
        if (matchingContact && matchingContact.careerHistory && matchingContact.careerHistory.length > 0) {
          matches[name] = {
            contactId: matchingContact.id,
            name: `${matchingContact.firstName} ${matchingContact.lastName}`,
            careerHistory: matchingContact.careerHistory.map(ch => ({
              title: ch.title,
              organization: ch.organization,
              startYear: ch.startYear,
              endYear: ch.endYear || undefined,
              organizationType: ch.organizationType,
              policyAreas: ch.policyAreas,
              supervisor: ch.supervisor,
            })),
            policyAreas: [...new Set(matchingContact.careerHistory.flatMap(ch => ch.policyAreas || []))],
          };
        }
      }
      
      res.json(matches);
    } catch (error) {
      console.error("Error looking up career data:", error);
      res.status(500).json({ message: "Failed to look up career data" });
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
      // If the contact is a current member of Congress, attach the official portrait.
      if (!parsed.data.imageUrl) {
        parsed.data.imageUrl = await lookupMemberPortrait(parsed.data.firstName, parsed.data.lastName);
      }
      const contact = await storage.createContact(parsed.data);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.post("/api/contacts/from-search", isAuthenticated, async (req, res) => {
    try {
      const { firstName, lastName, title, organization, notes, assignToClientId, kbCategoryId } = req.body;
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First and last name are required" });
      }

      const userId = getUserId(req);
      let clientId: string | null = null;

      if (assignToClientId) {
        const superAdmin = userId ? await storage.getSuperAdminByUserId(userId) : null;
        if (!superAdmin) {
          return res.status(403).json({ message: "Only admins can assign contacts to specific clients" });
        }
        clientId = assignToClientId;
      } else {
        clientId = await getClientId(req);
      }

      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const notesParts: string[] = [];
      if (notes) notesParts.push(notes);
      if (kbCategoryId) notesParts.push(`[KB: ${kbCategoryId}]`);

      const contactData: any = {
        clientId,
        firstName,
        lastName,
        title: title || null,
        organization: organization || null,
        notes: notesParts.length > 0 ? notesParts.join('\n') : null,
      };

      const parsed = insertContactSchema.safeParse(contactData);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }
      // If the contact is a current member of Congress, attach the official portrait.
      if (!parsed.data.imageUrl) {
        parsed.data.imageUrl = await lookupMemberPortrait(parsed.data.firstName, parsed.data.lastName);
      }
      const contact = await storage.createContact(parsed.data);
      res.status(201).json({ success: true, contact });
    } catch (error) {
      console.error("Error creating contact from search:", error);
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

  // Bookmark/unbookmark article
  app.patch("/api/news/:id/bookmark", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      const article = await storage.getNewsArticle(req.params.id);
      if (!article || article.clientId !== clientId) {
        return res.status(404).json({ message: "Article not found" });
      }
      const updated = await storage.updateNewsArticle(req.params.id, { 
        isBookmarked: !article.isBookmarked 
      });
      res.json(updated);
    } catch (error) {
      console.error("Error bookmarking article:", error);
      res.status(500).json({ message: "Failed to bookmark article" });
    }
  });

  // Trigger news aggregation (fetch from all sources)
  app.post("/api/news/fetch", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const { hoursBack = 168 } = req.body; // Default to 7 days
      
      // Import and run aggregation
      const { aggregateAllNews, saveArticlesToDatabase, getClientRelevanceContext } = await import("./services/news-aggregation");
      
      console.log(`Manual news fetch triggered by client ${clientId}`);
      const articles = await aggregateAllNews(hoursBack);
      
      // Get relevance context from client's research
      const context = await getClientRelevanceContext(clientId);
      
      // Save to database
      const savedCount = await saveArticlesToDatabase(clientId, articles, context);
      
      res.json({ 
        message: "News aggregation complete",
        totalFetched: articles.length,
        newArticlesSaved: savedCount
      });
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  // ==================== RSS FEEDS MANAGEMENT ====================

  // Get all RSS feeds
  app.get("/api/rss-feeds", isAuthenticated, async (req, res) => {
    try {
      const feeds = await storage.getRssFeeds();
      res.json(feeds);
    } catch (error) {
      console.error("Error getting RSS feeds:", error);
      res.status(500).json({ message: "Failed to get RSS feeds" });
    }
  });

  // Test an RSS feed URL
  app.post("/api/rss-feeds/test", isAuthenticated, async (req, res) => {
    try {
      const { feedUrl } = req.body;
      if (!feedUrl) {
        return res.status(400).json({ message: "feedUrl is required" });
      }
      
      const { testRssFeed } = await import("./services/news-aggregation");
      const result = await testRssFeed(feedUrl);
      res.json(result);
    } catch (error) {
      console.error("Error testing RSS feed:", error);
      res.status(500).json({ message: "Failed to test RSS feed" });
    }
  });

  // Add a new RSS feed
  app.post("/api/rss-feeds", isAuthenticated, async (req, res) => {
    try {
      const { name, feedUrl, websiteUrl, category, tier } = req.body;
      if (!name || !feedUrl) {
        return res.status(400).json({ message: "name and feedUrl are required" });
      }
      
      // Test the feed first
      const { testRssFeed } = await import("./services/news-aggregation");
      const testResult = await testRssFeed(feedUrl);
      
      if (!testResult.success) {
        return res.status(400).json({ message: `Invalid RSS feed: ${testResult.error}` });
      }
      
      const feed = await storage.createRssFeed({
        name,
        feedUrl,
        websiteUrl,
        category: category || "politics",
        tier: tier || 2,
        isActive: true,
      });
      
      res.status(201).json({ feed, testResult });
    } catch (error) {
      console.error("Error adding RSS feed:", error);
      res.status(500).json({ message: "Failed to add RSS feed" });
    }
  });

  // Update an RSS feed
  app.patch("/api/rss-feeds/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const feed = await storage.updateRssFeed(id, req.body);
      if (!feed) {
        return res.status(404).json({ message: "RSS feed not found" });
      }
      res.json(feed);
    } catch (error) {
      console.error("Error updating RSS feed:", error);
      res.status(500).json({ message: "Failed to update RSS feed" });
    }
  });

  // Delete an RSS feed
  app.delete("/api/rss-feeds/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRssFeed(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting RSS feed:", error);
      res.status(500).json({ message: "Failed to delete RSS feed" });
    }
  });

  // ==================== RSS FEED CLIENT ASSIGNMENTS ====================

  // Get client assignments for a specific feed
  app.get("/api/rss-feeds/:id/assignments", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const assignments = await storage.getRssFeedClientAssignments(id);
      
      // Enrich with client names
      const enrichedAssignments = await Promise.all(
        assignments.map(async (a) => {
          const client = await storage.getClient(a.clientId);
          return { ...a, clientName: client?.name || "Unknown" };
        })
      );
      
      res.json(enrichedAssignments);
    } catch (error) {
      console.error("Error getting feed assignments:", error);
      res.status(500).json({ message: "Failed to get feed assignments" });
    }
  });

  // Assign a feed to a client
  app.post("/api/rss-feeds/:id/assignments", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { clientId } = req.body;
      const userId = getUserId(req);
      
      if (!clientId) {
        return res.status(400).json({ message: "Client ID is required" });
      }
      
      const assignment = await storage.assignRssFeedToClient(id, clientId, userId || "");
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning feed to client:", error);
      res.status(500).json({ message: "Failed to assign feed to client" });
    }
  });

  // Remove a feed assignment from a client
  app.delete("/api/rss-feeds/:feedId/assignments/:clientId", isAuthenticated, async (req, res) => {
    try {
      const { feedId, clientId } = req.params;
      await storage.unassignRssFeedFromClient(feedId, clientId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing feed assignment:", error);
      res.status(500).json({ message: "Failed to remove feed assignment" });
    }
  });

  // Get feeds assigned to the current client
  app.get("/api/client/assigned-feeds", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      const feeds = await storage.getClientRssFeeds(clientId);
      res.json(feeds);
    } catch (error) {
      console.error("Error getting client feeds:", error);
      res.status(500).json({ message: "Failed to get client feeds" });
    }
  });

  // ==================== NEWS PREFERENCES ====================

  // Get news preferences for client
  app.get("/api/news/preferences", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      let prefs = await storage.getNewsPreferences(clientId);
      
      // Create default preferences if none exist
      if (!prefs) {
        prefs = await storage.createNewsPreferences({
          clientId,
          alertThreshold: 70,
          emailAlerts: true,
          alertFrequency: "daily",
        });
      }
      
      res.json(prefs);
    } catch (error) {
      console.error("Error getting news preferences:", error);
      res.status(500).json({ message: "Failed to get news preferences" });
    }
  });

  // Update news preferences
  app.put("/api/news/preferences", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }
      
      let prefs = await storage.getNewsPreferences(clientId);
      
      if (prefs) {
        prefs = await storage.updateNewsPreferences(prefs.id, req.body);
      } else {
        prefs = await storage.createNewsPreferences({
          clientId,
          ...req.body,
        });
      }
      
      res.json(prefs);
    } catch (error) {
      console.error("Error updating news preferences:", error);
      res.status(500).json({ message: "Failed to update news preferences" });
    }
  });

  // ==================== HIGH INTENT KEYWORDS ROUTES ====================

  // Get high intent keywords
  app.get("/api/high-intent-keywords", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const keywords = await storage.getHighIntentKeywords(clientId);
      res.json(keywords);
    } catch (error) {
      console.error("Error getting high intent keywords:", error);
      res.status(500).json({ message: "Failed to get keywords" });
    }
  });

  // Create high intent keyword
  app.post("/api/high-intent-keywords", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const keyword = await storage.createHighIntentKeyword({ ...req.body, clientId });
      res.json(keyword);
    } catch (error) {
      console.error("Error creating high intent keyword:", error);
      res.status(500).json({ message: "Failed to create keyword" });
    }
  });

  // Update high intent keyword
  app.patch("/api/high-intent-keywords/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      
      const keywords = await storage.getHighIntentKeywords(clientId);
      const keyword = keywords.find(k => k.id === req.params.id);
      if (!keyword) return res.status(404).json({ message: "Keyword not found" });
      
      const updated = await storage.updateHighIntentKeyword(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating high intent keyword:", error);
      res.status(500).json({ message: "Failed to update keyword" });
    }
  });

  // Delete high intent keyword
  app.delete("/api/high-intent-keywords/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      
      const keywords = await storage.getHighIntentKeywords(clientId);
      const keyword = keywords.find(k => k.id === req.params.id);
      if (!keyword) return res.status(404).json({ message: "Keyword not found" });
      
      await storage.deleteHighIntentKeyword(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting high intent keyword:", error);
      res.status(500).json({ message: "Failed to delete keyword" });
    }
  });

  // ==================== ARTICLE PORTAL ASSIGNMENT ROUTES ====================

  // Get all article assignments for current client
  app.get("/api/news/assignments/all", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const assignments = await storage.getClientArticleAssignments(clientId);
      res.json(assignments);
    } catch (error) {
      console.error("Error getting client article assignments:", error);
      res.status(500).json({ message: "Failed to get assignments" });
    }
  });

  // Get article portal assignments
  app.get("/api/news/:articleId/assignments", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getArticlePortalAssignments(req.params.articleId);
      res.json(assignments);
    } catch (error) {
      console.error("Error getting article assignments:", error);
      res.status(500).json({ message: "Failed to get assignments" });
    }
  });

  // Assign article to portal
  app.post("/api/news/:articleId/assign-portal", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const userId = (req as any).userId;
      const { portalId } = req.body;
      const assignment = await storage.assignArticleToPortal(req.params.articleId, portalId, clientId, userId);
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning article to portal:", error);
      res.status(500).json({ message: "Failed to assign article" });
    }
  });

  // Unassign article from portal
  app.delete("/api/news/:articleId/assign-portal/:portalId", isAuthenticated, async (req, res) => {
    try {
      await storage.unassignArticleFromPortal(req.params.articleId, req.params.portalId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unassigning article from portal:", error);
      res.status(500).json({ message: "Failed to unassign article" });
    }
  });

  // Forward article via email
  app.post("/api/news/:articleId/forward", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      
      const article = await storage.getNewsArticle(req.params.articleId);
      if (!article) return res.status(404).json({ message: "Article not found" });
      
      const { email, message } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      
      // Use Resend to send the email
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: "news@governmentaffairs.co",
        to: email,
        subject: `Shared Article: ${article.title}`,
        html: `
          <h2>${article.title}</h2>
          <p><strong>Source:</strong> ${article.source || 'Unknown'}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <p>${article.summary || ''}</p>
          ${article.url ? `<p><a href="${article.url}">Read full article</a></p>` : ''}
        `,
      });
      
      res.json({ success: true, message: "Article forwarded successfully" });
    } catch (error) {
      console.error("Error forwarding article:", error);
      res.status(500).json({ message: "Failed to forward article" });
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

  // Research a staffer using Perplexity API
  app.post("/api/research/staffer", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const { name, title, organization, memberName, legistormId, customPrompt } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Staffer name is required" });
      }

      if (!process.env.PERPLEXITY_API_KEY) {
        return res.status(500).json({ message: "Perplexity API key not configured. Please contact your administrator." });
      }

      const { researchWithPerplexity } = await import("./services/research-agent");
      
      // Support custom prompts (e.g. for relationship intelligence / access strategy)
      if (customPrompt) {
        const result = await researchWithPerplexity(customPrompt);
        return res.json({
          success: true,
          data: { rawContent: result.content, bio: "", education: [], careerHistory: [], policyAreas: [], linkedinUrl: "" },
          sources: result.citations || []
        });
      }
      
      const researchPrompt = `Research the Congressional or political staffer named "${name}".

Current Position: ${title || 'Unknown'} at ${organization || 'Unknown'}
${memberName ? `Currently serving under: ${memberName}` : ''}

Please provide:
1. A brief biographical summary
2. Their educational background (universities, degrees, years if known)
3. Complete career history including previous positions on Capitol Hill, in campaigns, lobbying firms, or government agencies
4. Key policy areas or expertise they're known for
5. Any notable professional connections or colleagues
6. LinkedIn profile URL if available

Format your response as a structured summary with clear sections.`;

      const result = await researchWithPerplexity(researchPrompt);
      
      // Parse the Perplexity response into structured data for the frontend
      const parseCareerData = (content: string) => {
        const data: Record<string, unknown> = {
          bio: "",
          education: [],
          careerHistory: [],
          policyAreas: [],
          linkedinUrl: "",
          rawContent: content
        };
        
        // Extract bio (first paragraph or summary section)
        const bioMatch = content.match(/(?:Summary|Biography|Background)[:\s]*([^#\n]+(?:\n(?![A-Z#])[^\n]+)*)/i);
        if (bioMatch) {
          data.bio = bioMatch[1].trim();
        } else {
          // Take first substantial paragraph as bio
          const firstPara = content.split('\n\n')[0];
          if (firstPara && firstPara.length > 50) {
            data.bio = firstPara.trim();
          }
        }
        
        return data;
      };
      
      const parsedData = parseCareerData(result.content);
      
      // Auto-search LinkedIn via PDL if staffer doesn't already have one
      let linkedinUrl: string | null = null;
      try {
        const { db } = await import("./db");
        const { legistormStaffers } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        // Check if staffer already has a LinkedIn URL
        let existingLinkedin: string | null = null;
        if (legistormId) {
          const existing = await db.select({ linkedinUrl: legistormStaffers.linkedinUrl })
            .from(legistormStaffers)
            .where(eq(legistormStaffers.legistormId, parseInt(legistormId)))
            .limit(1);
          existingLinkedin = existing[0]?.linkedinUrl || null;
        }

        if (!existingLinkedin && process.env.PDL_API_KEY) {
          console.log("[Staffer Research] Auto-searching LinkedIn for:", name);
          try {
            const { researchLinkedInProfile } = await import("./services/linkedin-service");
            const nameParts = name.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";
            let org = organization || memberName || "US Congress";
            if (org.toLowerCase().includes("office of")) {
              org = "US Congress";
            }
            const liResult = await researchLinkedInProfile(firstName, lastName, org);
            if (liResult.profileUrl) {
              linkedinUrl = liResult.profileUrl;
              console.log("[Staffer Research] LinkedIn found:", linkedinUrl);
              if (legistormId) {
                await db.update(legistormStaffers)
                  .set({ linkedinUrl: liResult.profileUrl })
                  .where(eq(legistormStaffers.legistormId, parseInt(legistormId)));
              }
            }
          } catch (liErr: any) {
            console.error("[Staffer Research] LinkedIn auto-search failed (non-blocking):", liErr?.message);
          }
        } else if (existingLinkedin) {
          linkedinUrl = existingLinkedin;
        }
        
        // Save research to legistorm_staffers table
        if (legistormId) {
          await db.update(legistormStaffers)
            .set({ careerResearch: result.content, careerResearchedAt: new Date() })
            .where(eq(legistormStaffers.legistormId, parseInt(legistormId)));
        } else {
          const matchName = name.trim();
          const matches = await db.select({ id: legistormStaffers.id }).from(legistormStaffers).where(eq(legistormStaffers.fullName, matchName)).limit(1);
          if (matches.length > 0) {
            await db.update(legistormStaffers)
              .set({ careerResearch: result.content, careerResearchedAt: new Date() })
              .where(eq(legistormStaffers.id, matches[0].id));
          }
        }
      } catch (saveErr) {
        console.error("[Staffer Research] Could not save research:", saveErr);
      }
      
      res.json({
        success: true,
        data: { ...parsedData, linkedinUrl },
        sources: result.citations || []
      });
    } catch (error: any) {
      console.error("[Staffer Research] ERROR:", error?.message || error);
      const errMsg = error?.message || "Failed to research staffer";
      if (errMsg.includes("Perplexity")) {
        res.status(502).json({ message: "AI research service temporarily unavailable. Please try again." });
      } else {
        res.status(500).json({ message: errMsg });
      }
    }
  });

  // Search career research data across staffers
  app.get("/api/staffers/career-search", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const query = (req.query.q as string || "").trim();
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const { db } = await import("./db");
      const { legistormStaffers } = await import("@shared/schema");
      const { ilike, and } = await import("drizzle-orm");

      const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
      
      const conditions = keywords.map(kw => ilike(legistormStaffers.careerResearch, `%${kw}%`));
      
      const results = await db.select({
        id: legistormStaffers.id,
        fullName: legistormStaffers.fullName,
        currentTitle: legistormStaffers.currentTitle,
        currentOffice: legistormStaffers.currentOffice,
        currentMemberName: legistormStaffers.currentMemberName,
        chamber: legistormStaffers.chamber,
        party: legistormStaffers.party,
        state: legistormStaffers.state,
        careerResearch: legistormStaffers.careerResearch,
      })
      .from(legistormStaffers)
      .where(and(...conditions))
      .limit(50);

      const matched = results.map(r => ({
        ...r,
        careerResearchSnippet: extractRelevantSnippet(r.careerResearch || "", keywords),
        careerResearch: undefined,
      }));

      res.json({ results: matched, total: matched.length });
    } catch (error: any) {
      console.error("Career search error:", error);
      res.status(500).json({ message: "Career search failed" });
    }
  });

  // Research a staffer using LinkedIn via Proxycurl API
  app.post("/api/research/linkedin", isAuthenticated, async (req, res) => {
    console.log("[LinkedIn Research] Request received:", JSON.stringify(req.body));
    try {
      const clientId = await getClientId(req);
      if (!clientId) {
        return res.status(403).json({ message: "Not assigned to a client" });
      }

      const { firstName, lastName, organization, linkedinUrl } = req.body;
      
      if (!linkedinUrl && (!firstName || !lastName)) {
        return res.status(400).json({ message: "Either a LinkedIn URL or first and last name are required" });
      }

      console.log("[LinkedIn Research] API key present:", !!process.env.PDL_API_KEY);
      
      if (!process.env.PDL_API_KEY) {
        return res.status(400).json({ 
          message: "LinkedIn research requires a People Data Labs API key. Please add PDL_API_KEY to your secrets." 
        });
      }

      const { 
        researchLinkedInProfile, 
        enrichLinkedInProfile,
        formatCareerTimeline,
        formatEducation,
        analyzeCareerPatterns 
      } = await import("./services/linkedin-service");

      let profile;
      let profileUrl = linkedinUrl || null;

      if (linkedinUrl) {
        console.log("[LinkedIn Research] Enriching existing URL:", linkedinUrl);
        profile = await enrichLinkedInProfile(linkedinUrl);
      } else {
        console.log("[LinkedIn Research] Looking up profile for:", firstName, lastName);
        const result = await researchLinkedInProfile(firstName!, lastName!, organization);
        profile = result.profile;
        profileUrl = result.profileUrl;
        
        if (result.error) {
          return res.json({
            success: false,
            error: result.error,
            message: result.error
          });
        }
      }

      const displayName = firstName && lastName ? `${firstName} ${lastName}` : (profile?.full_name || "this person");

      if (!profile) {
        return res.json({
          success: false,
          error: "Profile not found",
          message: `Could not find LinkedIn profile for ${displayName}`
        });
      }

      // Format and analyze the career data
      const careerTimeline = formatCareerTimeline(profile.experiences);
      const educationFormatted = formatEducation(profile.education);
      const careerAnalysis = analyzeCareerPatterns(profile);

      res.json({
        success: true,
        data: {
          profileUrl: profileUrl || profile.linkedin_url,
          fullName: profile.full_name,
          headline: profile.headline,
          summary: profile.summary,
          location: [profile.city, profile.state, profile.country].filter(Boolean).join(", "),
          profilePicUrl: profile.profile_pic_url,
          experiences: profile.experiences,
          education: profile.education,
          skills: profile.skills,
          careerTimeline,
          educationFormatted,
          careerAnalysis,
          connections: profile.connections,
        }
      });
    } catch (error: any) {
      console.error("[LinkedIn Research] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to research LinkedIn profile" });
    }
  });

  // ==================== COMPANY ENRICHMENT ROUTES ====================

  const companyEnrichmentSchema = z.object({
    companyName: z.string().optional(),
    website: z.string().url().optional(),
    linkedinUrl: z.string().url().optional(),
  }).refine(data => data.companyName || data.website || data.linkedinUrl, {
    message: "Company name, website, or LinkedIn URL required"
  });

  // Enrich company profile using People Data Labs
  app.post("/api/research/company", isAuthenticated, async (req, res) => {
    try {
      const parsed = companyEnrichmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const { companyName, website, linkedinUrl } = parsed.data;

      const { enrichCompany } = await import("./services/linkedin-service");
      
      let company = null;
      
      // Try different identifiers in order of specificity
      if (linkedinUrl) {
        company = await enrichCompany(linkedinUrl, "linkedin");
      }
      if (!company && website) {
        company = await enrichCompany(website, "website");
      }
      if (!company && companyName) {
        company = await enrichCompany(companyName, "name");
      }

      if (!company) {
        return res.json({
          success: false,
          message: `Could not find company information for ${companyName || website || linkedinUrl}`,
        });
      }

      res.json({
        success: true,
        data: company,
      });
    } catch (error: any) {
      console.error("[Company Enrichment] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to enrich company profile" });
    }
  });

  // ==================== PERSON SEARCH ROUTES ====================

  const personSearchSchema = z.object({
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    location: z.string().optional(),
    industry: z.string().optional(),
    school: z.string().optional(),
    skills: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional().default(20),
  }).refine(data => data.company || data.jobTitle || data.location || data.industry || data.school, {
    message: "At least one search criterion required"
  });

  // Search for people by criteria (e.g., find former colleagues)
  app.post("/api/research/people/search", isAuthenticated, async (req, res) => {
    try {
      const parsed = personSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const { company, jobTitle, location, industry, school, skills, limit } = parsed.data;

      const { searchPeople } = await import("./services/linkedin-service");
      
      const results = await searchPeople({
        company,
        jobTitle,
        location,
        industry,
        school,
        skills,
        limit,
      });

      res.json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (error: any) {
      console.error("[Person Search] ERROR:", error?.message || error);
      res.status(500).json({ success: false, message: error?.message || "Failed to search for people" });
    }
  });

  const formerColleaguesSchema = z.object({
    companyName: z.string().min(1, "Company name required"),
    limit: z.number().min(1).max(100).optional().default(20),
  });

  // Find former colleagues from a specific organization
  app.post("/api/research/former-colleagues", isAuthenticated, async (req, res) => {
    try {
      const parsed = formerColleaguesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const { companyName, limit } = parsed.data;

      const { findFormerColleagues } = await import("./services/linkedin-service");
      
      const results = await findFormerColleagues(companyName, limit);

      res.json({
        success: true,
        count: results.length,
        message: `Found ${results.length} people who worked at ${companyName}`,
        data: results,
      });
    } catch (error: any) {
      console.error("[Former Colleagues] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to find former colleagues" });
    }
  });

  // ==================== POLITICAL ORGANIZATIONS ROUTES ====================

  app.get("/api/organizations", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      const orgs = await storage.getPoliticalOrganizations(clientId || undefined);
      res.json(orgs);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch organizations" });
    }
  });

  async function getOrgWithTenantCheck(req: any, orgId: string) {
    const clientId = await getClientId(req);
    if (!clientId) return null;
    const org = await storage.getPoliticalOrganization(orgId, clientId);
    return org || null;
  }

  app.get("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const org = await getOrgWithTenantCheck(req, req.params.id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch organization" });
    }
  });

  const createOrgSchema = z.object({
    name: z.string().min(1),
    orgType: z.string().optional(),
    website: z.string().optional(),
    linkedinUrl: z.string().optional(),
  });

  app.post("/api/organizations", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      const parsed = createOrgSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const existing = await storage.getPoliticalOrganizationByName(parsed.data.name, clientId);
      if (existing) {
        return res.status(409).json({ message: "Organization already tracked", data: existing });
      }
      const org = await storage.createPoliticalOrganization({
        ...parsed.data,
        clientId,
        isTracked: true,
      });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create organization" });
    }
  });

  const updateOrgSchema = z.object({
    name: z.string().optional(),
    orgType: z.string().optional(),
    website: z.string().optional(),
    linkedinUrl: z.string().optional(),
    industry: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    isTracked: z.boolean().optional(),
  });

  app.patch("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const existing = await getOrgWithTenantCheck(req, req.params.id);
      if (!existing) return res.status(404).json({ message: "Organization not found" });
      const parsed = updateOrgSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const org = await storage.updatePoliticalOrganization(req.params.id, clientId, parsed.data);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to update organization" });
    }
  });

  app.delete("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const existing = await getOrgWithTenantCheck(req, req.params.id);
      if (!existing) return res.status(404).json({ message: "Organization not found" });
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      await storage.deletePoliticalOrganization(req.params.id, clientId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to delete organization" });
    }
  });

  app.post("/api/organizations/enrich", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const parsed = z.object({
        name: z.string().optional(),
        website: z.string().optional(),
        linkedinUrl: z.string().optional(),
        saveToTracked: z.boolean().optional().default(false),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Name, website, or LinkedIn URL required" });
      }
      const { name, website, linkedinUrl, saveToTracked } = parsed.data;
      if (!name && !website && !linkedinUrl) {
        return res.status(400).json({ message: "At least one identifier is required" });
      }

      const { enrichCompany } = await import("./services/linkedin-service");
      let company = null;
      if (linkedinUrl) company = await enrichCompany(linkedinUrl, "linkedin");
      if (!company && website) company = await enrichCompany(website, "website");
      if (!company && name) company = await enrichCompany(name, "name");

      if (!company) {
        return res.json({ success: false, message: "Organization not found in PDL database" });
      }

      if (saveToTracked) {
        const existing = await storage.getPoliticalOrganizationByName(company.name, clientId);
        if (existing) {
          const updated = await storage.updatePoliticalOrganization(existing.id, clientId, {
            website: company.website || existing.website,
            linkedinUrl: company.linkedinUrl || existing.linkedinUrl,
            industry: company.industry || existing.industry,
            description: company.description || existing.description,
            employeeCount: company.employeeCount || existing.employeeCount,
            employeeCountRange: company.employeeCountRange || existing.employeeCountRange,
            founded: company.founded || existing.founded,
            headquartersCity: company.headquarters?.city || existing.headquartersCity,
            headquartersState: company.headquarters?.state || existing.headquartersState,
            headquartersCountry: company.headquarters?.country || existing.headquartersCountry,
            tags: company.tags || existing.tags,
            naicsCode: company.naicsCode || existing.naicsCode,
            sicCode: company.sicCode || existing.sicCode,
            isLobbyingFirm: company.politicalClassification?.isLobbyingFirm || existing.isLobbyingFirm,
            isPAC: company.politicalClassification?.isPAC || existing.isPAC,
            isThinkTank: company.politicalClassification?.isThinkTank || existing.isThinkTank,
            isGovernmentAgency: company.politicalClassification?.isGovernmentAgency || existing.isGovernmentAgency,
            isPoliticalOrg: company.politicalClassification?.isPoliticalOrg || existing.isPoliticalOrg,
            isCampaign: company.politicalClassification?.isCampaign || existing.isCampaign,
            pdlEnriched: true,
          });
          return res.json({ success: true, data: company, saved: updated });
        }

        const orgType = company.politicalClassification?.isLobbyingFirm ? "Lobbying Firm"
          : company.politicalClassification?.isPAC ? "PAC"
          : company.politicalClassification?.isThinkTank ? "Think Tank"
          : company.politicalClassification?.isGovernmentAgency ? "Government Agency"
          : company.politicalClassification?.isPoliticalOrg ? "Political Organization"
          : company.politicalClassification?.isCampaign ? "Campaign"
          : company.industry || "Organization";

        const saved = await storage.createPoliticalOrganization({
          clientId,
          name: company.name,
          orgType,
          website: company.website,
          linkedinUrl: company.linkedinUrl,
          industry: company.industry,
          description: company.description,
          employeeCount: company.employeeCount,
          employeeCountRange: company.employeeCountRange,
          founded: company.founded,
          headquartersCity: company.headquarters?.city,
          headquartersState: company.headquarters?.state,
          headquartersCountry: company.headquarters?.country,
          tags: company.tags,
          naicsCode: company.naicsCode,
          sicCode: company.sicCode,
          isLobbyingFirm: company.politicalClassification?.isLobbyingFirm || false,
          isPAC: company.politicalClassification?.isPAC || false,
          isThinkTank: company.politicalClassification?.isThinkTank || false,
          isGovernmentAgency: company.politicalClassification?.isGovernmentAgency || false,
          isPoliticalOrg: company.politicalClassification?.isPoliticalOrg || false,
          isCampaign: company.politicalClassification?.isCampaign || false,
          pdlEnriched: true,
          isTracked: true,
        });
        return res.json({ success: true, data: company, saved });
      }

      res.json({ success: true, data: company });
    } catch (error: any) {
      console.error("[Org Enrichment] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to enrich organization" });
    }
  });

  app.post("/api/organizations/:id/people", isAuthenticated, async (req, res) => {
    try {
      const org = await getOrgWithTenantCheck(req, req.params.id);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const { searchPeople } = await import("./services/linkedin-service");
      const parsed = z.object({
        jobTitle: z.string().optional(),
        limit: z.number().min(1).max(50).optional().default(20),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request body" });
      }

      const results = await searchPeople({
        company: org.name,
        jobTitle: parsed.data.jobTitle,
        limit: parsed.data.limit,
      });

      res.json({ success: true, count: results.length, data: results });
    } catch (error: any) {
      console.error("[Org People] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to find people" });
    }
  });

  app.post("/api/organizations/:id/ai-research", isAuthenticated, async (req, res) => {
    try {
      const org = await getOrgWithTenantCheck(req, req.params.id);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const entityType = org.isLobbyingFirm ? "lobbying firm"
        : org.isPAC ? "political action committee"
        : org.isThinkTank ? "think tank"
        : org.isGovernmentAgency ? "government agency"
        : "political organization";

      const { researchPoliticalEntity } = await import("./services/research-agent");
      const result = await researchPoliticalEntity(org.name, entityType);

      if (result.summary) {
        const clientId = await getClientId(req);
        if (clientId) {
          await storage.updatePoliticalOrganization(org.id, clientId, {
            aiSummary: result.summary,
            aiSources: result.sources || [],
          });
        }
      }

      res.json({ success: true, summary: result.summary, sources: result.sources });
    } catch (error: any) {
      console.error("[Org AI Research] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to research organization" });
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
      
      // Check if the query is about staffers/careers - augment with local data
      const stafferKeywords = ["staffer", "staff", "worked with", "worked on", "energy", "health", "defense", "education", "agriculture", "finance", "transportation", "judiciary", "appropriations", "commerce", "foreign", "veteran", "environment", "tax", "budget", "immigration", "technology", "cyber", "housing", "labor", "committee", "bill", "policy", "career"];
      const isStafferQuery = stafferKeywords.some(kw => prompt.toLowerCase().includes(kw));
      
      let careerContext = "";
      if (isStafferQuery) {
        try {
          const { db } = await import("./db");
          const { legistormStaffers } = await import("@shared/schema");
          const { ilike, and: andOp } = await import("drizzle-orm");
          const queryWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          
          if (queryWords.length > 0) {
            const conditions = queryWords.map(kw => ilike(legistormStaffers.careerResearch, `%${kw}%`));
            
            const relevant = await db.select({
              fullName: legistormStaffers.fullName,
              currentTitle: legistormStaffers.currentTitle,
              currentOffice: legistormStaffers.currentOffice,
              currentMemberName: legistormStaffers.currentMemberName,
              chamber: legistormStaffers.chamber,
              party: legistormStaffers.party,
              state: legistormStaffers.state,
              careerResearch: legistormStaffers.careerResearch,
            })
            .from(legistormStaffers)
            .where(andOp(...conditions))
            .limit(10);
            
            if (relevant.length > 0) {
              const MAX_CONTEXT = 6000;
              let totalLen = 0;
              const entries: string[] = [];
              for (const s of relevant) {
                const research = (s.careerResearch || "").slice(0, 600);
                const entry = `STAFFER: ${s.fullName} | ${s.currentTitle || "N/A"} | ${s.currentOffice || "N/A"} | ${s.currentMemberName || "N/A"} | ${s.chamber || "N/A"} | ${s.party || "N/A"} | ${s.state || "N/A"}\nRESEARCH: ${research}`;
                if (totalLen + entry.length > MAX_CONTEXT) break;
                entries.push(entry);
                totalLen += entry.length;
              }
              careerContext = "\n\n--- LOCAL CAREER RESEARCH DATA ---\nThe following staffers have career research data matching the query. Use this data to answer:\n\n" + entries.join("\n---\n");
            }
          }
        } catch (dbErr) {
          console.error("Error fetching career research for agent:", dbErr);
        }
      }
      
      const augmentedPrompt = careerContext 
        ? `${prompt}\n\nIMPORTANT: First check and prioritize the local career research data below when answering. If the local data contains relevant staffers, include them in your response with their details.${careerContext}`
        : prompt;
      
      const result = await runAgentQuery(augmentedPrompt, schema as any);

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

  // Portal Dashboard - Get only articles assigned/shared to this specific portal
  app.get("/api/public/portal/:clientSlug/:portalSlug/news", async (req, res) => {
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

      // Only return articles that have been explicitly assigned to this portal
      const assignedArticles = await storage.getPortalArticles(portal.id);
      
      res.json(assignedArticles.map(a => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        source: a.source,
        url: a.url,
        relevanceScore: a.relevanceScore,
        publishedAt: a.publishedAt,
        isRead: a.isRead,
      })));
    } catch (error) {
      console.error("Error getting portal news:", error);
      res.status(500).json({ message: "Failed to get news" });
    }
  });

  // Portal Dashboard - Get tracked bills for client
  app.get("/api/public/portal/:clientSlug/:portalSlug/bills", async (req, res) => {
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

      // Get only bills shared with this specific portal
      const portalBillAssignments = await storage.getPortalTrackedBills(portal.id);
      const allBills = await storage.getTrackedBills(client.id);
      const assignedBillIds = new Set(portalBillAssignments.map(a => a.trackedBillId));
      const sharedBills = allBills.filter(b => assignedBillIds.has(b.id));
      
      res.json(sharedBills.map(b => ({
        id: b.id,
        congress: b.congress,
        billType: b.billType,
        billNumber: b.billNumber,
        title: b.title,
        status: b.status,
        sponsor: b.sponsor,
        sponsorParty: b.sponsorParty,
        sponsorState: b.sponsorState,
        policyArea: b.policyArea,
        latestAction: b.latestAction,
        latestActionDate: b.latestActionDate,
        introducedDate: b.introducedDate,
      })));
    } catch (error) {
      console.error("Error getting portal bills:", error);
      res.status(500).json({ message: "Failed to get bills" });
    }
  });

  // Portal Dashboard - Get assigned committee meetings
  app.get("/api/public/portal/:clientSlug/:portalSlug/meetings", async (req, res) => {
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

      // Get committee meetings assigned to this portal
      const meetings = await storage.getPortalMeetings(portal.id);
      
      res.json(meetings);
    } catch (error) {
      console.error("Error getting portal meetings:", error);
      res.status(500).json({ message: "Failed to get meetings" });
    }
  });

  // Portal Dashboard - Get stats summary
  app.get("/api/public/portal/:clientSlug/:portalSlug/stats", async (req, res) => {
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

      // Get matter count
      const portalMatters = await storage.getPortalMatterAccess(portal.id);
      
      // Get assigned feeds
      const clientFeeds = await storage.getClientRssFeeds(client.id);
      
      // Get tracked bills shared with this portal
      const portalBills = await storage.getPortalTrackedBills(portal.id);
      
      // Get recent articles count
      const articles = await storage.getNewsArticles(client.id);
      const recentArticles = articles.filter(a => {
        const pubDate = a.publishedAt ? new Date(a.publishedAt) : null;
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return pubDate && pubDate > dayAgo;
      });

      res.json({
        totalMatters: portalMatters.length,
        totalFeeds: clientFeeds.length,
        totalBills: portalBills.length,
        recentArticles: recentArticles.length,
        highPriorityBills: 0,
      });
    } catch (error) {
      console.error("Error getting portal stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
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

      // Get news articles ONLY from assigned RSS feeds for this client
      // Strict scoping: if no feeds assigned or no matching articles, provide no news context
      const clientFeeds = await storage.getClientRssFeeds(client.id);
      const allArticles = await storage.getNewsArticles(client.id);
      
      let clientNews: any[] = [];
      if (clientFeeds.length > 0) {
        // Get feed IDs that are assigned to this client
        const assignedFeedIds = clientFeeds.map(f => f.id);
        const feedNames = clientFeeds.map(f => f.name.toLowerCase());
        
        // Filter articles by assigned feed sources only
        clientNews = allArticles.filter(a => 
          a.source && feedNames.some(name => 
            a.source!.toLowerCase().includes(name) || name.includes(a.source!.toLowerCase())
          )
        );
        // NO fallback - if no matches, client sees no news (strict scoping to assigned feeds only)
      }
      // If no feeds assigned, clientNews stays empty (strict scoping)
      
      // Limit to most recent 20 articles for context
      if (clientNews.length > 0) {
        clientNews = clientNews
          .sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 20);
      }

      // Get tracked bills for this client
      const clientBills = await storage.getTrackedBills(client.id);

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

      // Build news context
      const newsContext = clientNews.length > 0 
        ? clientNews.map((article, i) => 
            `[News ${i + 1}: ${article.title}]\nSource: ${article.source || 'Unknown'}\nDate: ${article.publishedAt || 'Unknown'}\n${article.summary || ''}`
          ).join("\n\n")
        : "";

      // Build bills context with Congress.gov links
      const billsContext = clientBills.length > 0
        ? clientBills.map((bill, i) => {
            // Generate Congress.gov URL from bill info
            const billType = (bill.billType || 'hr').toLowerCase();
            const congress = bill.congress || 119;
            const billNumber = bill.billNumber || '';
            const congressGovUrl = `https://www.congress.gov/bill/${congress}th-congress/${billType === 'hr' ? 'house-bill' : billType === 's' ? 'senate-bill' : billType === 'hres' ? 'house-resolution' : billType === 'sres' ? 'senate-resolution' : billType}/${billNumber}`;
            
            return `**${bill.title}** (${bill.billId})\n- **Sponsor:** ${bill.sponsor || 'Unknown'}\n- **Status:** ${bill.status || 'Unknown'}\n- **Chamber:** ${bill.chamber || 'Unknown'}\n- **Last Action:** ${bill.lastActionDate || 'Unknown'}\n- **Link:** [View on Congress.gov](${congressGovUrl})`;
          }).join("\n\n")
        : "";

      // Combine all context
      const fullContext = [
        documentContext ? `## Research Documents\n${documentContext}` : "",
        newsContext ? `## Recent News\n${newsContext}` : "",
        billsContext ? `## Tracked Legislation\n${billsContext}` : ""
      ].filter(Boolean).join("\n\n---\n\n");

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const { chatWithPortalContext } = await import("./services/research-agent");
      
      let fullResponse = "";
      for await (const chunk of chatWithPortalContext(
        message,
        fullContext,
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

      const systemPrompt = `You are the research assistant inside GovernmentAffairs.co, a political intelligence platform for government-affairs professionals.

YOUR DATA ACCESS:
- You have DIRECT access to the platform's LegiStorm congressional staff directory (~17,900 staffers) via the search_staffer_directory tool. For ANY question about staffers, who works for a member, schedulers, chiefs of staff, or reaching an office: USE THE TOOL. Never answer staffing questions from memory, and never tell the user to "check LegiStorm" — this platform IS their LegiStorm access.
- When you present directory results, mention they come from the platform's staff directory and note the sync date if relevant.
- The app renders every directory record you retrieve as a card below your reply (name, title, office, email, sync date). Do NOT restate the full roster in prose — give a short 2-4 sentence summary (who leads the office, notable structure, who fits the user's ask) and let the cards carry the list.

STYLE:
1. Cite sources for facts and legislation as [Source: description]
2. Be concise but thorough
3. Do NOT use markdown tables — use short lists or bolded lines instead
4. Links: plain [text](url) form only — NEVER nest link syntax inside link syntax
5. Avoid horizontal-rule dividers (---); use bold lead-ins or headings sparingly
6. If something is from general knowledge rather than platform data, say so

${context ? `Context from recent research:\n${context}` : ""}`;

      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...(history || []).map((h: any) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user" as const, content: message },
      ];

      let reply = "";
      let usedProvider = "unknown";
      let staffers: any[] = [];

      try {
        const { providerConfig, completeChat, AI_MODELS } = await import("./services/ai-providers");
        if (providerConfig("anthropic")) {
          // Grounded path: Claude + directory tool access.
          const { groundedChat } = await import("./services/grounded-chat");
          const result = await groundedChat(chatMessages, { maxTokens: 2000 });
          reply = result.text;
          usedProvider = result.provider;
          staffers = result.staffers;
        } else {
          // Fallback: plain completion via whatever provider is configured.
          const result = await completeChat(chatMessages, { maxTokens: 1500 });
          reply = result.text;
          usedProvider = `${result.provider} (${AI_MODELS[result.provider]})`;
        }
      } catch (providerError) {
        console.error("AI chat: all providers failed:", providerError);
      }

      if (!reply) {
        return res.status(500).json({ message: "I couldn't generate a response. Please try again." });
      }

      res.json({ response: reply, provider: usedProvider, staffers });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Which AI providers are actually configured (drives the chat's model picker)
  app.get("/api/ai/providers", isAuthenticated, async (_req, res) => {
    const { availableProviders } = await import("./services/ai-providers");
    res.json({ providers: availableProviders() });
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

  // ========== Portal Bill Sharing ==========

  // Get portals a bill is shared with
  app.get("/api/tracked-bills/:id/portals", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getPortalTrackedBillsByBill(req.params.id);
      res.json(assignments);
    } catch (error) {
      console.error("Error getting bill portal assignments:", error);
      res.status(500).json({ message: "Failed to get portal assignments" });
    }
  });

  // Share a bill with a portal
  app.post("/api/tracked-bills/:id/portals", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      const { portalId } = req.body;
      if (!portalId) return res.status(400).json({ message: "portalId is required" });

      // Verify the bill belongs to this client
      const bill = await storage.getTrackedBill(req.params.id);
      if (!bill || bill.clientId !== clientId) {
        return res.status(403).json({ message: "Bill not found or unauthorized" });
      }

      // Verify the portal belongs to this client
      const portal = await storage.getClientPortal(portalId);
      if (!portal || portal.clientId !== clientId) {
        return res.status(403).json({ message: "Portal not found or unauthorized" });
      }

      const existing = await storage.getPortalTrackedBills(portalId);
      if (existing.some(a => a.trackedBillId === req.params.id)) {
        return res.status(400).json({ message: "Bill already shared with this portal" });
      }

      const assignment = await storage.createPortalTrackedBill({
        portalId,
        trackedBillId: req.params.id,
      });
      res.json(assignment);
    } catch (error) {
      console.error("Error sharing bill with portal:", error);
      res.status(500).json({ message: "Failed to share bill" });
    }
  });

  // Unshare a bill from a portal
  app.delete("/api/tracked-bills/:id/portals/:assignmentId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });

      // Verify the bill belongs to this client before removing assignment
      const bill = await storage.getTrackedBill(req.params.id);
      if (!bill || bill.clientId !== clientId) {
        return res.status(403).json({ message: "Bill not found or unauthorized" });
      }

      await storage.deletePortalTrackedBill(req.params.assignmentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsharing bill from portal:", error);
      res.status(500).json({ message: "Failed to unshare bill" });
    }
  });

  // ========== House Staff Directory ==========

  app.get("/api/congress/staff-directory/sync", isAuthenticated, async (req, res) => {
    try {
      const { syncHouseDirectoryToDb } = await import("./services/house-directory-service");
      const result = await syncHouseDirectoryToDb();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error syncing House directory:", error);
      res.status(500).json({ message: error.message || "Failed to sync House directory" });
    }
  });

  app.get("/api/congress/staff-directory/stats", isAuthenticated, async (req, res) => {
    try {
      const { getDirectoryStats } = await import("./services/house-directory-service");
      const stats = await getDirectoryStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get directory stats" });
    }
  });

  app.get("/api/congress/staff-directory/lookup", isAuthenticated, async (req, res) => {
    try {
      const { lastName, firstName, state } = req.query;
      if (!lastName) {
        return res.status(400).json({ message: "lastName is required" });
      }
      const { lookupStaffByMember } = await import("./services/house-directory-service");
      const staff = await lookupStaffByMember(
        lastName as string,
        firstName as string | undefined,
        state as string | undefined
      );
      res.json({ success: true, staff, count: staff.length });
    } catch (error: any) {
      console.error("Error looking up staff:", error);
      res.status(500).json({ message: error.message || "Failed to look up staff" });
    }
  });

  app.get("/api/congress/staff-directory/by-office", isAuthenticated, async (req, res) => {
    try {
      const { officeCode } = req.query;
      if (!officeCode) {
        return res.status(400).json({ message: "officeCode is required" });
      }
      const { lookupStaffByOfficeCode } = await import("./services/house-directory-service");
      const staff = await lookupStaffByOfficeCode(officeCode as string);
      res.json({ success: true, staff, count: staff.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to look up staff by office" });
    }
  });

  app.get("/api/congress/staff-directory/search", isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Search query (q) is required" });
      }
      const { searchStaffDirectory } = await import("./services/house-directory-service");
      const staff = await searchStaffDirectory(q as string);
      res.json({ success: true, staff, count: staff.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to search staff directory" });
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

  // ========== Congressional Schedules ==========

  // Get committee meetings (House or Senate) with full details
  app.get("/api/congress/schedule/committee-meetings", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Congress API key not configured" });
      }

      const chamber = req.query.chamber as string || "house";
      const congress = req.query.congress as string || "119";
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
      const search = req.query.search as string || "";
      const startDate = req.query.startDate as string || "";
      const endDate = req.query.endDate as string || "";

      // Build API URL with optional date filtering
      let apiUrl = `https://api.congress.gov/v3/committee-meeting/${congress}/${chamber}?api_key=${apiKey}&limit=${limit}&format=json`;
      
      // Congress API supports fromDateTime and toDateTime params
      if (startDate) {
        apiUrl += `&fromDateTime=${startDate}T00:00:00Z`;
      }
      if (endDate) {
        apiUrl += `&toDateTime=${endDate}T23:59:59Z`;
      }

      // First get the list of meetings
      const listResponse = await fetch(apiUrl);

      if (!listResponse.ok) {
        throw new Error(`Congress API error: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      const meetings = listData.committeeMeetings || [];

      // Fetch full details for each meeting (limit to 15 for performance)
      const detailedMeetings = await Promise.all(
        meetings.slice(0, limit).map(async (meeting: any) => {
          try {
            const detailResponse = await fetch(
              `https://api.congress.gov/v3/committee-meeting/${congress}/${chamber}/${meeting.eventId}?api_key=${apiKey}&format=json`
            );
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              return detailData.committeeMeeting;
            }
            return meeting;
          } catch {
            return meeting;
          }
        })
      );

      // Filter by search if provided
      let filtered = detailedMeetings;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = detailedMeetings.filter((m: any) => 
          m.title?.toLowerCase().includes(searchLower) ||
          m.committees?.some((c: any) => c.name?.toLowerCase().includes(searchLower)) ||
          m.witnesses?.some((w: any) => w.name?.toLowerCase().includes(searchLower) || w.organization?.toLowerCase().includes(searchLower))
        );
      }

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching committee meetings:", error);
      res.status(500).json({ message: "Failed to fetch committee meetings" });
    }
  });

  // Get 2026 Congressional Session Calendar (119th Congress, 2nd Session)
  app.get("/api/congress/schedule/calendar", isAuthenticated, async (_req, res) => {
    try {
      // 2026 Congressional Calendar - 119th Congress, 2nd Session
      // Session periods (Congress in DC) vs. District Work Periods (recess - members in home districts)
      const calendar2026 = {
        congress: 119,
        session: 2,
        year: 2026,
        periods: [
          { start: "2026-01-06", end: "2026-01-16", type: "session", description: "Session begins" },
          { start: "2026-01-19", end: "2026-01-23", type: "recess", description: "Martin Luther King Jr. Day District Work Period" },
          { start: "2026-01-26", end: "2026-02-13", type: "session", description: "Legislative session" },
          { start: "2026-02-16", end: "2026-02-20", type: "recess", description: "Presidents' Day District Work Period" },
          { start: "2026-02-23", end: "2026-03-27", type: "session", description: "Legislative session" },
          { start: "2026-03-30", end: "2026-04-10", type: "recess", description: "Spring District Work Period" },
          { start: "2026-04-13", end: "2026-05-22", type: "session", description: "Legislative session" },
          { start: "2026-05-25", end: "2026-05-29", type: "recess", description: "Memorial Day District Work Period" },
          { start: "2026-06-01", end: "2026-07-03", type: "session", description: "Legislative session" },
          { start: "2026-07-06", end: "2026-07-10", type: "recess", description: "Independence Day District Work Period" },
          { start: "2026-07-13", end: "2026-07-31", type: "session", description: "Legislative session" },
          { start: "2026-08-03", end: "2026-09-04", type: "recess", description: "August District Work Period" },
          { start: "2026-09-08", end: "2026-10-02", type: "session", description: "Legislative session" },
          { start: "2026-10-05", end: "2026-11-13", type: "recess", description: "Pre-Election District Work Period" },
          { start: "2026-11-16", end: "2026-11-20", type: "session", description: "Lame Duck Session" },
          { start: "2026-11-23", end: "2026-11-27", type: "recess", description: "Thanksgiving District Work Period" },
          { start: "2026-11-30", end: "2026-12-18", type: "session", description: "Year-End Session" },
          { start: "2026-12-21", end: "2026-12-31", type: "recess", description: "Holiday District Work Period" },
        ],
        notes: [
          "During SESSION periods, Members are typically in Washington, D.C.",
          "During RECESS/District Work Periods, Members are typically in their home districts.",
          "Committee hearings are generally scheduled during session periods.",
          "Best times for DC meetings: During session, preferably mid-week (Tue-Thu).",
          "Best times for district meetings: During recess periods in member's home state.",
        ],
      };

      // Calculate current period
      const today = new Date().toISOString().split('T')[0];
      const currentPeriod = calendar2026.periods.find(p => 
        today >= p.start && today <= p.end
      );
      const nextPeriod = calendar2026.periods.find(p => p.start > today);

      res.json({
        ...calendar2026,
        currentPeriod: currentPeriod || null,
        nextPeriod: nextPeriod || null,
        today,
      });
    } catch (error) {
      console.error("Error fetching calendar:", error);
      res.status(500).json({ message: "Failed to fetch congressional calendar" });
    }
  });

  // Get leadership schedule from RSS feeds
  app.get("/api/congress/schedule/leadership", isAuthenticated, async (req, res) => {
    try {
      const Parser = (await import("rss-parser")).default;
      const parser = new Parser();

      const feeds = [
        { name: "House Floor Today", url: "https://www.congress.gov/rss/house-floor-today.xml" },
        { name: "Senate Floor Today", url: "https://www.congress.gov/rss/senate-floor-today.xml" },
      ];

      const results: any[] = [];

      for (const feed of feeds) {
        try {
          const parsed = await parser.parseURL(feed.url);
          results.push({
            source: feed.name,
            items: (parsed.items || []).slice(0, 10).map(item => ({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              content: item.contentSnippet || item.content,
            })),
          });
        } catch (feedError) {
          console.error(`Error fetching ${feed.name}:`, feedError);
          results.push({ source: feed.name, items: [], error: "Failed to fetch" });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error fetching leadership schedule:", error);
      res.status(500).json({ message: "Failed to fetch leadership schedule" });
    }
  });

  // ========== Committee Meeting Portal Assignments ==========

  // Get assignments for a specific meeting
  app.get("/api/congress/meetings/:eventId/:chamber/assignments", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const chamber = req.params.chamber.toLowerCase();
      const assignments = await storage.getMeetingPortalAssignments(eventId, chamber);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching meeting assignments:", error);
      res.status(500).json({ message: "Failed to fetch meeting assignments" });
    }
  });

  // Assign meeting to portal
  app.post("/api/congress/meetings/:eventId/:chamber/assign-portal", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const userId = (req as any).userId;
      const eventId = parseInt(req.params.eventId);
      const chamber = req.params.chamber.toLowerCase();
      const { portalId, congress, title, meetingDate, committees, location } = req.body;
      
      if (!portalId) {
        return res.status(400).json({ message: "Portal ID is required" });
      }
      
      const assignment = await storage.assignMeetingToPortal({
        eventId,
        chamber,
        congress: congress || 119,
        title: title || "",
        meetingDate: meetingDate || "",
        committees: committees || "",
        location: location || "",
        portalId,
        clientId,
        assignedBy: userId,
      });
      res.json(assignment);
    } catch (error) {
      console.error("Error assigning meeting to portal:", error);
      res.status(500).json({ message: "Failed to assign meeting" });
    }
  });

  // Unassign meeting from portal
  app.delete("/api/congress/meetings/:eventId/:chamber/assign-portal/:portalId", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const chamber = req.params.chamber.toLowerCase();
      await storage.unassignMeetingFromPortal(eventId, chamber, req.params.portalId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unassigning meeting from portal:", error);
      res.status(500).json({ message: "Failed to unassign meeting" });
    }
  });

  // Get all meeting assignments for current client
  app.get("/api/congress/meetings/assignments", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const assignments = await storage.getClientMeetingAssignments(clientId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching client meeting assignments:", error);
      res.status(500).json({ message: "Failed to fetch meeting assignments" });
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

      const { name, title, organization, email, phone, party, state, sourceType, sourceId, imageUrl, notes, tags, matterId, portalId } = req.body;
      
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
        portalId,
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

  // ========== Customer Portal Assignments (many-to-many) ==========

  // Get all portal assignments for a customer
  app.get("/api/customer-portal-assignments/:customerId", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getCustomerPortalAssignments(req.params.customerId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching customer portal assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Get all customer assignments for a portal
  app.get("/api/portal-customer-assignments/:portalId", isAuthenticated, async (req, res) => {
    try {
      const assignments = await storage.getPortalCustomerAssignments(req.params.portalId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching portal customer assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Add a customer to a portal (many-to-many assignment)
  app.post("/api/customer-portal-assignments", isAuthenticated, async (req, res) => {
    try {
      const { customerId, portalId } = req.body;
      if (!customerId || !portalId) {
        return res.status(400).json({ message: "customerId and portalId are required" });
      }
      
      // Check if assignment already exists
      const existing = await storage.getCustomerPortalAssignments(customerId);
      const alreadyAssigned = existing.some(a => a.portalId === portalId);
      if (alreadyAssigned) {
        return res.status(400).json({ message: "Customer is already assigned to this portal" });
      }

      const userId = (req.user as Express.User).id;
      const assignment = await storage.createCustomerPortalAssignment({
        customerId,
        portalId,
        assignedBy: userId,
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating customer portal assignment:", error);
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  // Remove a customer from a portal
  app.delete("/api/customer-portal-assignments/:customerId/:portalId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCustomerPortalAssignmentByIds(req.params.customerId, req.params.portalId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer portal assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
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
  app.get("/api/kalshi/categories", isAuthenticated, async (_req, res) => {
    try {
      const categories = await kalshiApi.getAvailableCategories();
      res.json({ categories });
    } catch (error) {
      console.error("Error fetching Kalshi categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/kalshi/markets", isAuthenticated, async (req, res) => {
    try {
      const { series_ticker, event_ticker, limit, category } = req.query;
      const requestLimit = limit ? parseInt(limit as string) : 200;
      let markets: any[];
      
      if (series_ticker || event_ticker) {
        const result = await kalshiApi.getMarkets({
          seriesTicker: series_ticker as string,
          eventTicker: event_ticker as string,
          status: "open",
          limit: requestLimit,
        });
        markets = result?.markets || [];
      } else if (category && typeof category === "string") {
        markets = await kalshiApi.searchMarketsByCategory(category, requestLimit);
      } else {
        markets = await kalshiApi.searchPoliticalMarkets(requestLimit);
      }

      const eventTickers = [...new Set(markets.map((m: any) => m.event_ticker).filter(Boolean))];
      const imageMap = await kalshiApi.getEventImages(eventTickers.slice(0, 30));

      const marketsWithImages = markets.map((m: any) => ({
        ...m,
        image_url: imageMap.get(m.ticker) || imageMap.get(m.event_ticker) || null,
      }));

      res.json({ markets: marketsWithImages, cursor: null });
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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
      const clientId = await getClientId(req);
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

  // Miro OAuth - Initiate authorization
  app.get("/api/miro/auth", isAuthenticated, (req, res) => {
    const clientId = process.env.MIRO_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: "MIRO_CLIENT_ID is not configured" });
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/miro/callback`;
    const state = crypto.randomUUID();
    
    // Store state in session for verification
    (req.session as any).miroOAuthState = state;

    const authUrl = new URL("https://miro.com/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    res.json({ authUrl: authUrl.toString() });
  });

  // Miro OAuth - Handle callback
  app.get("/api/miro/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || typeof code !== "string") {
        return res.redirect("/settings?miro=error&message=No authorization code received");
      }

      const clientId = process.env.MIRO_CLIENT_ID;
      const clientSecret = process.env.MIRO_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.redirect("/settings?miro=error&message=Miro credentials not configured");
      }

      const redirectUri = `${req.protocol}://${req.get("host")}/api/miro/callback`;

      // Exchange code for access token
      const tokenResponse = await fetch("https://api.miro.com/v1/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Miro token exchange failed:", errorText);
        return res.redirect("/settings?miro=error&message=Failed to get access token");
      }

      const tokenData = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number };
      
      // Store the access token - for now we'll store it in memory
      // In production, this should be stored in the database per-client
      process.env.MIRO_API_KEY = tokenData.access_token;
      
      console.log("Miro OAuth successful, access token obtained");
      res.redirect("/settings?miro=success");
    } catch (error) {
      console.error("Miro OAuth callback error:", error);
      res.redirect("/settings?miro=error&message=OAuth callback failed");
    }
  });

  // Miro OAuth - Check connection status
  app.get("/api/miro/status", isAuthenticated, async (req, res) => {
    const hasApiKey = !!process.env.MIRO_API_KEY;
    const hasCredentials = !!(process.env.MIRO_CLIENT_ID && process.env.MIRO_CLIENT_SECRET);
    
    if (hasApiKey) {
      // Try to verify the token is valid
      try {
        const response = await fetch("https://api.miro.com/v1/users/me", {
          headers: {
            "Authorization": `Bearer ${process.env.MIRO_API_KEY}`,
          },
        });
        
        if (response.ok) {
          const userData = await response.json() as { name?: string; email?: string };
          return res.json({ 
            connected: true, 
            hasCredentials,
            user: userData 
          });
        }
      } catch (error) {
        // Token is invalid
      }
    }
    
    res.json({ 
      connected: false, 
      hasCredentials,
      needsAuth: hasCredentials && !hasApiKey 
    });
  });

  // ==================== TECH / API STATUS ROUTES ====================

  app.get("/api/admin/tech/api-status", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Super admin access required" });

      const apis = [
        {
          name: "OpenAI (GPT-4.1)",
          key: "AI_INTEGRATIONS_OPENAI_API_KEY",
          configured: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          category: "ai",
          description: "AI-powered research, content extraction, entity analysis, and structured data extraction",
          docsUrl: "https://platform.openai.com/docs",
        },
        {
          name: "Google Gemini (2.5 Flash)",
          key: "AI_INTEGRATIONS_GEMINI_API_KEY",
          configured: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
          category: "ai",
          description: "Fallback AI model for research queries and content generation",
          docsUrl: "https://ai.google.dev/docs",
        },
        {
          name: "Perplexity AI (Sonar)",
          key: "PERPLEXITY_API_KEY",
          configured: !!process.env.PERPLEXITY_API_KEY,
          category: "ai",
          description: "Staffer research, entity research, and real-time web-connected AI queries",
          docsUrl: "https://docs.perplexity.ai",
        },
        {
          name: "People Data Labs",
          key: "PDL_API_KEY",
          configured: !!process.env.PDL_API_KEY,
          category: "data",
          description: "LinkedIn career enrichment, people search, company enrichment, and organization intelligence",
          docsUrl: "https://docs.peopledatalabs.com",
        },
        {
          name: "Congress.gov API",
          key: "CONGRESS_API_KEY",
          configured: !!process.env.CONGRESS_API_KEY,
          category: "data",
          description: "Search Members of Congress, track bills, committee schedules, and floor activity",
          docsUrl: "https://api.congress.gov",
        },
        {
          name: "Firecrawl",
          key: "FIRECRAWL_API_KEY",
          configured: !!process.env.FIRECRAWL_API_KEY,
          category: "data",
          description: "Web scraping, URL content extraction, and AI agent web research",
          docsUrl: "https://docs.firecrawl.dev",
        },
        {
          name: "SearchAPI.io",
          key: "SEARCHAPI_API_KEY",
          configured: !!process.env.SEARCHAPI_API_KEY,
          category: "data",
          description: "Google rank tracking with device and location targeting",
          docsUrl: "https://www.searchapi.io/docs",
        },
        {
          name: "LegiStorm",
          key: "LEGISTORM_API_KEY",
          configured: !!process.env.LEGISTORM_API_KEY,
          category: "data",
          description: "Congressional staff directory with 12,000+ staffers, position history, and contact data",
          docsUrl: "https://api.legistorm.com",
        },
        {
          name: "Influencers Club",
          key: "INFLUENCERS_API_KEY",
          configured: !!process.env.INFLUENCERS_API_KEY,
          category: "social",
          description: "Track and enrich influencer profiles across Instagram, YouTube, TikTok, Twitter, Twitch",
          docsUrl: null,
        },
        {
          name: "Kalshi",
          key: "KALSHI_API_KEY",
          configured: !!process.env.KALSHI_API_KEY,
          category: "data",
          description: "Live political prediction markets and event contracts",
          docsUrl: "https://trading-api.readme.io",
        },
        {
          name: "Resend",
          key: "RESEND_API_KEY",
          configured: !!process.env.RESEND_API_KEY,
          category: "comms",
          description: "Transactional email delivery for daily briefs, research updates, and notifications",
          docsUrl: "https://resend.com/docs",
        },
        {
          name: "Miro",
          key: "MIRO_API_KEY",
          configured: !!process.env.MIRO_API_KEY,
          category: "tools",
          description: "Whiteboard collaboration and visual project planning",
          docsUrl: "https://developers.miro.com/docs",
        },
        {
          name: "Replit Object Storage",
          key: "DEFAULT_OBJECT_STORAGE_BUCKET_ID",
          configured: !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
          category: "infra",
          description: "Cloud file storage for documents, uploads, and media assets",
          docsUrl: null,
        },
        {
          name: "PostgreSQL Database",
          key: "DATABASE_URL",
          configured: !!process.env.DATABASE_URL,
          category: "infra",
          description: "Primary relational database for all platform data",
          docsUrl: null,
        },
      ];

      const summary = {
        total: apis.length,
        configured: apis.filter(a => a.configured).length,
        missing: apis.filter(a => !a.configured).length,
      };

      res.json({ apis, summary });
    } catch (error) {
      console.error("Error getting API status:", error);
      res.status(500).json({ message: "Failed to get API status" });
    }
  });

  // ==================== LEGISTORM ROUTES ====================

  app.get("/api/legistorm/status", isAuthenticated, async (req, res) => {
    try {
      const { getSyncStatus } = await import("./services/legistorm-service");
      const status = await getSyncStatus();
      res.json(status);
    } catch (error: any) {
      console.error("Error getting LegiStorm status:", error);
      res.status(500).json({ message: error.message || "Failed to get status" });
    }
  });

  app.post("/api/legistorm/sync/full", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Super admin access required" });

      const { runFullSync } = await import("./services/legistorm-service");
      const result = await runFullSync();
      res.json({ message: "Full sync started", logId: result.logId });
    } catch (error: any) {
      console.error("Error starting full sync:", error);
      res.status(500).json({ message: error.message || "Failed to start sync" });
    }
  });

  app.post("/api/legistorm/sync/incremental", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const superAdmin = await storage.getSuperAdminByUserId(userId);
      if (!superAdmin) return res.status(403).json({ message: "Super admin access required" });

      const { runIncrementalSync } = await import("./services/legistorm-service");
      const result = await runIncrementalSync();
      res.json({ message: "Incremental sync started", logId: result.logId });
    } catch (error: any) {
      console.error("Error starting incremental sync:", error);
      res.status(500).json({ message: error.message || "Failed to start sync" });
    }
  });

  app.get("/api/legistorm/staffers", isAuthenticated, async (req, res) => {
    try {
      const { searchLegistormStaffers } = await import("./services/legistorm-service");
      const query = (req.query.q as string) || "";
      const chamber = req.query.chamber as string;
      const state = req.query.state as string;
      const party = req.query.party as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      console.log(`[LegiStorm Search] q="${query}" chamber="${chamber}" state="${state}" party="${party}" limit=${limit} offset=${offset}`);
      const result = await searchLegistormStaffers(query, { chamber, state, party, limit, offset });
      console.log(`[LegiStorm Search] Found ${result.total} results, returning ${result.staffers.length}`);
      res.json(result);
    } catch (error: any) {
      console.error("Error searching LegiStorm staffers:", error);
      res.status(500).json({ message: error.message || "Failed to search staffers" });
    }
  });

  app.get("/api/legistorm/staffers/:legistormId", isAuthenticated, async (req, res) => {
    try {
      const { getLegistormStaffer } = await import("./services/legistorm-service");
      const staffer = await getLegistormStaffer(parseInt(req.params.legistormId));
      if (!staffer) return res.status(404).json({ message: "Staffer not found" });
      res.json(staffer);
    } catch (error: any) {
      console.error("Error getting LegiStorm staffer:", error);
      res.status(500).json({ message: error.message || "Failed to get staffer" });
    }
  });

  app.get("/api/legistorm/scheduler", isAuthenticated, async (req, res) => {
    try {
      const memberName = req.query.memberName as string;
      if (!memberName) {
        return res.status(400).json({ message: "memberName query parameter is required" });
      }
      const { findSchedulerForMember } = await import("./services/legistorm-service");
      const results = await findSchedulerForMember(memberName);
      res.json({ schedulers: results, total: results.length });
    } catch (error: any) {
      console.error("Error finding scheduler:", error);
      res.status(500).json({ message: error.message || "Failed to find scheduler" });
    }
  });

  // LinkedIn lookup for LegiStorm staffers using PDL
  app.post("/api/legistorm/staffers/:legistormId/linkedin", isAuthenticated, async (req, res) => {
    try {
      if (!process.env.PDL_API_KEY) {
        return res.status(400).json({ message: "People Data Labs API key not configured" });
      }
      const { getLegistormStaffer } = await import("./services/legistorm-service");
      const staffer = await getLegistormStaffer(parseInt(req.params.legistormId));
      if (!staffer) return res.status(404).json({ message: "Staffer not found" });

      const { researchLinkedInProfile } = await import("./services/linkedin-service");

      const nameParts = staffer.fullName.split(" ");
      const firstName = staffer.firstName || nameParts[0];
      const lastName = staffer.lastName || nameParts[nameParts.length - 1];
      let org = staffer.currentOffice || staffer.currentMemberName || "US Congress";
      if (org.toLowerCase().includes("office of")) {
        org = "US Congress";
      }

      const result = await researchLinkedInProfile(firstName, lastName, org);

      if (result.profileUrl) {
        const { db } = await import("./db");
        const { legistormStaffers } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(legistormStaffers)
          .set({ linkedinUrl: result.profileUrl })
          .where(eq(legistormStaffers.legistormId, parseInt(req.params.legistormId)));
      }

      res.json({
        success: !!result.profileUrl,
        linkedinUrl: result.profileUrl,
        error: result.error,
      });
    } catch (error: any) {
      console.error("Error looking up LinkedIn for staffer:", error);
      res.status(500).json({ message: error.message || "Failed to look up LinkedIn profile" });
    }
  });

  // Get bill associations for a specific LegiStorm staffer
  app.get("/api/legistorm/staffers/:legistormId/bills", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const { db } = await import("./db");
      const { stafferBillAssociations, legistormStaffers } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const staffer = await db.select({ id: legistormStaffers.id })
        .from(legistormStaffers)
        .where(eq(legistormStaffers.legistormId, parseInt(req.params.legistormId)))
        .limit(1);

      if (!staffer.length) return res.json([]);

      const bills = await db.select()
        .from(stafferBillAssociations)
        .where(and(
          eq(stafferBillAssociations.clientId, clientId),
          eq(stafferBillAssociations.stafferId, staffer[0].id),
          eq(stafferBillAssociations.stafferType, "legistorm")
        ));

      res.json(bills);
    } catch (error: any) {
      console.error("Error getting staffer bills:", error);
      res.status(500).json({ message: error.message || "Failed to get bills" });
    }
  });

  // ==================== STAFFER-BILL MAPPING ROUTES ====================

  app.get("/api/staffer-bills", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const filters: any = {};
      if (req.query.stafferId) filters.stafferId = req.query.stafferId as string;
      if (req.query.stafferType) filters.stafferType = req.query.stafferType as string;
      if (req.query.trackedBillId) filters.trackedBillId = req.query.trackedBillId as string;
      const associations = await storage.getStafferBillAssociations(clientId, filters);
      res.json(associations);
    } catch (error: any) {
      console.error("Error getting staffer-bill associations:", error);
      res.status(500).json({ message: "Failed to get staffer-bill associations" });
    }
  });

  app.get("/api/staffer-bills/by-staffer/:stafferType/:stafferId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const { stafferType, stafferId } = req.params;
      const associations = await storage.getStafferBillsByStaffer(clientId, stafferType, stafferId);
      res.json(associations);
    } catch (error: any) {
      console.error("Error getting staffer bills:", error);
      res.status(500).json({ message: "Failed to get staffer bills" });
    }
  });

  app.get("/api/staffer-bills/by-bill/:trackedBillId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const associations = await storage.getStafferBillsByBill(clientId, req.params.trackedBillId);
      res.json(associations);
    } catch (error: any) {
      console.error("Error getting bill staffers:", error);
      res.status(500).json({ message: "Failed to get bill staffers" });
    }
  });

  app.post("/api/staffer-bills", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const association = await storage.createStafferBillAssociation({ ...req.body, clientId });
      res.json(association);
    } catch (error: any) {
      console.error("Error creating staffer-bill association:", error);
      res.status(500).json({ message: "Failed to create association" });
    }
  });

  app.patch("/api/staffer-bills/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const existing = await storage.getStafferBillAssociation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Association not found" });
      if (existing.clientId !== clientId) return res.status(403).json({ message: "Not authorized" });
      const association = await storage.updateStafferBillAssociation(req.params.id, req.body);
      res.json(association);
    } catch (error: any) {
      console.error("Error updating staffer-bill association:", error);
      res.status(500).json({ message: "Failed to update association" });
    }
  });

  app.delete("/api/staffer-bills/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const existing = await storage.getStafferBillAssociation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Association not found" });
      if (existing.clientId !== clientId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteStafferBillAssociation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting staffer-bill association:", error);
      res.status(500).json({ message: "Failed to delete association" });
    }
  });

  app.post("/api/staffer-bills/ai-discover", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const { stafferName, stafferType, stafferId, billTitle, billType, billNumber, congress } = req.body;
      if (!stafferName && !billTitle) {
        return res.status(400).json({ message: "Provide either stafferName or billTitle" });
      }

      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityKey) {
        return res.status(500).json({ message: "Perplexity API key not configured" });
      }

      let enrichedContext = "";
      let memberBillsList: Array<{ congress: number; type: string; number: number; title: string; introducedDate: string }> = [];

      if (stafferName && stafferType === "legistorm" && stafferId) {
        try {
          const { getLegistormStaffer } = await import("./services/legistorm-service");
          const legistormId = parseInt(stafferId);
          const staffer = !isNaN(legistormId) ? await getLegistormStaffer(legistormId) : null;

          if (staffer) {
            const positions = (staffer.positions as any[]) || [];
            if (positions.length > 0) {
              enrichedContext += `\n\n## LegiStorm Employment History for ${stafferName}:\n`;
              for (const pos of positions) {
                enrichedContext += `- ${pos.title || "Staff"} in ${pos.officeName || pos.memberName || "Unknown office"} (${pos.startDate || "?"} to ${pos.endDate || "present"})`;
                if (pos.chamber) enrichedContext += ` [${pos.chamber}]`;
                if (pos.state) enrichedContext += ` [${pos.state}${pos.district ? `-${pos.district}` : ""}]`;
                enrichedContext += "\n";
              }
            }

            const congressApiKey = process.env.CONGRESS_API_KEY;
            if (congressApiKey) {
              const congressApi = new CongressAPI(congressApiKey);
              const memberNames = new Set<string>();
              for (const pos of positions) {
                if (pos.memberName) memberNames.add(pos.memberName);
              }
              if (staffer.currentMemberName) memberNames.add(staffer.currentMemberName);

              for (const memberName of memberNames) {
                try {
                  const nameParts = memberName.split(" ");
                  const lastName = nameParts[nameParts.length - 1];
                  const pos = positions.find(p => p.memberName === memberName);
                  const posState = pos?.state || staffer.state || undefined;
                  const posChamber = pos?.chamber?.toLowerCase() as "house" | "senate" | undefined;

                  const members = await congressApi.searchMembers(lastName, {
                    chamber: posChamber,
                    state: posState || undefined,
                  });

                  let matched = members.find(m => {
                    const mName = m.name.toLowerCase();
                    const nameMatch = nameParts.every(part => mName.includes(part.toLowerCase()));
                    if (!nameMatch) return false;
                    if (posState && m.state !== posState) return false;
                    return true;
                  });
                  if (!matched && members.length === 1) {
                    const mName = members[0].name.toLowerCase();
                    if (nameParts.some(part => mName.includes(part.toLowerCase()))) {
                      matched = members[0];
                    }
                  }

                  if (matched) {
                    const startYear = pos?.startDate ? parseInt(pos.startDate.substring(0, 4)) : null;
                    const endYear = pos?.endDate ? parseInt(pos.endDate.substring(0, 4)) : new Date().getFullYear();

                    try {
                      const sponsored = await congressApi.getMemberBills(matched.bioguideId, 100);
                      const bills = (sponsored.sponsoredLegislation || []).filter(b => {
                        if (!startYear) return true;
                        const billYear = b.introducedDate ? parseInt(b.introducedDate.substring(0, 4)) : null;
                        return billYear && billYear >= startYear && billYear <= (endYear || 2030);
                      });

                      if (bills.length > 0) {
                        enrichedContext += `\n## Bills sponsored by ${memberName} (${matched.party}-${matched.state}) during ${stafferName}'s tenure:\n`;
                        for (const b of bills.slice(0, 25)) {
                          const typeLabel = b.type?.replace(".", "") || "";
                          enrichedContext += `- ${typeLabel.toUpperCase()} ${b.number}: ${b.title} (introduced ${b.introducedDate})\n`;
                          memberBillsList.push({ congress: b.congress, type: typeLabel.toLowerCase(), number: b.number, title: b.title, introducedDate: b.introducedDate });
                        }
                        if (bills.length > 25) enrichedContext += `... and ${bills.length - 25} more bills\n`;
                      }
                    } catch (e) { /* skip if API fails for this member */ }

                    try {
                      const cosponsored = await congressApi.getMemberCosponsoredBills(matched.bioguideId, 50);
                      const coBills = (cosponsored.cosponsoredLegislation || []).filter(b => {
                        if (!startYear) return true;
                        const billYear = b.introducedDate ? parseInt(b.introducedDate.substring(0, 4)) : null;
                        return billYear && billYear >= startYear && billYear <= (endYear || 2030);
                      });

                      if (coBills.length > 0) {
                        enrichedContext += `\n## Key bills cosponsored by ${memberName} during ${stafferName}'s tenure:\n`;
                        for (const b of coBills.slice(0, 15)) {
                          const typeLabel = b.type?.replace(".", "") || "";
                          enrichedContext += `- ${typeLabel.toUpperCase()} ${b.number}: ${b.title} (introduced ${b.introducedDate})\n`;
                          memberBillsList.push({ congress: b.congress, type: typeLabel.toLowerCase(), number: b.number, title: b.title, introducedDate: b.introducedDate });
                        }
                      }
                    } catch (e) { /* skip cosponsored if API fails */ }
                  }
                } catch (e) { /* skip this member lookup */ }
              }
            }
          }
        } catch (e) {
          console.error("Error enriching staffer data:", e);
        }
      }

      let prompt = "";
      if (stafferName && billTitle) {
        prompt = `Research the connection between congressional staffer "${stafferName}" and the bill "${billTitle}" (${billType?.toUpperCase() || ""} ${billNumber || ""}, ${congress || ""}th Congress). What role did this staffer play in the bill? Did they draft it, negotiate it, staff the committee hearing, or manage it on the floor? Provide specific details about their involvement, their title at the time, and which member of Congress they were working for. If no connection exists, say so clearly.`;
      } else if (stafferName) {
        prompt = `Research congressional staffer "${stafferName}" and identify which bills they likely worked on throughout their career.`;
        if (enrichedContext) {
          prompt += `\n\nI have the following verified data from LegiStorm and Congress.gov to help your analysis:${enrichedContext}`;
          prompt += `\n\nUsing this employment history and bill data above, analyze which of these bills the staffer "${stafferName}" most likely worked on directly. For each relevant bill, specify:
1. The bill number and title
2. Their likely role (drafted, negotiated, staffed committee, floor managed, policy advisor, legislative counsel, etc.)
3. What position they held at the time
4. Which member they worked for
5. Your confidence level (high/medium/low)

Focus on bills that align with the staffer's position title, the committee jurisdiction, and the member's legislative priorities. A Chief of Staff or Legislative Director would be involved in most major bills. A Legislative Assistant or Policy Advisor would focus on bills in their issue area.`;
        } else {
          prompt += ` For each bill, specify: the bill number, title, their role (drafted, negotiated, staffed committee, floor managed, etc.), what position they held at the time, and which member they worked for. Focus on confirmed involvement, not speculation.`;
        }
      } else {
        prompt = `Research the bill "${billTitle}" (${billType?.toUpperCase() || ""} ${billNumber || ""}, ${congress || ""}th Congress) and identify the key congressional staffers who worked on it. For each staffer, specify: their name, role in the bill (drafted, negotiated, staffed committee, floor managed, etc.), their title at the time, and which member of Congress they worked for. Focus on confirmed involvement.`;
      }

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: "You are a congressional research expert specializing in identifying staffer involvement with legislation. You have access to verified employment and bill data. Use this data to make informed analysis about which bills a staffer likely worked on based on their position, the member they served, and the timing. Be specific about roles, titles, timeframes, and confidence levels. Format bill references consistently as 'H.R. 123' or 'S. 456' style." },
            { role: "user", content: prompt },
          ],
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "No results found.";
      const citations = data.citations || [];

      res.json({
        research: content,
        citations,
        prompt,
        enrichedData: {
          positionsFound: enrichedContext ? true : false,
          memberBillsCount: memberBillsList.length,
          memberBills: memberBillsList.slice(0, 50),
        },
      });
    } catch (error: any) {
      console.error("Error in AI discovery:", error);
      res.status(500).json({ message: error.message || "AI discovery failed" });
    }
  });

  // ==================== RANK TRACKING ROUTES ====================

  app.get("/api/rank-tracking/queries", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const queries = await storage.getRankTrackedQueries(clientId);
      res.json(queries);
    } catch (error) {
      console.error("Error getting rank tracked queries:", error);
      res.status(500).json({ message: "Failed to get rank tracked queries" });
    }
  });

  app.post("/api/rank-tracking/queries", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const { query: searchQuery, targetDomain, device, location } = req.body;
      if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim().length === 0) {
        return res.status(400).json({ message: "Query is required" });
      }
      const validDevices = ["desktop", "mobile", "tablet"];
      const safeDevice = validDevices.includes(device) ? device : "desktop";
      const tracked = await storage.createRankTrackedQuery({
        clientId,
        query: searchQuery.trim(),
        targetDomain: typeof targetDomain === "string" && targetDomain.trim() ? targetDomain.trim() : null,
        device: safeDevice,
        location: typeof location === "string" && location.trim() ? location.trim() : null,
        isActive: true,
      });
      res.json(tracked);
    } catch (error) {
      console.error("Error creating rank tracked query:", error);
      res.status(500).json({ message: "Failed to create rank tracked query" });
    }
  });

  app.patch("/api/rank-tracking/queries/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const existing = await storage.getRankTrackedQuery(req.params.id);
      if (!existing || existing.clientId !== clientId) {
        return res.status(404).json({ message: "Tracked query not found" });
      }
      const allowedFields: Record<string, any> = {};
      if (req.body.query && typeof req.body.query === "string") allowedFields.query = req.body.query.trim();
      if (req.body.targetDomain !== undefined) allowedFields.targetDomain = typeof req.body.targetDomain === "string" && req.body.targetDomain.trim() ? req.body.targetDomain.trim() : null;
      if (req.body.device) {
        const validDevices = ["desktop", "mobile", "tablet"];
        if (validDevices.includes(req.body.device)) allowedFields.device = req.body.device;
      }
      if (req.body.location !== undefined) allowedFields.location = typeof req.body.location === "string" && req.body.location.trim() ? req.body.location.trim() : null;
      if (req.body.isActive !== undefined) allowedFields.isActive = Boolean(req.body.isActive);
      const updated = await storage.updateRankTrackedQuery(req.params.id, allowedFields);
      res.json(updated);
    } catch (error) {
      console.error("Error updating rank tracked query:", error);
      res.status(500).json({ message: "Failed to update rank tracked query" });
    }
  });

  app.delete("/api/rank-tracking/queries/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const existing = await storage.getRankTrackedQuery(req.params.id);
      if (!existing || existing.clientId !== clientId) {
        return res.status(404).json({ message: "Tracked query not found" });
      }
      await storage.deleteRankTrackedQuery(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rank tracked query:", error);
      res.status(500).json({ message: "Failed to delete rank tracked query" });
    }
  });

  app.get("/api/rank-tracking/results/:queryId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const existing = await storage.getRankTrackedQuery(req.params.queryId);
      if (!existing || existing.clientId !== clientId) {
        return res.status(404).json({ message: "Tracked query not found" });
      }
      const results = await storage.getRankTrackingResults(req.params.queryId);
      res.json(results);
    } catch (error) {
      console.error("Error getting rank results:", error);
      res.status(500).json({ message: "Failed to get rank results" });
    }
  });

  app.post("/api/rank-tracking/check/:queryId", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const tracked = await storage.getRankTrackedQuery(req.params.queryId);
      if (!tracked || tracked.clientId !== clientId) {
        return res.status(404).json({ message: "Tracked query not found" });
      }

      const { checkRankings } = await import("./services/searchapi-rank-tracking");
      const rankings = await checkRankings(tracked.query, {
        device: tracked.device || "desktop",
        location: tracked.location || undefined,
      });

      const resultsToStore = rankings.map((r) => ({
        queryId: tracked.id,
        clientId,
        position: r.position,
        title: r.title,
        link: r.link,
        domain: r.domain,
        snippet: r.snippet,
      }));

      const stored = await storage.createRankTrackingResults(resultsToStore);
      await storage.updateRankTrackedQueryLastChecked(tracked.id);

      res.json({
        results: stored,
        total: rankings.length,
        targetPosition: tracked.targetDomain
          ? rankings.find((r) => r.domain?.includes(tracked.targetDomain!))?.position || null
          : null,
      });
    } catch (error: any) {
      console.error("Error checking rankings:", error);
      res.status(500).json({ message: error.message || "Failed to check rankings" });
    }
  });

  // ==================== Strategy Board Routes ====================

  // Access Mapping - Find staffers for a member
  app.get("/api/strategy/access-map", isAuthenticated, async (req, res) => {
    try {
      const memberName = req.query.memberName as string;
      if (!memberName) return res.status(400).json({ message: "memberName is required" });

      const { ilike, or } = await import("drizzle-orm");
      const { db } = await import("./db");

      const nameVariants: string[] = [memberName];
      if (memberName.includes(",")) {
        const parts = memberName.split(",").map(p => p.trim());
        nameVariants.push(`${parts[1]} ${parts[0]}`);
        nameVariants.push(parts[0]);
      } else {
        const parts = memberName.split(/\s+/);
        if (parts.length >= 2) {
          nameVariants.push(parts[parts.length - 1]);
          nameVariants.push(`${parts[parts.length - 1]}, ${parts[0]}`);
        }
      }

      const staffers = await db.select().from(legistormStaffers)
        .where(or(...nameVariants.map(v => ilike(legistormStaffers.currentMemberName, `%${v}%`))))
        .limit(50);

      res.json({ staffers, total: staffers.length });
    } catch (error: any) {
      console.error("Error in access map:", error);
      res.status(500).json({ message: error.message || "Failed to get access map" });
    }
  });

  // AI Access Strategy
  app.get("/api/strategy/ai-access", isAuthenticated, async (req, res) => {
    try {
      const memberName = req.query.memberName as string;
      if (!memberName) return res.status(400).json({ message: "memberName is required" });

      const { ilike, or } = await import("drizzle-orm");
      const { db } = await import("./db");

      const nameVariants: string[] = [memberName];
      if (memberName.includes(",")) {
        const parts = memberName.split(",").map(p => p.trim());
        nameVariants.push(`${parts[1]} ${parts[0]}`);
        nameVariants.push(parts[0]);
      } else {
        const parts = memberName.split(/\s+/);
        if (parts.length >= 2) {
          nameVariants.push(parts[parts.length - 1]);
          nameVariants.push(`${parts[parts.length - 1]}, ${parts[0]}`);
        }
      }

      const staffers = await db.select().from(legistormStaffers)
        .where(or(...nameVariants.map(v => ilike(legistormStaffers.currentMemberName, `%${v}%`))))
        .limit(20);

      const stafferSummary = staffers.map(s => `${s.fullName} - ${s.currentTitle} (${s.email || 'no email'})`).join("\n");

      const prompt = `You are a government affairs strategy consultant. A client needs access to ${memberName} in Congress.

Here are the current staffers in their office:
${stafferSummary}

Provide a concise access strategy that includes:
1. Which staffers to approach first and why (based on their title/role)
2. Best approach for initial contact (email, meeting request, etc.)
3. Key talking points to open the conversation
4. Common mistakes to avoid
5. Timeline recommendation

Keep the response practical, actionable, and under 500 words.`;

      if (process.env.PERPLEXITY_API_KEY) {
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000,
          }),
        });
        const data = await response.json();
        res.json({ strategy: data.choices?.[0]?.message?.content || "No strategy generated" });
      } else {
        res.json({ strategy: `Access Strategy for ${memberName}:\n\nBased on ${staffers.length} staffers found, prioritize reaching out to senior staff members like the Chief of Staff or Legislative Director first. These individuals have the most direct access and influence on policy decisions.\n\nRecommended approach:\n1. Start with email introduction\n2. Reference specific policy areas of mutual interest\n3. Request a brief introductory meeting\n4. Follow up within one week` });
      }
    } catch (error: any) {
      console.error("Error generating AI strategy:", error);
      res.status(500).json({ message: error.message || "Failed to generate strategy" });
    }
  });

  // Bill search for strategy
  app.get("/api/strategy/bill-search", isAuthenticated, async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.json([]);

      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "Congress API key not configured" });

      const congressApi = new CongressAPI(apiKey);
      const results = await congressApi.searchByKeyword(q, 119, 20);
      res.json(results || []);
    } catch (error: any) {
      console.error("Error searching bills:", error);
      res.status(500).json({ message: error.message || "Failed to search bills" });
    }
  });

  // Bill influence map
  app.get("/api/strategy/bill-influence", isAuthenticated, async (req, res) => {
    try {
      const billId = req.query.billId as string;
      const billLabel = req.query.billLabel as string;
      if (!billId) return res.status(400).json({ message: "billId required" });

      const clientId = await getClientId(req);
      const { ilike, or, and, eq } = await import("drizzle-orm");
      const { db } = await import("./db");

      const associations = await db.select().from(stafferBillAssociations)
        .where(
          clientId
            ? and(
                eq(stafferBillAssociations.clientId, clientId),
                or(
                  ilike(stafferBillAssociations.billTitle, `%${billLabel || billId}%`),
                  eq(stafferBillAssociations.billNumber, parseInt(billId) || 0)
                )
              )
            : or(
                ilike(stafferBillAssociations.billTitle, `%${billLabel || billId}%`),
                eq(stafferBillAssociations.billNumber, parseInt(billId) || 0)
              )
        )
        .limit(50);

      let aiStrategy = "";
      if (associations.length > 0 && process.env.PERPLEXITY_API_KEY) {
        const stafferList = associations.map(a => `${a.stafferName} (${a.role || "connected"}, ${a.positionTitle || ""})`).join(", ");
        try {
          const aiRes = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [{ role: "user", content: `Provide a brief political influence strategy for the bill "${billLabel || billId}". These staffers are connected: ${stafferList}. Give 3-4 actionable recommendations in under 200 words.` }],
              max_tokens: 500,
            }),
          });
          const aiData = await aiRes.json();
          aiStrategy = aiData.choices?.[0]?.message?.content || "";
        } catch (e) {
          console.error("AI strategy error:", e);
        }
      }

      res.json({ staffers: associations, aiStrategy });
    } catch (error: any) {
      console.error("Error getting bill influence:", error);
      res.status(500).json({ message: error.message || "Failed to get bill influence" });
    }
  });

  // Network path finder
  app.post("/api/strategy/find-path", isAuthenticated, async (req, res) => {
    try {
      const { target } = req.body;
      if (!target) return res.status(400).json({ message: "target is required" });

      const { ilike, or } = await import("drizzle-orm");
      const { db } = await import("./db");

      const directStaffers = await db.select().from(legistormStaffers)
        .where(
          or(
            ilike(legistormStaffers.currentMemberName, `%${target}%`),
            ilike(legistormStaffers.currentOffice, `%${target}%`)
          )
        )
        .limit(20);

      const committeeStaffers = await db.select().from(legistormStaffers)
        .where(ilike(legistormStaffers.currentOffice, `%committee%`))
        .limit(10);

      const committeeConnections = committeeStaffers
        .filter(s => s.currentOffice?.toLowerCase().includes(target.toLowerCase().split(" ").pop() || ""))
        .map(s => ({
          committee: s.currentOffice,
          role: s.currentTitle,
          stafferName: s.fullName,
        }));

      let aiRecommendation = "";
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          const stafferContext = directStaffers.slice(0, 5).map(s => `${s.fullName} (${s.currentTitle})`).join(", ");
          const aiRes = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [{ role: "user", content: `A government affairs professional needs access to "${target}" in Congress. ${directStaffers.length > 0 ? `Direct staffers found: ${stafferContext}.` : "No direct staffers found."} Provide a brief, practical networking strategy with 3-4 specific steps. Include alternative approaches if direct access is difficult. Keep it under 250 words.` }],
              max_tokens: 500,
            }),
          });
          const aiData = await aiRes.json();
          aiRecommendation = aiData.choices?.[0]?.message?.content || "";
        } catch (e) {
          console.error("AI path error:", e);
        }
      }

      res.json({
        directStaffers,
        committeeConnections,
        aiRecommendation,
      });
    } catch (error: any) {
      console.error("Error finding path:", error);
      res.status(500).json({ message: error.message || "Failed to find path" });
    }
  });

  // Power Grid - Members with their staffers
  app.get("/api/strategy/power-grid", isAuthenticated, async (req, res) => {
    try {
      const chamber = req.query.chamber as string;
      const party = req.query.party as string;
      const state = req.query.state as string;

      const { db } = await import("./db");
      const { sql, ilike, eq, and, isNotNull, count } = await import("drizzle-orm");

      const conditions = [isNotNull(legistormStaffers.currentMemberName)];
      if (chamber && chamber !== "all") conditions.push(eq(legistormStaffers.chamber, chamber));
      if (party && party !== "all") conditions.push(ilike(legistormStaffers.party, `%${party}%`));
      if (state) conditions.push(eq(legistormStaffers.state, state));

      const memberGroups = await db.select({
        memberName: legistormStaffers.currentMemberName,
        chamber: legistormStaffers.chamber,
        party: legistormStaffers.party,
        state: legistormStaffers.state,
        staffCount: count(),
      })
        .from(legistormStaffers)
        .where(and(...conditions))
        .groupBy(
          legistormStaffers.currentMemberName,
          legistormStaffers.chamber,
          legistormStaffers.party,
          legistormStaffers.state
        )
        .orderBy(sql`count(*) DESC`)
        .limit(100);

      const result = await Promise.all(memberGroups.map(async (mg) => {
        const topStaffers = await db.select({
          name: legistormStaffers.fullName,
          title: legistormStaffers.currentTitle,
          email: legistormStaffers.email,
        })
          .from(legistormStaffers)
          .where(
            and(
              eq(legistormStaffers.currentMemberName, mg.memberName!),
              ...(chamber && chamber !== "all" ? [eq(legistormStaffers.chamber, chamber)] : [])
            )
          )
          .limit(5);

        return {
          ...mg,
          topStaffers,
        };
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Error getting power grid:", error);
      res.status(500).json({ message: error.message || "Failed to get power grid" });
    }
  });

  // Strategy Boards CRUD
  app.get("/api/strategy/boards", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      const { db } = await import("./db");
      const { eq, desc } = await import("drizzle-orm");

      const boards = clientId
        ? await db.select().from(strategyBoards).where(eq(strategyBoards.clientId, clientId)).orderBy(desc(strategyBoards.createdAt))
        : await db.select().from(strategyBoards).orderBy(desc(strategyBoards.createdAt));

      res.json(boards);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get boards" });
    }
  });

  app.post("/api/strategy/boards", isAuthenticated, async (req, res) => {
    try {
      const clientId = (await getClientId(req)) || "default";
      const { db } = await import("./db");

      const [board] = await db.insert(strategyBoards).values({
        clientId,
        name: req.body.name,
        description: req.body.description,
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        targetName: req.body.targetName,
      }).returning();

      res.json(board);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create board" });
    }
  });

  app.delete("/api/strategy/boards/:id", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      await db.delete(strategyCards).where(eq(strategyCards.boardId, req.params.id));
      await db.delete(strategyBoards).where(eq(strategyBoards.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete board" });
    }
  });

  // Strategy Cards CRUD
  app.get("/api/strategy/boards/:boardId/cards", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      const cards = await db.select().from(strategyCards)
        .where(eq(strategyCards.boardId, req.params.boardId))
        .orderBy(strategyCards.position);

      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get cards" });
    }
  });

  app.post("/api/strategy/boards/:boardId/cards", isAuthenticated, async (req, res) => {
    try {
      const clientId = (await getClientId(req)) || "default";
      const { db } = await import("./db");

      const [card] = await db.insert(strategyCards).values({
        boardId: req.params.boardId,
        clientId,
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        entityName: req.body.entityName,
        entityMeta: req.body.entityMeta,
        stage: req.body.stage || "Identify",
        notes: req.body.notes,
        priority: req.body.priority || "medium",
      }).returning();

      res.json(card);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create card" });
    }
  });

  app.patch("/api/strategy/cards/:id", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      const updates: any = {};
      if (req.body.stage !== undefined) updates.stage = req.body.stage;
      if (req.body.position !== undefined) updates.position = req.body.position;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.priority !== undefined) updates.priority = req.body.priority;
      updates.updatedAt = new Date();

      const [card] = await db.update(strategyCards)
        .set(updates)
        .where(eq(strategyCards.id, req.params.id))
        .returning();

      res.json(card);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update card" });
    }
  });

  app.delete("/api/strategy/cards/:id", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");

      await db.delete(strategyCards).where(eq(strategyCards.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete card" });
    }
  });

  // ========== Veterans Search ==========

  app.get("/api/veterans/members", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(401).json({ message: "No client context" });
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");

      const records = await db.select().from(veteranCongressMembers)
        .where(and(
          eq(veteranCongressMembers.clientId, clientId),
          eq(veteranCongressMembers.isVeteran, true)
        ));
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch veteran members" });
    }
  });

  app.post("/api/veterans/research", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(401).json({ message: "No client context" });
      const { bioguideId, memberName, chamber, state, party } = req.body;
      if (!bioguideId || !memberName) return res.status(400).json({ message: "bioguideId and memberName required" });

      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");

      const existing = await db.select().from(veteranCongressMembers)
        .where(and(
          eq(veteranCongressMembers.clientId, clientId),
          eq(veteranCongressMembers.bioguideId, bioguideId)
        ));
      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityKey) {
        return res.status(500).json({ message: "Perplexity API key not configured" });
      }

      const prompt = `Is ${memberName} (${chamber || "Congress"}, ${party || ""} - ${state || ""}) a military veteran? 

Respond in this exact JSON format only, no other text:
{
  "isVeteran": true or false,
  "serviceBranch": "branch name or null",
  "serviceDetails": "brief description of military service or null",
  "yearsOfService": "e.g. 1990-1995 or null",
  "rank": "highest rank achieved or null",
  "confidence": "high" or "medium" or "low"
}`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";
      
      let parsed: any = { isVeteran: false, confidence: "low" };
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse veteran research response:", rawContent);
      }

      const record = await db.insert(veteranCongressMembers).values({
        clientId,
        bioguideId,
        memberName,
        chamber: chamber || null,
        state: state || null,
        party: party || null,
        isVeteran: !!parsed.isVeteran,
        serviceBranch: parsed.serviceBranch || null,
        serviceDetails: parsed.serviceDetails || null,
        yearsOfService: parsed.yearsOfService || null,
        rank: parsed.rank || null,
        source: "ai_research",
        confidence: parsed.confidence || "medium",
      }).returning();

      res.json(record[0]);
    } catch (error: any) {
      console.error("Error researching veteran status:", error);
      res.status(500).json({ message: error.message || "Failed to research veteran status" });
    }
  });

  app.post("/api/veterans/batch-research", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(401).json({ message: "No client context" });
      const { members } = req.body;
      if (!members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ message: "members array required" });
      }

      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityKey) {
        return res.status(500).json({ message: "Perplexity API key not configured" });
      }

      const { db } = await import("./db");
      const { eq, and, inArray } = await import("drizzle-orm");

      const existingRecords = await db.select().from(veteranCongressMembers)
        .where(and(
          eq(veteranCongressMembers.clientId, clientId),
          inArray(veteranCongressMembers.bioguideId, members.map((m: any) => m.bioguideId))
        ));
      const existingIds = new Set(existingRecords.map(r => r.bioguideId));
      const toResearch = members.filter((m: any) => !existingIds.has(m.bioguideId)).slice(0, 20);

      if (toResearch.length === 0) {
        return res.json({ results: existingRecords, researched: 0 });
      }

      const memberList = toResearch.map((m: any, i: number) => 
        `${i + 1}. ${m.memberName} [ID:${m.bioguideId}] (${m.chamber || "Congress"}, ${m.party || ""} - ${m.state || ""})`
      ).join("\n");

      const prompt = `For each of these current Members of Congress, determine if they are a military veteran. Research their background thoroughly. Respond with a JSON array only, no other text.

Members:
${memberList}

Respond in this exact JSON format only, including the ID field exactly as provided:
[
  {
    "id": "bioguideId from the list",
    "memberName": "Name exactly as listed",
    "isVeteran": true or false,
    "serviceBranch": "branch name or null",
    "serviceDetails": "brief description of service or null",
    "yearsOfService": "e.g. 1990-1995 or null",
    "rank": "highest rank achieved or null",
    "confidence": "high" or "medium" or "low"
  }
]`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 3000,
        }),
      });

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || "";

      let parsedResults: any[] = [];
      try {
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedResults = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse batch veteran research:", rawContent);
      }

      const matchedBioguides = new Set<string>();
      const newRecords = [];
      for (const result of parsedResults) {
        let member = result.id ? toResearch.find((m: any) => m.bioguideId === result.id && !matchedBioguides.has(m.bioguideId)) : null;

        if (!member) {
          const resultName = (result.memberName || "").toLowerCase().trim();
          member = toResearch.find((m: any) => {
            if (matchedBioguides.has(m.bioguideId)) return false;
            const mName = m.memberName.toLowerCase().trim();
            if (mName === resultName) return true;
            if (resultName.includes(mName) || mName.includes(resultName)) return true;
            const mParts = mName.split(/\s+/);
            const rParts = resultName.split(/\s+/);
            const mLast = mParts[mParts.length - 1];
            const rLast = rParts[rParts.length - 1];
            const mFirst = mParts[0] || "";
            const rFirst = rParts[0] || "";
            if (mLast === rLast && mFirst === rFirst) return true;
            return false;
          });
        }
        if (!member) {
          console.warn("[Veterans] Could not match AI result:", result.id, result.memberName);
          continue;
        }
        matchedBioguides.add(member.bioguideId);

        try {
          const record = await db.insert(veteranCongressMembers).values({
            clientId,
            bioguideId: member.bioguideId,
            memberName: member.memberName,
            chamber: member.chamber || null,
            state: member.state || null,
            party: member.party || null,
            isVeteran: !!result.isVeteran,
            serviceBranch: result.serviceBranch || null,
            serviceDetails: result.serviceDetails || null,
            yearsOfService: result.yearsOfService || null,
            rank: result.rank || null,
            source: "ai_research",
            confidence: result.confidence || "medium",
          }).returning();
          newRecords.push(record[0]);
        } catch (insertErr) {
          console.error("Error inserting veteran record for", member.memberName, insertErr);
        }
      }

      const allRecords = [...existingRecords, ...newRecords];
      res.json({ results: allRecords, researched: newRecords.length });
    } catch (error: any) {
      console.error("Error batch researching veterans:", error);
      res.status(500).json({ message: error.message || "Failed to batch research veterans" });
    }
  });

  app.get("/api/veterans/staffers", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { or, ilike, sql } = await import("drizzle-orm");

      const militaryKeywords = [
        '%veteran%', '%military%', '%armed forces%', '%army%', '%navy%', '%marine%',
        '%air force%', '%coast guard%', '%national guard%', '%defense%', '%DOD%',
        '%pentagon%', '%VA %', '%veterans affairs%', '%military liaison%',
        '%defense liaison%', '%armed services%', '%space force%'
      ];

      const titleConditions = militaryKeywords.map(kw => ilike(legistormStaffers.currentTitle, kw));
      const careerConditions = militaryKeywords.map(kw => ilike(legistormStaffers.careerResearch, kw));

      const staffers = await db.select().from(legistormStaffers)
        .where(or(...titleConditions, ...careerConditions))
        .limit(1000);

      res.json(staffers);
    } catch (error: any) {
      console.error("Error fetching veteran staffers:", error);
      res.status(500).json({ message: error.message || "Failed to fetch veteran staffers" });
    }
  });

  app.delete("/api/veterans/members/:id", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      await db.delete(veteranCongressMembers).where(eq(veteranCongressMembers.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete veteran record" });
    }
  });

  // ==================== PLATFORM MODULES ROUTES ====================

  app.get("/api/modules", isAuthenticated, async (req, res) => {
    try {
      const modules = await storage.getModules();
      res.json(modules);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch modules" });
    }
  });

  app.post("/api/modules", isAuthenticated, async (req, res) => {
    try {
      const parsed = z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        icon: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
      const mod = await storage.createModule(parsed.data);
      res.json(mod);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create module" });
    }
  });

  app.get("/api/clients/:clientId/modules", isAuthenticated, async (req, res) => {
    try {
      const clientModules = await storage.getClientModules(req.params.clientId);
      res.json(clientModules);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch client modules" });
    }
  });

  app.post("/api/clients/:clientId/modules/:moduleId/enable", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.enableClientModule(req.params.clientId, req.params.moduleId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to enable module" });
    }
  });

  app.post("/api/clients/:clientId/modules/:moduleId/disable", isAuthenticated, async (req, res) => {
    try {
      await storage.disableClientModule(req.params.clientId, req.params.moduleId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to disable module" });
    }
  });

  app.get("/api/modules/check/:moduleKey", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.json({ enabled: false });
      const enabled = await storage.isModuleEnabled(clientId, req.params.moduleKey);
      res.json({ enabled });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to check module" });
    }
  });

  // ==================== SPORTS MODULE ROUTES ====================

  app.get("/api/sports/teams", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const teams = await storage.getSportsTeams(clientId);
      res.json(teams);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch sports teams" });
    }
  });

  app.get("/api/sports/teams/:id", isAuthenticated, async (req, res) => {
    try {
      const team = await storage.getSportsTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch team" });
    }
  });

  const createSportsTeamSchema = z.object({
    name: z.string().min(1),
    league: z.string().optional(),
    conference: z.string().optional(),
    division: z.string().optional(),
    level: z.string().optional(),
    sport: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    venue: z.string().optional(),
    website: z.string().optional(),
    logoUrl: z.string().optional(),
    socialTwitter: z.string().optional(),
    socialInstagram: z.string().optional(),
    socialFacebook: z.string().optional(),
    communityUrl: z.string().optional(),
    ticketPartnerUrl: z.string().optional(),
    estimatedAttendance: z.number().optional(),
    notes: z.string().optional(),
    outreachStatus: z.string().optional(),
    outreachNotes: z.string().optional(),
    abbreviation: z.string().optional(),
  });

  app.post("/api/sports/teams", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const parsed = createSportsTeamSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
      const team = await storage.createSportsTeam({ ...parsed.data, clientId });
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create team" });
    }
  });

  app.patch("/api/sports/teams/:id", isAuthenticated, async (req, res) => {
    try {
      const team = await storage.updateSportsTeam(req.params.id, req.body);
      if (!team) return res.status(404).json({ message: "Team not found" });
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to update team" });
    }
  });

  app.delete("/api/sports/teams/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteSportsTeam(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to delete team" });
    }
  });

  app.post("/api/sports/teams/:id/research", isAuthenticated, async (req, res) => {
    try {
      const team = await storage.getSportsTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });

      const { researchPoliticalEntity } = await import("./services/research-agent");
      const teamType = team.level === "college" ? "college sports program" : "professional sports franchise";
      const query = `${team.name} ${teamType}${team.league ? ` (${team.league})` : ""}${team.city ? `, ${team.city}` : ""}`;
      const result = await researchPoliticalEntity(query, "organization");

      let cleanContent = result.content || result.summary || "";
      if (cleanContent && typeof cleanContent === "string") {
        try {
          const parsed = JSON.parse(cleanContent);
          cleanContent = parsed?.rawContent || parsed?.content || parsed?.bio || 
            Object.values(parsed).filter((v: any) => typeof v === "string" && (v as string).length > 20).join("\n\n") || cleanContent;
        } catch {}
      }
      if (cleanContent) {
        await storage.updateSportsTeam(team.id, {
          aiResearch: cleanContent,
        });
      }

      res.json({ success: true, content: cleanContent, summary: result.summary, sources: result.sources });
    } catch (error: any) {
      console.error("[Sports Research] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to research team" });
    }
  });

  app.post("/api/sports/teams/:id/scrape", isAuthenticated, async (req, res) => {
    try {
      const team = await storage.getSportsTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const url = req.body.url || team.website;
      if (!url) return res.status(400).json({ message: "No URL provided or team website not set" });

      const { extractContentFromUrl } = await import("./services/research-agent");
      const result = await extractContentFromUrl(url);

      await storage.updateSportsTeam(team.id, {
        scrapedData: result as any,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("[Sports Scrape] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to scrape team website" });
    }
  });

  app.post("/api/sports/teams/:id/find-people", isAuthenticated, async (req, res) => {
    try {
      const team = await storage.getSportsTeam(req.params.id);
      if (!team) return res.status(404).json({ message: "Team not found" });

      const parsed = z.object({
        jobTitle: z.string().optional(),
        searchType: z.enum(["people", "leadership"]).optional().default("people"),
        limit: z.number().min(1).max(50).optional().default(20),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });

      const { findSportsTeamPeople } = await import("./services/sports-people-finder");
      const { results, sources } = await findSportsTeamPeople(
        {
          name: team.name,
          league: team.league,
          sport: team.sport,
          city: team.city,
          state: team.state,
          website: team.website,
        },
        parsed.data.searchType,
        parsed.data.jobTitle,
      );

      res.json({ success: true, count: results.length, data: results, sources });
    } catch (error: any) {
      console.error("[Sports Find People] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to find people" });
    }
  });

  // Sports Contacts
  app.get("/api/sports/teams/:teamId/contacts", isAuthenticated, async (req, res) => {
    try {
      const contacts = await storage.getSportsContacts(req.params.teamId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch contacts" });
    }
  });

  app.get("/api/sports/contacts", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const contacts = await storage.getSportsContactsByClient(clientId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to fetch contacts" });
    }
  });

  const createSportsContactSchema = z.object({
    teamId: z.string().optional(),
    name: z.string().min(1),
    title: z.string().optional(),
    department: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedinUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    roleType: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/sports/contacts", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "Not assigned to a client" });
      const parsed = createSportsContactSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });

      const cleanContactField = (val: string | undefined): string | undefined => {
        if (!val) return undefined;
        let cleaned = val
          .replace(/\*\*/g, '')
          .replace(/\[\d+\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (/^TITLE:\s*/i.test(cleaned)) {
          cleaned = cleaned.replace(/^TITLE:\s*/i, '').trim();
        }
        cleaned = cleaned.replace(/\|\s*DEPT:.*$/i, '').replace(/\|\s*TITLE:.*$/i, '').trim();
        return cleaned || undefined;
      };

      const cleanedData = {
        ...parsed.data,
        title: cleanContactField(parsed.data.title),
        department: cleanContactField(parsed.data.department),
        name: parsed.data.name.replace(/\*\*/g, '').replace(/\[\d+\]/g, '').trim(),
      };

      const contact = await storage.createSportsContact({ ...cleanedData, clientId });
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create contact" });
    }
  });

  app.patch("/api/sports/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const contact = await storage.updateSportsContact(req.params.id, req.body);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to update contact" });
    }
  });

  app.delete("/api/sports/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteSportsContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to delete contact" });
    }
  });

  app.post("/api/sports/contacts/:id/enrich", isAuthenticated, async (req, res) => {
    try {
      const contact = await storage.getSportsContact(req.params.id);
      if (!contact) return res.status(404).json({ message: "Contact not found" });

      let teamName = "Unknown";
      if (contact.teamId) {
        const team = await storage.getSportsTeam(contact.teamId);
        if (team) teamName = team.name;
      }

      const { enrichSingleContact } = await import("./services/sports-people-finder");
      const result = await enrichSingleContact(contact.name, teamName);

      if (!result) {
        return res.json({ success: false, message: "No contact information found in People Data Labs" });
      }

      const updates: Record<string, string> = {};
      if (result.email && !contact.email) updates.email = result.email;
      if (result.phone && !contact.phone) updates.phone = result.phone;
      if (result.linkedinUrl && !contact.linkedinUrl) updates.linkedinUrl = result.linkedinUrl;
      if (result.imageUrl && !contact.imageUrl) updates.imageUrl = result.imageUrl;

      if (Object.keys(updates).length === 0) {
        return res.json({ success: false, message: "No new contact information found" });
      }

      const updated = await storage.updateSportsContact(req.params.id, updates);
      res.json({ success: true, contact: updated, fieldsUpdated: Object.keys(updates) });
    } catch (error: any) {
      console.error("[Sports Enrich] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to enrich contact" });
    }
  });

  // Sports search - AI-powered team discovery
  app.post("/api/sports/search", isAuthenticated, async (req, res) => {
    try {
      const parsed = z.object({
        query: z.string().min(1),
        sport: z.string().optional(),
        level: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });

      const { researchPoliticalEntity } = await import("./services/research-agent");
      const sportContext = parsed.data.sport ? ` ${parsed.data.sport}` : "";
      const levelContext = parsed.data.level === "college" ? " college" : " professional";
      const searchQuery = `${parsed.data.query}${levelContext}${sportContext} sports teams`;
      const result = await researchPoliticalEntity(searchQuery, "sports organizations");

      res.json({ success: true, content: result.content, summary: result.summary, sources: result.sources });
    } catch (error: any) {
      console.error("[Sports Search] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to search sports teams" });
    }
  });

  // Marketing Intelligence Data
  app.get("/api/marketing/data", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(400).json({ message: "No client context" });
      const category = req.query.category as string | undefined;
      const data = await storage.getMarketingData(clientId, category);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to get marketing data" });
    }
  });

  app.post("/api/marketing/data", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(400).json({ message: "No client context" });
      const parsed = insertMarketingIntelligenceDataSchema.safeParse({ ...req.body, clientId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
      const result = await storage.createMarketingData(parsed.data);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create marketing data" });
    }
  });

  app.patch("/api/marketing/data/:id", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.updateMarketingData(req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to update marketing data" });
    }
  });

  app.delete("/api/marketing/data/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMarketingData(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to delete marketing data" });
    }
  });

  // Marketing AI Recommendations
  app.get("/api/marketing/recommendations", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(400).json({ message: "No client context" });
      const recs = await storage.getMarketingRecommendations(clientId);
      res.json(recs);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to get recommendations" });
    }
  });

  app.post("/api/marketing/recommendations", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(400).json({ message: "No client context" });
      const parsed = insertMarketingAiRecommendationSchema.safeParse({ ...req.body, clientId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
      const result = await storage.createMarketingRecommendation(parsed.data);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to create recommendation" });
    }
  });

  app.post("/api/marketing/ai-analyze", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(400).json({ message: "No client context" });

      const parsed = z.object({
        question: z.string().min(1),
        context: z.string().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });

      const allData = await storage.getMarketingData(clientId);
      const dataContext = allData.map(d => `[${d.category}] ${d.label}: ${JSON.stringify(d.data)}`).join("\n");

      const { researchPoliticalEntity } = await import("./services/research-agent");
      const prompt = `You are a marketing intelligence analyst for Vet Tix, a nonprofit that distributes tickets to veterans.

Here is the current marketing data from their presentation deck:
${dataContext}

${parsed.data.context ? `Additional context: ${parsed.data.context}\n\n` : ""}
User's question: ${parsed.data.question}

Provide a detailed, data-driven analysis with specific recommendations. Reference the actual numbers and metrics from the data.`;

      const result = await researchPoliticalEntity(prompt, "marketing analysis");

      await storage.createMarketingRecommendation({
        clientId,
        title: parsed.data.question.length > 80 ? parsed.data.question.slice(0, 80) + "..." : parsed.data.question,
        content: result.content || result.summary || "",
        category: "ai_analysis",
        priority: "medium",
        status: "new",
      });

      res.json({ content: result.content, summary: result.summary, sources: result.sources });
    } catch (error: any) {
      console.error("[Marketing AI] ERROR:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to analyze marketing data" });
    }
  });

  app.get("/api/demo-videos", async (_req, res) => {
    try {
      const { demoVideos } = await import("@shared/schema");
      const { db } = await import("./db");
      const results = await db.select().from(demoVideos).orderBy(demoVideos.sortOrder);
      res.json(results.filter(v => v.isPublished));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch demo videos" });
    }
  });

  app.get("/api/admin/demo-videos", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const superAdmin = await storage.getSuperAdminByUserId(userId!);
      if (!superAdmin) return res.status(403).json({ message: "Forbidden" });
      const { demoVideos } = await import("@shared/schema");
      const { db } = await import("./db");
      const results = await db.select().from(demoVideos).orderBy(demoVideos.sortOrder);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch demo videos" });
    }
  });

  app.post("/api/admin/demo-videos", isAuthenticated, async (req, res) => {
    try {
      const { demoVideos } = await import("@shared/schema");
      const { db } = await import("./db");
      const [video] = await db.insert(demoVideos).values({
        title: req.body.title,
        description: req.body.description || null,
        videoUrl: req.body.videoUrl,
        sortOrder: req.body.sortOrder || 0,
        isPublished: true,
      }).returning();
      res.json(video);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to add demo video" });
    }
  });

  app.patch("/api/admin/demo-videos/:id", isAuthenticated, async (req, res) => {
    try {
      const { demoVideos } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const [video] = await db.update(demoVideos)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(demoVideos.id, req.params.id))
        .returning();
      if (!video) return res.status(404).json({ message: "Video not found" });
      res.json(video);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update demo video" });
    }
  });

  app.delete("/api/admin/demo-videos/:id", isAuthenticated, async (req, res) => {
    try {
      const { demoVideos } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const [deleted] = await db.delete(demoVideos)
        .where(eq(demoVideos.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Video not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete demo video" });
    }
  });

  app.post("/api/demo-access", async (req, res) => {
    try {
      const { demoAccessLogs } = await import("@shared/schema");
      const { db } = await import("./db");
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      const [session] = await db.insert(demoAccessLogs).values({
        email: email.toLowerCase().trim(),
        timeSpentSeconds: 0,
        videosViewed: 0,
        videosCompleted: 0,
      }).returning();
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create session" });
    }
  });

  app.patch("/api/demo-access/:id", async (req, res) => {
    try {
      const { demoAccessLogs } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { timeSpentSeconds, videosViewed, videosCompleted } = req.body;
      const updates: any = { lastActivity: new Date() };
      if (typeof timeSpentSeconds === "number") updates.timeSpentSeconds = timeSpentSeconds;
      if (typeof videosViewed === "number") updates.videosViewed = videosViewed;
      if (typeof videosCompleted === "number") updates.videosCompleted = videosCompleted;
      const [session] = await db.update(demoAccessLogs)
        .set(updates)
        .where(eq(demoAccessLogs.id, req.params.id))
        .returning();
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update session" });
    }
  });

  app.get("/api/admin/demo-access-logs", isAuthenticated, async (_req, res) => {
    try {
      const { demoAccessLogs } = await import("@shared/schema");
      const { db } = await import("./db");
      const { desc } = await import("drizzle-orm");
      const results = await db.select().from(demoAccessLogs).orderBy(desc(demoAccessLogs.sessionStart));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch access logs" });
    }
  });

  app.delete("/api/admin/demo-access-logs", isAuthenticated, async (_req, res) => {
    try {
      const { demoAccessLogs } = await import("@shared/schema");
      const { db } = await import("./db");
      await db.delete(demoAccessLogs);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to clear access logs" });
    }
  });

  // ============================================================
  // LOCAL GOVERNMENT INTELLIGENCE ROUTES
  // ============================================================

  // GET /api/local-gov/grants?keyword=broadband&state=CO&eligibility=city
  app.get("/api/local-gov/grants", isAuthenticated, async (req, res) => {
    try {
      const { keyword = "infrastructure", state = "", eligibility = "" } = req.query as Record<string, string>;
      const stateFilter = (state && state !== "all") ? state : "";
      const eligibilityFilter = (eligibility && eligibility !== "all") ? eligibility : "";

      // Try grants.gov search API
      const searchBody: any = {
        keyword: keyword,
        rows: 20,
        status: "posted",
      };

      let grants: any[] = [];

      try {
        const grantsRes = await fetch(
          `https://apply07.grants.gov/grantsws/rest/opportunities/search/?keyword=${encodeURIComponent(keyword)}&rows=20&oppStatuses=posted`,
          {
            headers: { "Accept": "application/json" },
          }
        );
        if (grantsRes.ok) {
          const data = await grantsRes.json();
          grants = (data.oppHits || data.opportunities || []).slice(0, 20);
        }
      } catch (e) {
        console.log("grants.gov fetch failed, trying simpler API", e);
      }

      // Fallback: simpler.grants.gov
      if (grants.length === 0) {
        try {
          const simpleRes = await fetch("https://api.simpler.grants.gov/v1/opportunities/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: keyword, pagination: { page_size: 20, page_offset: 1 } }),
          });
          if (simpleRes.ok) {
            const data = await simpleRes.json();
            grants = (data.data || []).map((g: any) => ({
              id: g.opportunity_id,
              title: g.opportunity_title,
              agency: g.agency_name || g.agency,
              deadline: g.close_date,
              maxAward: g.award_ceiling,
              description: g.summary?.description,
              url: `https://grants.gov/search-results-detail/${g.opportunity_id}`,
              status: g.opportunity_status,
              category: g.category_of_funding_activity,
            }));
          }
        } catch (e2) {
          console.log("simpler.grants.gov also failed", e2);
        }
      }

      // Normalize grants.gov format
      if (grants.length > 0 && grants[0].oppNumber !== undefined) {
        grants = grants.map((g: any) => ({
          id: g.id || g.oppNumber,
          title: g.title || g.oppTitle,
          agency: g.agencyName || g.agencyCode,
          deadline: g.closeDate || g.deadline,
          maxAward: g.awardCeiling || g.maxAward,
          description: g.synopsis || g.description,
          url: `https://grants.gov/search-results-detail/${g.id || g.oppNumber}`,
          status: g.oppStatus || "posted",
          category: g.fundingCategory || "",
          eligibility: g.eligibleApplicants || [],
        }));
      }

      // Filter by eligibility if provided
      if (eligibility && grants.length > 0) {
        grants = grants.filter((g: any) => {
          const elig = JSON.stringify(g.eligibility || "").toLowerCase();
          return elig.includes(eligibility.toLowerCase()) || elig === "";
        });
      }

      res.json({ grants, total: grants.length, keyword, state });
    } catch (error: any) {
      console.error("Local gov grants error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch grants" });
    }
  });

  // GET /api/local-gov/spending?recipient=Denver&state=CO
  app.get("/api/local-gov/spending", isAuthenticated, async (req, res) => {
    try {
      const { recipient = "", state = "" } = req.query as Record<string, string>;

      // USASpending valid award_type_codes: grants only (02=Block Grant, 03=Formula Grant, 04=Project Grant, 05=Cooperative Agreement)
      const filters: any = {
        time_period: [{ start_date: "2023-01-01", end_date: "2025-12-31" }],
        award_type_codes: ["02", "03", "04", "05"],
      };

      if (recipient) {
        filters.recipient_search_text = [recipient];
      }
      if (state && state !== "all") {
        filters.place_of_performance_locations = [{ country: "USA", state: state.toUpperCase() }];
      }

      const body = {
        filters,
        fields: [
          "Award ID", "Recipient Name", "Award Amount", "Awarding Agency",
          "Awarding Sub Agency", "Award Type", "Start Date", "End Date",
          "Place of Performance State Code", "Place of Performance City Name",
          "Description"
        ],
        sort: "Award Amount",
        order: "desc",
        limit: 20,
        page: 1,
      };

      const spendingRes = await fetch(
        "https://api.usaspending.gov/api/v2/search/spending_by_award/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!spendingRes.ok) {
        const errText = await spendingRes.text();
        throw new Error(`USASpending API error: ${spendingRes.status} ${errText}`);
      }

      const data = await spendingRes.json();
      const awards = (data.results || []).map((a: any) => ({
        id: a["Award ID"],
        recipient: a["Recipient Name"],
        amount: a["Award Amount"],
        awardingAgency: a["Awarding Agency"],
        subAgency: a["Awarding Sub Agency"],
        awardType: a["Award Type"],
        startDate: a["Start Date"],
        endDate: a["End Date"],
        state: a["Place of Performance State Code"],
        city: a["Place of Performance City Name"],
        description: a["Description"],
      }));

      res.json({ awards, total: data.page_metadata?.total || awards.length, recipient, state });
    } catch (error: any) {
      console.error("Local gov spending error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch spending data" });
    }
  });

  // GET /api/local-gov/bills?state=co&keyword=infrastructure
  app.get("/api/local-gov/bills", isAuthenticated, async (req, res) => {
    try {
      const { state = "co", keyword = "infrastructure" } = req.query as Record<string, string>;

      // Map state abbreviation to OpenStates jurisdiction format
      const stateMap: Record<string, string> = {
        al: "us_al", ak: "us_ak", az: "us_az", ar: "us_ar", ca: "us_ca",
        co: "us_co", ct: "us_ct", de: "us_de", fl: "us_fl", ga: "us_ga",
        hi: "us_hi", id: "us_id", il: "us_il", in: "us_in", ia: "us_ia",
        ks: "us_ks", ky: "us_ky", la: "us_la", me: "us_me", md: "us_md",
        ma: "us_ma", mi: "us_mi", mn: "us_mn", ms: "us_ms", mo: "us_mo",
        mt: "us_mt", ne: "us_ne", nv: "us_nv", nh: "us_nh", nj: "us_nj",
        nm: "us_nm", ny: "us_ny", nc: "us_nc", nd: "us_nd", oh: "us_oh",
        ok: "us_ok", or: "us_or", pa: "us_pa", ri: "us_ri", sc: "us_sc",
        sd: "us_sd", tn: "us_tn", tx: "us_tx", ut: "us_ut", vt: "us_vt",
        va: "us_va", wa: "us_wa", wv: "us_wv", wi: "us_wi", wy: "us_wy",
        dc: "us_dc",
      };

      const jurisdiction = stateMap[state.toLowerCase()] || `us_${state.toLowerCase()}`;

      const url = `https://v3.openstates.org/bills?jurisdiction=${jurisdiction}&q=${encodeURIComponent(keyword)}&per_page=15&sort=updated_desc&include=abstracts&include=sponsorships`;

      const billsRes = await fetch(url, {
        headers: { "Accept": "application/json" },
      });

      let bills: any[] = [];
      if (billsRes.ok) {
        const data = await billsRes.json();
        bills = (data.results || []).map((b: any) => ({
          id: b.id,
          identifier: b.identifier,
          title: b.title,
          abstract: b.abstracts?.[0]?.abstract || "",
          status: b.latest_action_description || b.status,
          lastAction: b.latest_action_date,
          sponsor: b.sponsorships?.[0]?.name || "Unknown",
          session: b.session,
          jurisdiction: b.jurisdiction?.name || state.toUpperCase(),
          url: b.openstates_url,
        }));
      } else {
        // If unauthenticated gets rate-limited, return informative message
        console.log("OpenStates API response:", billsRes.status);
      }

      res.json({ bills, total: bills.length, state, keyword });
    } catch (error: any) {
      console.error("Local gov bills error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch bills" });
    }
  });

  // POST /api/local-gov/gap-analysis { industry: string, state: string }
  app.post("/api/local-gov/gap-analysis", isAuthenticated, async (req, res) => {
    try {
      const { industry, state } = req.body as { industry: string; state: string };
      if (!industry || !state) {
        return res.status(400).json({ message: "industry and state are required" });
      }

      const { researchWithPerplexity } = await import("./services/research-agent");

      // Fetch recent federal spending in that state for industry
      let spendingContext = "";
      try {
        const spendingBody = {
          filters: {
            time_period: [{ start_date: "2023-01-01", end_date: "2025-12-31" }],
            award_type_codes: ["02", "03", "04", "05"],
            keyword: [industry],
            place_of_performance_locations: [{ country: "USA", state: state.toUpperCase() }],
          },
          fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Description"],
          sort: "Award Amount",
          order: "desc",
          limit: 10,
          page: 1,
        };
        const spendRes = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(spendingBody),
        });
        if (spendRes.ok) {
          const spendData = await spendRes.json();
          const awards = spendData.results || [];
          if (awards.length > 0) {
            spendingContext = `Recent federal spending in ${state} related to ${industry}:\n` +
              awards.slice(0, 5).map((a: any) =>
                `- ${a["Recipient Name"]}: $${(a["Award Amount"] || 0).toLocaleString()} from ${a["Awarding Agency"]} (${a["Description"] || ""})`
              ).join("\n");
          } else {
            spendingContext = `No recent federal spending found in ${state} for ${industry} sector.`;
          }
        }
      } catch (e) {
        spendingContext = `Could not fetch spending data for ${state}.`;
      }

      // Fetch open grants for that industry
      let grantsContext = "";
      try {
        const grantsRes = await fetch(
          `https://apply07.grants.gov/grantsws/rest/opportunities/search/?keyword=${encodeURIComponent(industry)}&rows=10&oppStatuses=posted`,
          { headers: { "Accept": "application/json" } }
        );
        if (grantsRes.ok) {
          const grantsData = await grantsRes.json();
          const opportunities = grantsData.oppHits || grantsData.opportunities || [];
          if (opportunities.length > 0) {
            grantsContext = `Currently open federal grants related to ${industry}:\n` +
              opportunities.slice(0, 5).map((g: any) =>
                `- ${g.title || g.oppTitle}: up to $${(g.awardCeiling || g.maxAward || 0).toLocaleString()} from ${g.agencyName || g.agencyCode || "Federal Agency"} (deadline: ${g.closeDate || g.deadline || "TBD"})`
              ).join("\n");
          }
        }
      } catch (e) {
        grantsContext = "";
      }

      const prompt = `You are a government affairs strategist helping lobbyists identify unmet federal funding opportunities for their clients.

Industry/Sector: ${industry}
State: ${state}

DATA:
${spendingContext || "No spending data available."}

${grantsContext || "No grant data available."}

Please provide a strategic briefing (400-600 words) covering:
1. **Current Federal Investment**: What federal money is currently flowing to ${state} in the ${industry} sector, and which local governments or agencies are receiving it?
2. **Funding Gaps**: Based on the spending patterns and available grants, where are the unmet opportunities? Which cities, counties, or state agencies appear underserved?
3. **Open Grant Opportunities**: Which of the currently open federal grants are most relevant for local governments in ${state} pursuing ${industry} initiatives?
4. **Strategic Recommendations**: Specific, actionable steps a lobbyist could take to help clients in ${state} capture these federal dollars — including which grant programs to pursue, which local government decision-makers to engage, and what legislative or regulatory angles to pursue.
5. **Competitive Landscape**: Which neighboring states are winning more federal ${industry} funding, and what can ${state} learn from them?

Format your response with clear headers and bullet points. Be specific and data-driven.`;

      const result = await researchWithPerplexity(prompt);

      res.json({
        briefing: result.content,
        citations: result.citations,
        industry,
        state,
        dataUsed: {
          spending: spendingContext ? true : false,
          grants: grantsContext ? true : false,
        },
      });
    } catch (error: any) {
      console.error("Local gov gap analysis error:", error);
      res.status(500).json({ message: error.message || "Failed to run gap analysis" });
    }
  });

  // ─── Decision Briefs ────────────────────────────────────────────────────────

  const createBriefSchema = z.object({
    title: z.string().min(1).max(500),
    clientContext: z.string().max(2000).nullable().optional(),
    sensitivity: z.enum(["internal", "shareable"]).default("internal"),
    sourceUrls: z.array(z.string().url()).min(1).max(5),
  });

  const updateBriefSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    clientContext: z.string().max(2000).nullable().optional(),
    sensitivity: z.enum(["internal", "shareable"]).optional(),
    sourceUrls: z.array(z.string().url()).min(1).max(5).optional(),
  });

  // POST /api/briefs — create brief + sources
  app.post("/api/briefs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const parsed = createBriefSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

      const { title, clientContext, sensitivity, sourceUrls } = parsed.data;

      const { db } = await import("./db");
      const { briefs, briefSources } = await import("@shared/schema");
      const { randomUUID } = await import("crypto");

      const [brief] = await db
        .insert(briefs)
        .values({
          clientId,
          createdByUserId: userId,
          publicUuid: randomUUID(),
          title,
          clientContext: clientContext ?? null,
          sensitivity,
        })
        .returning();

      if (sourceUrls.length > 0) {
        await db.insert(briefSources).values(
          sourceUrls.map((url, i) => ({
            briefId: brief.id,
            citationNumber: i + 1,
            url,
            tier: 3,
          })),
        );
      }

      const sources = await db.select().from(briefSources).where(
        (await import("drizzle-orm")).eq(briefSources.briefId, brief.id),
      );

      res.status(201).json({ ...brief, sources });
    } catch (err: any) {
      console.error("POST /api/briefs error:", err);
      res.status(500).json({ message: err.message ?? "Failed to create brief" });
    }
  });

  // GET /api/briefs — list briefs for client
  app.get("/api/briefs", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const { db } = await import("./db");
      const { briefs } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(briefs)
        .where(eq(briefs.clientId, clientId))
        .orderBy(desc(briefs.createdAt));

      res.json(rows);
    } catch (err: any) {
      console.error("GET /api/briefs error:", err);
      res.status(500).json({ message: err.message ?? "Failed to list briefs" });
    }
  });

  // GET /api/briefs/:id — single brief with sources
  app.get("/api/briefs/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const { db } = await import("./db");
      const { briefs, briefSources } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [brief] = await db
        .select()
        .from(briefs)
        .where(and(eq(briefs.id, req.params.id), eq(briefs.clientId, clientId)))
        .limit(1);

      if (!brief) return res.status(404).json({ message: "Brief not found" });

      const sources = await db
        .select()
        .from(briefSources)
        .where(eq(briefSources.briefId, brief.id))
        .orderBy(briefSources.citationNumber);

      res.json({ ...brief, sources });
    } catch (err: any) {
      console.error("GET /api/briefs/:id error:", err);
      res.status(500).json({ message: err.message ?? "Failed to get brief" });
    }
  });

  // PATCH /api/briefs/:id — update metadata and/or replace sources
  app.patch("/api/briefs/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const parsed = updateBriefSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

      const { db } = await import("./db");
      const { briefs, briefSources } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [existing] = await db
        .select({ id: briefs.id, status: briefs.status })
        .from(briefs)
        .where(and(eq(briefs.id, req.params.id), eq(briefs.clientId, clientId)))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Brief not found" });
      if (existing.status === "generating") {
        return res.status(409).json({ message: "Cannot edit a brief that is currently generating" });
      }

      const { sourceUrls, ...briefFields } = parsed.data;

      if (Object.keys(briefFields).length > 0) {
        await db
          .update(briefs)
          .set({ ...briefFields, updatedAt: new Date() })
          .where(eq(briefs.id, existing.id));
      }

      if (sourceUrls) {
        await db.delete(briefSources).where(eq(briefSources.briefId, existing.id));
        await db.insert(briefSources).values(
          sourceUrls.map((url, i) => ({
            briefId: existing.id,
            citationNumber: i + 1,
            url,
            tier: 3,
          })),
        );
      }

      const [updated] = await db.select().from(briefs).where(eq(briefs.id, existing.id)).limit(1);
      const sources = await db.select().from(briefSources).where(eq(briefSources.briefId, existing.id)).orderBy(briefSources.citationNumber);

      res.json({ ...updated, sources });
    } catch (err: any) {
      console.error("PATCH /api/briefs/:id error:", err);
      res.status(500).json({ message: err.message ?? "Failed to update brief" });
    }
  });

  // DELETE /api/briefs/:id
  app.delete("/api/briefs/:id", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const { db } = await import("./db");
      const { briefs, briefSources, briefViews } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [existing] = await db
        .select({ id: briefs.id })
        .from(briefs)
        .where(and(eq(briefs.id, req.params.id), eq(briefs.clientId, clientId)))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Brief not found" });

      await db.delete(briefViews).where(eq(briefViews.briefId, existing.id));
      await db.delete(briefSources).where(eq(briefSources.briefId, existing.id));
      await db.delete(briefs).where(eq(briefs.id, existing.id));

      res.status(204).end();
    } catch (err: any) {
      console.error("DELETE /api/briefs/:id error:", err);
      res.status(500).json({ message: err.message ?? "Failed to delete brief" });
    }
  });

  // POST /api/briefs/:id/generate — kick off async generation
  app.post("/api/briefs/:id/generate", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const { db } = await import("./db");
      const { briefs } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [existing] = await db
        .select({ id: briefs.id, status: briefs.status })
        .from(briefs)
        .where(and(eq(briefs.id, req.params.id), eq(briefs.clientId, clientId)))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Brief not found" });
      if (existing.status === "generating") {
        return res.status(409).json({ message: "Brief is already generating" });
      }

      // Fire and forget — client polls GET /api/briefs/:id for status
      const { generateBrief } = await import("./services/brief-service");
      generateBrief(existing.id).catch((err) =>
        console.error(`generateBrief(${existing.id}) failed:`, err),
      );

      res.status(202).json({ message: "Generation started", briefId: existing.id });
    } catch (err: any) {
      console.error("POST /api/briefs/:id/generate error:", err);
      res.status(500).json({ message: err.message ?? "Failed to start generation" });
    }
  });

  // GET /api/briefs/public/:publicUuid — public magic-link view (no auth)
  app.get("/api/briefs/public/:publicUuid", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { briefs, briefSources } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [brief] = await db
        .select()
        .from(briefs)
        .where(eq(briefs.publicUuid, req.params.publicUuid))
        .limit(1);

      if (!brief || brief.status !== "ready") {
        return res.status(404).json({ message: "Brief not found or not ready" });
      }

      const sources = await db
        .select()
        .from(briefSources)
        .where(eq(briefSources.briefId, brief.id))
        .orderBy(briefSources.citationNumber);

      // Strip internal fields before returning
      const { clientId, createdByUserId, generationError, ...publicBrief } = brief as any;

      res.json({ ...publicBrief, sources });
    } catch (err: any) {
      console.error("GET /api/briefs/public/:publicUuid error:", err);
      res.status(500).json({ message: err.message ?? "Failed to get brief" });
    }
  });

  // POST /api/briefs/public/:publicUuid/view — log an email-gated view
  app.post("/api/briefs/public/:publicUuid/view", async (req, res) => {
    try {
      const emailSchema = z.object({ email: z.string().email() });
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Valid email required" });

      const { db } = await import("./db");
      const { briefs, briefViews } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [brief] = await db
        .select({ id: briefs.id })
        .from(briefs)
        .where(eq(briefs.publicUuid, req.params.publicUuid))
        .limit(1);

      if (!brief) return res.status(404).json({ message: "Brief not found" });

      await db.insert(briefViews).values({
        briefId: brief.id,
        email: parsed.data.email,
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? req.socket.remoteAddress ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });

      res.status(201).json({ message: "View logged" });
    } catch (err: any) {
      console.error("POST /api/briefs/public/:publicUuid/view error:", err);
      res.status(500).json({ message: err.message ?? "Failed to log view" });
    }
  });

  // GET /api/briefs/:id/views — view analytics for a brief (authenticated)
  app.get("/api/briefs/:id/views", isAuthenticated, async (req, res) => {
    try {
      const clientId = await getClientId(req);
      if (!clientId) return res.status(403).json({ message: "No client context" });

      const { db } = await import("./db");
      const { briefs, briefViews } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const [existing] = await db
        .select({ id: briefs.id })
        .from(briefs)
        .where(and(eq(briefs.id, req.params.id), eq(briefs.clientId, clientId)))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Brief not found" });

      const views = await db
        .select()
        .from(briefViews)
        .where(eq(briefViews.briefId, existing.id))
        .orderBy(desc(briefViews.viewedAt));

      res.json(views);
    } catch (err: any) {
      console.error("GET /api/briefs/:id/views error:", err);
      res.status(500).json({ message: err.message ?? "Failed to get views" });
    }
  });

  // ─── Government Press Releases — List ────────────────────────────────────
  // GET /api/government-press/releases
  app.get("/api/government-press/releases", isAuthenticated, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { governmentPressReleases } = await import("@shared/schema");
      const { desc, isNotNull } = await import("drizzle-orm");
      const releases = await db
        .select()
        .from(governmentPressReleases)
        .where(isNotNull(governmentPressReleases.publishedAt))
        .orderBy(desc(governmentPressReleases.publishedAt))
        .limit(50);
      res.json(releases);
    } catch (err: any) {
      console.error("GET /api/government-press/releases error:", err);
      res.status(500).json({ message: err.message ?? "Failed to fetch press releases" });
    }
  });

  // ─── Government Press Release Sync ────────────────────────────────────────
  // POST /api/admin/government-press/sync
  // Body (optional): { department_slug: string }
  // Syncs one source (if department_slug provided) or all active sources.
  app.post("/api/admin/government-press/sync", isAuthenticated, async (req, res) => {
    try {
      const { syncAllSources } = await import("./services/government-press-service");
      const departmentSlug: string | undefined = req.body?.department_slug || undefined;
      const results = await syncAllSources(departmentSlug);

      const totalInserted = results.reduce((s, r) => s + r.releasesInserted, 0);
      const totalUpdated = results.reduce((s, r) => s + r.releasesUpdated, 0);
      const totalFound = results.reduce((s, r) => s + r.releasesFound, 0);
      const hasErrors = results.some((r) => r.status === "error");

      res.json({
        sources: results.length,
        releasesFound: totalFound,
        releasesInserted: totalInserted,
        releasesUpdated: totalUpdated,
        overallStatus: hasErrors ? "partial" : "success",
        details: results,
      });
    } catch (err: any) {
      console.error("POST /api/admin/government-press/sync error:", err);
      res.status(500).json({ message: err.message ?? "Sync failed" });
    }
  });

  // ─── Morning Brief ────────────────────────────────────────────────────────
  // GET /api/morning-brief/:clientId
  // Returns AI-ranked intelligence for the given client.
  // Response is cached in-memory for 10 minutes per clientId.
  app.get("/api/morning-brief/:clientId", isAuthenticated, async (req, res) => {
    try {
      // Authorization: a user may only read their own client's brief.
      // Super admins (not impersonating) may read any client's brief.
      const userId = getUserId(req);
      const superAdmin = userId ? await storage.getSuperAdminByUserId(userId) : null;
      const isUnscopedSuperAdmin = !!superAdmin && !req.session?.impersonatingClientId;
      if (!isUnscopedSuperAdmin) {
        const ownClientId = await getClientId(req);
        if (!ownClientId || ownClientId !== req.params.clientId) {
          return res.status(403).json({ message: "Not authorized for this client" });
        }
      }

      const { rankItemsForClient } = await import("./services/morning-brief-service");
      const result = await rankItemsForClient(req.params.clientId);
      res.json(result);
    } catch (err: any) {
      console.error("GET /api/morning-brief error:", err);
      res.status(500).json({ message: err.message ?? "Failed to generate morning brief" });
    }
  });

  return httpServer;
}
