import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const accounts = await prisma.account.findMany();
  const contacts = await prisma.contact.findMany();
  const templates = await prisma.template.findMany();
  
  console.log('Accounts:', accounts);
  console.log('Contacts:', contacts);
  console.log('Templates:', templates);
  
  await prisma.$disconnect();
}

main().catch(console.error);
