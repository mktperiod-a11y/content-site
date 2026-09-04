import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type D1Runtime = typeof globalThis & {
  __WHERE_TO_WATCH_DB__?: D1Database;
};

export function getD1() {
  const database = (globalThis as D1Runtime).__WHERE_TO_WATCH_DB__;
  if (!database) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }

  return database;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
