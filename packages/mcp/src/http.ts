import { startHttpServer } from "./http-server";

startHttpServer().catch((error: unknown) => {
  console.error("Failed to start HTTP server:", error);
  process.exit(1);
});
