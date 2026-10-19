import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DATABASE_CONFIG_HINT, getDatabaseUrlDb1 } from "./src/lib/env";
const url = getDatabaseUrlDb1();
if (!url) throw new Error(`${DATABASE_CONFIG_HINT} Missing DATABASE_URL_DB1.`);
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schemas/db1.ts",
  out: "./drizzle/db1",
  dbCredentials: { url },
});
