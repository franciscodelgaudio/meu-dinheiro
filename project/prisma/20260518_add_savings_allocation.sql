CREATE TABLE IF NOT EXISTS "SavingsAllocation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referenceMonth" TEXT NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SavingsAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavingsAllocation_userId_referenceMonth_key"
  ON "SavingsAllocation"("userId", "referenceMonth");

CREATE INDEX IF NOT EXISTS "SavingsAllocation_userId_referenceMonth_idx"
  ON "SavingsAllocation"("userId", "referenceMonth");

ALTER TABLE "SavingsAllocation"
  ADD CONSTRAINT "SavingsAllocation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
