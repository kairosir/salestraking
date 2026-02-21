import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@salestracker.local";
  const username = "admin";
  const passwordHash = await bcrypt.hash("admin12345", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { username, passwordHash, name: "Admin" },
    create: {
      email,
      username,
      name: "Admin",
      passwordHash
    }
  });

  console.log(`Seeded user: ${user.email} / admin12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
