// workers/approval-worker.ts
import { prisma } from '@/app/lib/prisma';
import redis from '@/app/lib/redis';
import { WorkflowEngine } from '@/app/lib/workflow-engine';
import { Worker } from 'bullmq';

const engine = new WorkflowEngine();

export const approvalWorker = new Worker('approval-queue', 
  async (job) => {
    const { token, decision, feedback } = job.data;
    
    console.log(`🔄 Processing approval: ${token} (${decision})`);

    const approval = await prisma.approval.findUnique({
      where: { token },
      include: { 
        workflow: { 
          include: { steps: { orderBy: { idx: 'asc' } } } 
        }, 
        Steps: true 
      }
    });

    if (!approval) throw new Error('Approval not found');
    if (approval.status !== 'pending') {
      console.log(`⏭️ Approval ${token} already processed, skipping`);
      return { skipped: true, reason: 'already_processed' };
    }

    // Update approval status
    await prisma.approval.update({
      where: { id: approval.id },
      data: { 
        status: decision,
        updatedAt: new Date()
      }
    });

    // Update step status to DONE
    await prisma.steps.update({
      where: { id: approval.stepId },
      data: { state: 'DONE' }
    });

    // Record approval event
    await prisma.event.create({
      data: {
        workflowId: approval.workflowId,
        type: decision === 'approved' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
        payload: { 
          approvalId: approval.id, 
          stepId: approval.stepId,
          feedback: feedback,
          decision: decision
        }
      }
    });

    console.log(`✅ Approval ${decision} processed for workflow ${approval.workflowId}`);

    // Continue workflow execution if approved
    if (decision === 'approved') {
      console.log(`🔄 Resuming workflow execution after approval`);
      await engine.executeWorkflow(approval.workflowId);
    } else {
      console.log(`⏹️ Workflow rejected, stopping execution`);
      await engine.updateWorkflowState(approval.workflowId);
    }

    return { success: true, workflowId: approval.workflowId, decision };
  },
  { 
    connection: redis,
    concurrency: 5 // Process 5 jobs concurrently
  }
);

// Worker event handlers
approvalWorker.on('completed', (job) => {
  console.log(`✅ Approval job ${job.id} completed`);
});

approvalWorker.on('failed', (job, err) => {
  console.error(`❌ Approval job ${job?.id} failed:`, err);
});

approvalWorker.on('stalled', (jobId) => {
  console.warn(`⚠️ Approval job ${jobId} stalled`);
});

