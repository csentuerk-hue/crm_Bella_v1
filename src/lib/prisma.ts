import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaInitPromise: Promise<void> | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export async function ensureDatabaseInitialized() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL fehlt. Bitte eine persistente Postgres-Datenbank konfigurieren.");
  }
  if (databaseUrl.startsWith("file:")) {
    throw new Error(
      "SQLite/file DATABASE_URL ist nicht erlaubt. Bitte auf persistente Postgres-Datenbank umstellen.",
    );
  }

  if (global.prismaInitPromise) {
    return global.prismaInitPromise;
  }

  global.prismaInitPromise = (async () => {
    await prisma.$connect();
    await prisma.$queryRawUnsafe("SELECT 1");
  })();

  await global.prismaInitPromise;
}
