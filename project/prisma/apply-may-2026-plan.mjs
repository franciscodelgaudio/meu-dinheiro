import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });
config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

const referenceMonth = "2026-05";
const actualRemaining = "117.17";
const plannedIncome = "3750.00";
const adjustmentTitle = "Ajuste de gastos nao declarados ate 18/05";

const groups = [
  ["Aluguel", "1000.00", "#64748b"],
  ["Comida", "600.00", "#16a34a"],
  ["Higiene", "100.00", "#0ea5e9"],
  ["Poupanca", "0.00", "#22c55e"],
  ["Cartao de credito", "350.00", "#2563eb"],
  ["Lazer", "650.00", "#f97316"],
  ["Mensalidade", "45.00", "#7c3aed"],
  ["Dividas", "527.53", "#dc2626"],
  ["DAF", "86.05", "#0891b2"],
  ["Remedio", "92.48", "#db2777"],
  ["Lavanderia", "32.00", "#6366f1"],
  ["Necessidades", "0.00", "#84cc16"],
  ["Roupas", "0.00", "#ec4899"],
  ["Fundo de luxo", "0.00", "#a855f7"],
  ["Cabelo", "0.00", "#14b8a6"],
];

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function main() {
  const email = process.env.AUTH_ADMIN_EMAIL ?? "admin@meudinheiro.local";
  const configuredUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  const fallbackUser = configuredUser
    ? null
    : await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true },
      });
  const user =
    configuredUser ??
    fallbackUser ??
    (await prisma.user.create({
      data: {
        name: "Admin",
        email,
        passwordHash: await bcrypt.hash(
          process.env.AUTH_ADMIN_PASSWORD ?? "admin123",
          12,
        ),
        monthlyIncome: plannedIncome,
      },
      select: { id: true, email: true },
    }));

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        monthlyIncome: plannedIncome,
      },
    });

    await tx.userFinanceProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        monthlyIncome: plannedIncome,
        currency: "BRL",
        notes:
          "Planejamento de maio ajustado em 18/05/2026: renda de R$ 3.750,00 e saldo real de R$ 117,17 para gastar.",
      },
      update: {
        monthlyIncome: plannedIncome,
        currency: "BRL",
        notes:
          "Planejamento de maio ajustado em 18/05/2026: renda de R$ 3.750,00 e saldo real de R$ 117,17 para gastar.",
      },
    });

    await tx.extraIncome.deleteMany({
      where: {
        userId: user.id,
        referenceMonth,
        name: "Disponivel em 18/05",
      },
    });

    await tx.savingsAllocation.upsert({
      where: {
        userId_referenceMonth: {
          userId: user.id,
          referenceMonth,
        },
      },
      create: {
        userId: user.id,
        referenceMonth,
        amount: "0.00",
        description: "Poupanca zerada no planejamento enviado para maio.",
      },
      update: {
        amount: "0.00",
        description: "Poupanca zerada no planejamento enviado para maio.",
      },
    });

    const existingGroups = await tx.expenseGroup.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, referenceMonth: true },
    });

    const groupIdsByName = new Map();

    for (const [name, monthlyAmount, color] of groups) {
      const existing = existingGroups.find(
        (group) => normalizeName(group.name) === normalizeName(name),
      );

      if (existing) {
        groupIdsByName.set(normalizeName(name), existing.id);

        await tx.expenseGroup.update({
          where: { id: existing.id },
          data: {
            referenceMonth:
              existing.referenceMonth < referenceMonth
                ? existing.referenceMonth
                : referenceMonth,
            name,
            monthlyAmount,
            affectsFutureMonths: true,
            color,
            description:
              "Grupo recorrente baseado no planejamento de maio de 2026.",
          },
        });

        await tx.expenseGroupOverride.upsert({
          where: {
            expenseGroupId_referenceMonth: {
              expenseGroupId: existing.id,
              referenceMonth,
            },
          },
          create: {
            userId: user.id,
            expenseGroupId: existing.id,
            referenceMonth,
            name,
            monthlyAmount,
            color,
            description:
              "Valor de maio ajustado a partir do planejamento enviado.",
          },
          update: {
            name,
            monthlyAmount,
            color,
            description:
              "Valor de maio ajustado a partir do planejamento enviado.",
          },
        });
      } else {
        const created = await tx.expenseGroup.create({
          data: {
            userId: user.id,
            referenceMonth,
            name,
            monthlyAmount,
            affectsFutureMonths: true,
            color,
            description:
              "Grupo recorrente baseado no planejamento de maio de 2026.",
          },
          select: { id: true },
        });

        groupIdsByName.set(normalizeName(name), created.id);
      }
    }

    await tx.expense.deleteMany({
      where: {
        userId: user.id,
        spentAt: {
          gte: new Date(`${referenceMonth}-01T00:00:00.000Z`),
          lt: new Date("2026-06-01T00:00:00.000Z"),
        },
        title: {
          startsWith: adjustmentTitle,
        },
      },
    });

    let remainingAdjustmentCents =
      groups.reduce(
        (total, [, amount]) => total + Math.round(Number(amount) * 100),
        0,
      ) - Math.round(Number(actualRemaining) * 100);
    const adjustmentExpenses = [];

    for (const [name, monthlyAmount] of groups) {
      if (remainingAdjustmentCents <= 0) {
        break;
      }

      const monthlyCents = Math.round(Number(monthlyAmount) * 100);
      const amountCents = Math.min(monthlyCents, remainingAdjustmentCents);
      const expenseGroupId = groupIdsByName.get(normalizeName(name));

      if (!expenseGroupId || amountCents <= 0) {
        continue;
      }

      adjustmentExpenses.push({
        userId: user.id,
        expenseGroupId,
        spentAt: new Date("2026-05-18T12:00:00.000Z"),
        title: `${adjustmentTitle} - ${name}`,
        amount: (amountCents / 100).toFixed(2),
        behaviorType: "exceptional",
        coverageDays: 18,
      });
      remainingAdjustmentCents -= amountCents;
    }

    if (adjustmentExpenses.length > 0) {
      await tx.expense.createMany({
        data: adjustmentExpenses,
      });
    }
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  const expenseTotal = groups.reduce(
    (total, [, amount]) => total + Number(amount),
    0,
  );
  const registeredExpenses = await prisma.expense.aggregate({
    where: {
      userId: user.id,
      spentAt: {
        gte: new Date(`${referenceMonth}-01T00:00:00.000Z`),
        lt: new Date("2026-06-01T00:00:00.000Z"),
      },
    },
    _sum: { amount: true },
  });
  const registeredTotal = Number(registeredExpenses._sum.amount ?? 0);
  const realRemaining = expenseTotal - registeredTotal;

  console.log(`Planejamento de ${referenceMonth} aplicado para ${user.email}.`);
  console.log(`Renda planejada: R$ ${plannedIncome.replace(".", ",")}`);
  console.log(`Total dos grupos: R$ ${expenseTotal.toFixed(2).replace(".", ",")}`);
  console.log(
    `Gasto registrado em maio: R$ ${registeredTotal
      .toFixed(2)
      .replace(".", ",")}`,
  );
  console.log(`Restante real para gastar: R$ ${actualRemaining.replace(".", ",")}`);
  console.log(
    `Restante calculado pelo controle de gastos: R$ ${realRemaining
      .toFixed(2)
      .replace(".", ",")}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
