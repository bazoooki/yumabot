import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: `file:${dbPath}`,
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
