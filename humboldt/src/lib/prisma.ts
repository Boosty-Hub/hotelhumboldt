import { Prisma, PrismaClient } from "@prisma/client";

// Códigos de error transitorios de conexión (red/pooler remoto). Ver:
// https://www.prisma.io/docs/orm/reference/error-reference
const TRANSIENT_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1008", // operation timed out
  "P1017", // server has closed the connection
]);

// Solo lecturas: son idempotentes, seguras de reintentar. Las escrituras NO se
// reintentan para no arriesgar duplicados.
const READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

function isTransient(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT_CODES.has(error.code);
  return false;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createPrismaClient() {
  return new PrismaClient().$extends({
    name: "retry-transient-reads",
    query: {
      async $allOperations({ operation, args, query }) {
        if (!READ_OPS.has(operation)) return query(args);
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (!isTransient(error) || attempt === 2) throw error;
            lastError = error;
            await wait(200 * (attempt + 1)); // 200ms, 400ms
          }
        }
        throw lastError;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
