import "dotenv/config";
process.env.NODE_ENV = "production";
if (!process.env.APP_URL?.startsWith("https://"))
  throw new Error(
    "Production requires APP_URL with HTTPS for secure session cookies.",
  );
await import("./index.js");
