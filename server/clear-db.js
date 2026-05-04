import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearDb() {
  console.log("🧹 Cleaning up database...");

  try {
    // Delete in order of dependencies (child first)
    await prisma.chatMessage.deleteMany({});
    await prisma.messageLog.deleteMany({});
    await prisma.broadcast.deleteMany({});
    await prisma.contact.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.segment.deleteMany({});
    
    console.log("✅ Database cleared successfully (kept Accounts, Templates & Settings).");
  } catch (error) {
    console.error("❌ Error clearing database:", error.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

clearDb();
