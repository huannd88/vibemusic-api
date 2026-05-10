-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used_by" TEXT[],
    "bonus_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_user_id_key" ON "referrals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");
