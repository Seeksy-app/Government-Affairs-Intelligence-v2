import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { runAutoSync } from "./services/social-tracker";
import { initializeRssFeeds, aggregateAllNews, saveArticlesToDatabase, getClientRelevanceContext } from "./services/news-aggregation";
import { syncHouseDirectoryToDb, getDirectoryStats } from "./services/house-directory-service";
import { resumeInterruptedSync } from "./services/legistorm-service";
import { db } from "./db";
import { clients, platformModules } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Seed database with sample data
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Error seeding database:", error);
  }

  // Ensure platform modules exist (idempotent - runs every startup)
  try {
    const requiredModules = [
      { key: "sports", name: "Sports Intelligence", description: "Research and track professional and college sports teams, franchises, and key contacts for partnership development.", category: "intelligence", icon: "Trophy" },
      { key: "marketing_intelligence", name: "Marketing Intelligence", description: "Comprehensive marketing ROI analysis, channel performance tracking, and AI-powered GTM recommendations", category: "analytics", icon: "BarChart3" },
      { key: "legistorm", name: "LegiStorm Directory", description: "Access the full LegiStorm Congressional Staff Directory with 17,900+ staffers, position histories, and career research.", category: "directory", icon: "BookOpen" },
    ];
    for (const mod of requiredModules) {
      const [existing] = await db.select().from(platformModules).where(eq(platformModules.key, mod.key));
      if (!existing) {
        await db.insert(platformModules).values(mod);
        console.log(`Created platform module: ${mod.name}`);
      }
    }

    // Auto-enable modules for Adam Consulting Group
    const { clientModules } = await import("@shared/schema");
    const { and } = await import("drizzle-orm");
    const [adamClient] = await db.select().from(clients).where(eq(clients.name, "Adam Consulting Group"));
    if (adamClient) {
      const allModules = await db.select().from(platformModules);
      for (const mod of allModules) {
        const [existing] = await db.select().from(clientModules)
          .where(and(eq(clientModules.clientId, adamClient.id), eq(clientModules.moduleId, mod.id)));
        if (!existing) {
          await db.insert(clientModules).values({ clientId: adamClient.id, moduleId: mod.id, enabled: true });
          console.log(`Enabled module "${mod.name}" for Adam Consulting Group`);
        }
      }
    }
  } catch (error) {
    console.error("Error initializing platform modules:", error);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start auto-sync scheduler - runs every 5 minutes to check for due syncs
      setInterval(async () => {
        try {
          await runAutoSync();
        } catch (error) {
          console.error("Auto-sync scheduler error:", error);
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
      
      log("Auto-sync scheduler started");
      
      // Auto-sync House directory if cache is empty
      setTimeout(async () => {
        try {
          const stats = await getDirectoryStats();
          if (stats.totalEmployees === 0) {
            log("House directory cache is empty, syncing from directory.house.gov...");
            const result = await syncHouseDirectoryToDb();
            log(`House directory sync complete: ${result.synced} employees synced, ${result.errors} errors`);
          } else {
            log(`House directory cache has ${stats.totalEmployees} employees (last synced: ${stats.lastSynced})`);
          }
        } catch (error) {
          console.error("House directory auto-sync error:", error);
        }
      }, 5000);

      // Auto-resume interrupted LegiStorm syncs or start sync if database is incomplete
      setTimeout(async () => {
        try {
          const resumed = await resumeInterruptedSync();
          if (resumed) {
            log("LegiStorm sync auto-resumed on startup");
          }
        } catch (error) {
          console.error("LegiStorm auto-resume error:", error);
        }
      }, 8000);

      // Initialize RSS feeds and run initial news aggregation
      setTimeout(async () => {
        try {
          log("Initializing News Intelligence System...");
          await initializeRssFeeds();
          
          // Fetch news for all clients
          const allClients = await db.select().from(clients);
          if (allClients.length > 0) {
            const articles = await aggregateAllNews(168); // Last 7 days
            
            for (const client of allClients) {
              const context = await getClientRelevanceContext(client.id);
              const saved = await saveArticlesToDatabase(client.id, articles, context);
              log(`News aggregation: ${saved} articles saved for client ${client.name}`);
            }
          }
          
          log("News Intelligence System initialized");
        } catch (error) {
          console.error("News initialization error:", error);
        }
      }, 10000); // Wait 10 seconds after startup
      
      // Schedule hourly news aggregation
      setInterval(async () => {
        try {
          log("Running scheduled news aggregation...");
          const allClients = await db.select().from(clients);
          if (allClients.length > 0) {
            const articles = await aggregateAllNews(24); // Last 24 hours
            
            for (const client of allClients) {
              const context = await getClientRelevanceContext(client.id);
              await saveArticlesToDatabase(client.id, articles, context);
            }
          }
          log("Scheduled news aggregation complete");
        } catch (error) {
          console.error("Scheduled news aggregation error:", error);
        }
      }, 60 * 60 * 1000); // Every hour
    },
  );
})();
