import "dotenv/config";
// Dynamic import ensures .env is loaded before the database and configuration.
const { app } = await import("./app");
const { bootstrapAdmin } = await import("./modules/auth/auth");
await bootstrapAdmin();
const { flushNotifications } = await import("./lib/notifications");
const { branches } = await import("./lib/branches");
branches();
const notificationTimer = setInterval(() => { void flushNotifications().catch(() => console.error("Notification worker failed")); }, 15_000);
notificationTimer.unref();
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Pizza House API: http://127.0.0.1:${port}`),
);
const close = () => { clearInterval(notificationTimer); server.close(() => process.exit(0)); };
process.once("SIGINT", close);
process.once("SIGTERM", close);
