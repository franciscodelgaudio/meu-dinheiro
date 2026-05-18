ALTER TABLE "CreditCardPurchase"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'credit_card',
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'Cartao de credito',
  ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE INDEX IF NOT EXISTS "CreditCardPurchase_userId_kind_firstInstallmentMonth_idx"
  ON "CreditCardPurchase"("userId", "kind", "firstInstallmentMonth");
