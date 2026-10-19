import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DATABASE_CONFIG_HINT, getDatabaseUrlDb2 } from "./src/lib/env";
const url = getDatabaseUrlDb2();
if (!url) throw new Error(`${DATABASE_CONFIG_HINT} Missing DATABASE_URL_DB2.`);
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schemas/db2.ts",
  out: "./drizzle/db2",
  dbCredentials: { url },
});
