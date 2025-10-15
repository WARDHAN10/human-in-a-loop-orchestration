import { StepState, StepKind } from "@prisma/client";
import { prisma } from "./prisma";
import { WorkflowEngine } from "./workflow-engine";
const engine = new WorkflowEngine()

export class StepManager {
  // Unified function that handles both execute and replay automatically
  async executeOrReplayStep(workflowId: string, stepId: string, reason?: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { idx: 'asc' },
          include: {
            Approval: true
          }
        }
      }
    });

    if (!workflow) throw new Error('Workflow not found');

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error('Step not found');

    const currentStepIndex = workflow.currentStepIndex || 0;

    // If step is in the past (already executed) - do REPLAY
    if (step.idx < currentStepIndex) {
      console.log(`Replaying past step ${step.idx + 1}`);
      return await this.replayStep(workflowId, stepId, reason);
    }

    // If step is current or future - do EXECUTE
    console.log(`Executing current/future step ${step.idx + 1}`);
    return await this.executeStep(workflowId, stepId, reason);
  }

  // Replay a step (for already executed steps)
  async replayStep(workflowId: string, stepId: string, reason?: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { idx: 'asc' },
          include: {
            Approval: true
          }
        }
      }
    });

    if (!workflow) throw new Error('Workflow not found');

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error('Step not found');

    if (!step.canReplay) {
      throw new Error('This step cannot be replayed');
    }

    const currentStepIndex = workflow.currentStepIndex || 0;

    // Reset the target step and set subsequent steps to PENDING
    await prisma.$transaction(async (tx) => {
      // 1. Reset the replayed step based on its type
      if (step.kind === StepKind.HUMAN && step.Approval.length > 0) {
        // Keep the step but reset its state and create new approvals if needed
        await tx.steps.update({
          where: { id: stepId },
          data: {
            state: StepState.READY,
            failedAt: null,
            replayCount: { increment: 1 }
          }
        });

        // Expire old approvals
        await tx.approval.updateMany({
          where: { stepId, status: 'pending' },
          data: {
            status: 'expired',
            expiresAt: new Date()
          }
        });
      } else {
        // For auto steps or human steps without approvals
        await tx.steps.update({
          where: { id: stepId },
          data: {
            state: StepState.READY,
            failedAt: null,
            replayCount: { increment: 1 }
          }
        });
      }

      // 2. Set all subsequent steps to PENDING state
      if (step.idx < workflow.steps.length - 1) {
        await tx.steps.updateMany({
          where: {
            workflowId,
            idx: {
              gt: step.idx
            }
          },
          data: {
            state: StepState.PENDING,
            failedAt: null,
            executedAt: null,
          }
        });

        // For human steps with approvals in subsequent steps, also expire their pending approvals
        const subsequentSteps = workflow.steps.filter(s => s.idx > step.idx);
        const subsequentStepIds = subsequentSteps.map(s => s.id);

        await tx.approval.updateMany({
          where: {
            stepId: { in: subsequentStepIds },
            status: 'pending'
          },
          data: {
            status: 'expired',
            expiresAt: new Date()
          }
        });
      }

      // 3. Update workflow to restart from this step
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          state: 'RUNNING',
          currentStepIndex: step.idx
        }
      });

      // 4. Create replay record
      await tx.stepReplay.create({
        data: {
          stepId,
          reason: reason || 'Manual replay',
          replayedBy: 'user'
        }
      });

      // 5. Create replay event
      await tx.event.create({
        data: {
          workflowId,
          type: 'STEP_REPLAY_INITIATED',
          payload: {
            stepId,
            stepIndex: step.idx,
            reason,
            replayedBy: 'user'
          }
        }
      });
    });

    // Execute the step
    await this.executeSingleStep(workflow, step);

    return {
      success: true,
      message: `Step ${step.idx + 1} replayed successfully. Subsequent steps set to pending.`
    };
  }

  // Execute a specific step
  async executeStep(workflowId: string, stepId: string, reason?: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { idx: 'asc' },
          include: {
            Approval: true
          }
        }
      }
    });

    if (!workflow) throw new Error('Workflow not found');

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error('Step not found');

    if (!step.canExecute) {
      throw new Error('Step execution is disabled');
    }

    // Validation: For human steps, check if already has pending approvals
    if (step.kind === StepKind.HUMAN) {
      console.log(" step.Approval", step.Approval)
      const hasCompleted = step.Approval.some(a => a.status === 'approved');
      if (!hasCompleted) {
        throw new Error('Step has pending approvals - use force=true to override');
      }
    }

    // Update step state
    await prisma.steps.update({
      where: { id: stepId },
      data: {
        state: StepState.READY,
        executedAt: new Date(),
        failedAt: null
      }
    });

    // Create execution event
    await prisma.event.create({
      data: {
        workflowId,
        type: 'STEP_MANUAL_EXECUTION',
        payload: {
          stepId,
          stepIndex: step.idx,
          forced: false,
          reason,
          executedBy: 'user'
        }
      }
    });

    // Execute the step
    await this.executeSingleStep(workflow, step);

    return {
      success: true,
      message: `Step ${step.idx + 1} executed successfully`
    };
  }


  private async executeSingleStep(workflow: any, step: any) {
    try {
      console.log(`Executing step ${step.idx + 1}: ${step.kind}`);

      // Update step state to in-progress
      await prisma.steps.update({
        where: { id: step.id },
        data: {
          state: step.kind === StepKind.HUMAN ? StepState.WAITING : StepState.DONE,
        }
      });


      engine.executeStep(workflow, step)
      if(step.kind == StepKind.HUMAN) return
      // Move to next step if available
      await this.moveToNextStep(workflow, step);


    } catch (error: any) {
      console.error(`Error executing step ${step.idx + 1}:`, error);

      // Mark step as failed
      await prisma.steps.update({
        where: { id: step.id },
        data: {
          state: StepState.FAILED,
          failedAt: new Date()
        }
      });

      // Create failure event
      await prisma.event.create({
        data: {
          workflowId: workflow.id,
          type: 'STEP_FAILED',
          payload: {
            stepIndex: step.idx,
            error: error.message
          }
        }
      });

      throw error;
    }
  }

  private async moveToNextStep(workflow: any, currentStep: any) {
    const nextStepIndex = currentStep.idx + 1;

    if (nextStepIndex < workflow.steps.length) {

      // Execute next step automatically
      const nextStep = workflow.steps.find((s: any) => s.idx === nextStepIndex);
      if (nextStep) {
        await this.executeSingleStep(workflow, nextStep);
      }
    } else {
      // Workflow completed
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          state: 'DONE'
        }
      });

      await prisma.event.create({
        data: {
          workflowId: workflow.id,
          type: 'WORKFLOW_COMPLETED',
          payload: {
            completedAt: new Date()
          }
        }
      });
    }
  }
}