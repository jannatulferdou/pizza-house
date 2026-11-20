import "dotenv/config";
// Dynamic import ensures .env is loaded before the database and configuration.
const { app } = await import("./app.js");
const { bootstrapAdmin } = await import("./modules/auth/auth.js");
await bootstrapAdmin();
const { flushNotifications } = await import("./lib/notifications.js");
const { branches } = await import("./lib/branches.js");
branches();
const notificationTimer = setInterval(() => { void flushNotifications().catch(() => console.error("Notification worker failed")); }, 15_000);
notificationTimer.unref();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(port, host, () =>
  console.log(`Pizza House API: http://${host}:${(server.address() as import("node:net").AddressInfo).port}`),
);
const close = () => { clearInterval(notificationTimer); server.close(() => process.exit(0)); };
process.once("SIGINT", close);
process.once("SIGTERM", close);
