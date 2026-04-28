import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Testing DB write...");
  const account = await prisma.account.create({
    data: {
      displayName: "Test Account",
      phoneNumberId: "test_id_" + Date.now(),
      accessToken: "test_token",
      isActive: true
    }
  });
  console.log("Created account:", account);
  
  await prisma.account.delete({ where: { id: account.id } });
  console.log("Deleted test account. DB write/delete works!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
