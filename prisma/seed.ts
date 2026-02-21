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
  const dasha = await upsertUser({
    email: "dasha@aimuselim.store",
    username: "dasha",
    name: "Dasha",
    password: "d4502136d"
  });

  const aim = await upsertUser({
    email: "aim@aimuselim.store",
    username: "aim",
    name: "Aim",
    password: "muslim"
  });

  console.log(`Seeded user: ${dasha.username} / d4502136d`);
  console.log(`Seeded user: ${aim.username} / muslim`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
