import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  username: string;
  name: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      username: params.username,
      name: params.name,
      passwordHash
    },
    create: {
      email: params.email,
      username: params.username,
      name: params.name,
      passwordHash
    }
  });

  return user;
}

async function main() {
  const admin = await upsertUser({
    email: "admin@salestracker.local",
    username: "admin",
    name: "Admin",
    password: "admin12345"
  });

  const test = await upsertUser({
    email: "test@salestracker.local",
    username: "test",
    name: "Test User",
    password: "test1234"
  });

  console.log(`Seeded user: ${admin.username} / admin12345`);
  console.log(`Seeded user: ${test.username} / test1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
