ALTER TABLE "Expense"
ADD COLUMN IF NOT EXISTS "creditCardPurchaseId" TEXT,
ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER,
ADD COLUMN IF NOT EXISTS "installmentCount" INTEGER;

CREATE TABLE IF NOT EXISTS "CreditCardPurchase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expenseGroupId" TEXT NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "firstInstallmentMonth" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "installmentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "installmentCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditCardPurchase_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardPurchase_userId_fkey'
  ) THEN
    ALTER TABLE "CreditCardPurchase"
    ADD CONSTRAINT "CreditCardPurchase_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CreditCardPurchase_expenseGroupId_fkey'
  ) THEN
    ALTER TABLE "CreditCardPurchase"
    ADD CONSTRAINT "CreditCardPurchase_expenseGroupId_fkey"
    FOREIGN KEY ("expenseGroupId") REFERENCES "ExpenseGroup"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Expense_creditCardPurchaseId_fkey'
  ) THEN
    ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_creditCardPurchaseId_fkey"
    FOREIGN KEY ("creditCardPurchaseId") REFERENCES "CreditCardPurchase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_creditCardPurchaseId_idx"
ON "Expense"("creditCardPurchaseId");

CREATE INDEX IF NOT EXISTS "CreditCardPurchase_userId_firstInstallmentMonth_idx"
ON "CreditCardPurchase"("userId", "firstInstallmentMonth");

CREATE INDEX IF NOT EXISTS "CreditCardPurchase_expenseGroupId_idx"
ON "CreditCardPurchase"("expenseGroupId");
