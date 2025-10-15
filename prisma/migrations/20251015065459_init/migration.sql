-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('HUMAN', 'AUTO');

-- CreateEnum
CREATE TYPE "StepState" AS ENUM ('READY', 'WAITING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowState" AS ENUM ('PENDING', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'DONE', 'ROLLED_BACK', 'FAILED', 'RUNNING');

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" "WorkflowState" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentStepIndex" INTEGER NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "kind" "StepKind" NOT NULL,
    "state" "StepState" NOT NULL DEFAULT 'READY',
    "config" JSONB,
    "compensating" JSONB,
    "canReplay" BOOLEAN NOT NULL DEFAULT true,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_replays" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "reason" TEXT,
    "replayedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_replays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "steps_workflowId_idx_idx" ON "steps"("workflowId", "idx");

-- CreateIndex
CREATE INDEX "step_replays_stepId_idx" ON "step_replays"("stepId");

-- CreateIndex
CREATE INDEX "step_replays_createdAt_idx" ON "step_replays"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_token_key" ON "approvals"("token");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_name_version_key" ON "workflow_definitions"("name", "version");

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_replays" ADD CONSTRAINT "step_replays_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
