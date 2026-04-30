import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const ACCESS_TOKEN =
  "EAAeiSgg0ruABReYnvcBoueRRP89QyUJMjOZAPtQfHFFSa5FbCl81g3kauf8CXPJytV0oAq5LxTf9H4Vp4YpTkMpoQZBQZAHXELSZBN93JlVWrZA4Koj2MIXS9NTmQt6MpCAhxjyuslIOYxH0YPChidYuGVPYNwCE23CvxrHu2oXwASKeDscJ4m9yTYrptZBm5ZCeY5ZCi6ujkLZBVd9RyHiA6vBruFMLSFFPxsRyTC7fzYU2PrHgQSsaxZBaZC9gLKZCYw6FUmZBWejmEZBVSMkr2ZBIDwW";
const WABA_ID = "1446327893644967";
const PHONE_NUMBER_ID = "1018091321395233";

async function main() {
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
