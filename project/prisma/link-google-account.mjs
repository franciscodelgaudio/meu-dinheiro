import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

const GOOGLE_EMAIL = "delgaudiofrancisco.junior@gmail.com";

async function main() {
  // Verifica se ja existe um usuario com o email do Google
  const googleUser = await prisma.user.findUnique({
    where: { email: GOOGLE_EMAIL },
    select: { id: true, email: true, name: true },
  });

  if (googleUser) {
    console.log(`Ja existe um usuario com o email ${GOOGLE_EMAIL}: ${googleUser.id}`);
    console.log("Nenhuma alteracao necessaria — faca login com Google normalmente.");
    return;
  }

  // Busca o usuario existente (o que tem todos os dados)
  const existingUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });

  if (!existingUser) {
    console.log("Nenhum usuario encontrado no banco.");
    return;
  }

  console.log(`Usuario encontrado: ${existingUser.email} (id: ${existingUser.id})`);
  console.log(`Atualizando email para: ${GOOGLE_EMAIL}`);

  await prisma.user.update({
    where: { id: existingUser.id },
    data: { email: GOOGLE_EMAIL },
  });

  console.log("Email atualizado com sucesso!");
  console.log("Agora faca login com sua conta Google e todos os seus dados estarao vinculados.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
