CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "savingsaccountid" INTEGER NOT NULL,
    "cardnumberencrypted" TEXT NOT NULL,
    "cardnumberhash" TEXT NOT NULL,
    "cardlastfour" TEXT NOT NULL,
    "cardholder" TEXT NOT NULL,
    "cardtype" TEXT NOT NULL DEFAULT 'DEBIT',
    "cardbrand" TEXT NOT NULL DEFAULT 'VISA',
    "expirymonth" INTEGER NOT NULL,
    "expiryyear" INTEGER NOT NULL,
    "spendinglimit" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastupdated" TIMESTAMP(3),
    "createdby" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Card_savingsaccountid_key" ON "Card"("savingsaccountid");
CREATE UNIQUE INDEX "Card_cardnumberhash_key" ON "Card"("cardnumberhash");

ALTER TABLE "Card"
ADD CONSTRAINT "Card_savingsaccountid_fkey"
FOREIGN KEY ("savingsaccountid") REFERENCES "savings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
