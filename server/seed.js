import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.WABA_ID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function main() {
  if (!ACCESS_TOKEN || !WABA_ID || !PHONE_NUMBER_ID) {
    throw new Error("META_ACCESS_TOKEN, WABA_ID, and PHONE_NUMBER_ID are required to seed an account");
  }

  // Create Account
  const account = await prisma.account.upsert({
    where: { phoneNumberId: PHONE_NUMBER_ID },
    update: {
      displayName: "Real WhatsApp Account",
      accessToken: ACCESS_TOKEN,
      wabaId: WABA_ID,
      isActive: true,
      displayPhoneNumber: "+1 555-633-2297",
    },
    create: {
      displayName: "Real WhatsApp Account",
      phoneNumberId: PHONE_NUMBER_ID,
      accessToken: ACCESS_TOKEN,
      wabaId: WABA_ID,
      isActive: true,
      displayPhoneNumber: "+1 555-633-2297",
    },
  });
  console.log("Account created:", account.id);

  // Create Contact
  const contact = await prisma.contact.upsert({
    where: { phone: "917000446325" },
    update: { name: "Target User" },
    create: { name: "Target User", phone: "917000446325", tags: ["test"] },
  });
  console.log("Contact created:", contact.id);

  await prisma.$disconnect();
}

main().catch(console.error);
