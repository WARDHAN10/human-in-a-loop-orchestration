-- AlterEnum
ALTER TYPE "StepState" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "steps" ADD COLUMN     "canExecute" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canRollback" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "rollbackCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rolledBackAt" TIMESTAMP(3),
ADD COLUMN     "rolledBackFromId" TEXT;

-- CreateTable
CREATE TABLE "step_rollbacks" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "reason" TEXT,
    "executedBy" TEXT NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_rollbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "step_rollbacks_stepId_idx" ON "step_rollbacks"("stepId");

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_rolledBackFromId_fkey" FOREIGN KEY ("rolledBackFromId") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_rollbacks" ADD CONSTRAINT "step_rollbacks_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
