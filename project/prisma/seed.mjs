import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

const email = process.env.AUTH_ADMIN_EMAIL ?? "admin@meudinheiro.local";
const password = process.env.AUTH_ADMIN_PASSWORD ?? "admin123";

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Admin",
      passwordHash,
      monthlyIncome: 0,
    },
    create: {
      name: "Admin",
      email,
      passwordHash,
      monthlyIncome: 0,
    },
  });

  await prisma.userFinanceProfile.upsert({
    where: { userId: user.id },
    update: {
      monthlyIncome: 0,
      currency: "BRL",
    },
    create: {
      userId: user.id,
      monthlyIncome: 0,
      currency: "BRL",
    },
  });

  console.log(`Admin user ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
