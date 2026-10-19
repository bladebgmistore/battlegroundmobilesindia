import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DATABASE_CONFIG_HINT, getDatabaseUrlDb3 } from "./src/lib/env";
const url = getDatabaseUrlDb3();
if (!url) throw new Error(`${DATABASE_CONFIG_HINT} Missing DATABASE_URL_DB3.`);
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schemas/db3.ts",
  out: "./drizzle/db3",
  dbCredentials: { url },
});
