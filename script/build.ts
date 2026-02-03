import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // ESM-only packages that must be externalized to avoid CJS compatibility issues
  const esmOnlyPackages = [
    "openid-client",
    "p-limit",
    "p-retry",
    "nanoid",
    "google-auth-library",
    "@google-cloud/storage",
    "resend",
    "@mendable/firecrawl-js",
  ];
  
  // Combine with other externals
  const allExternals = [...new Set([...externals, ...esmOnlyPackages])];

  // Build as ESM first, then create a CJS wrapper
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "dist/index.mjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: allExternals,
    logLevel: "info",
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
  });
  
  // Create a proper CJS wrapper that dynamically imports the ESM module
  const { writeFile } = await import("fs/promises");
  const cjsWrapper = `#!/usr/bin/env node
"use strict";
// CJS wrapper for ESM module - uses dynamic import which works in CJS
(async () => {
  try {
    await import("./index.mjs");
  } catch (err) {
    console.error("Failed to load ESM module:", err);
    process.exit(1);
  }
})();
`;
  await writeFile("dist/index.cjs", cjsWrapper.trim());
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
