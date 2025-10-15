import { PrismaClient, StepKind, StepState, WorkflowState } from '@prisma/client'
import { Step, WorkflowMetadata } from '../types'
import { approvalQueue } from './queue'
import { prisma } from './prisma'
import { NotificationService } from './notification-service'

const notificationService = new NotificationService()
export class WorkflowEngine {

  // Check if workflow definition exists
  async checkWorkflowDefinitionExists(type: string): Promise<boolean> {
    const definition = await prisma.workflowDefinition.findFirst({
      where: {
        name: type,
        isActive: true
      }
    })
    return !!definition
  }

  // Get available workflow types
  async getAvailableWorkflowTypes(): Promise<string[]> {
    const definitions = await prisma.workflowDefinition.findMany({
      where: { isActive: true },
      select: { name: true, description: true, version: true },
      orderBy: { name: 'asc' }
    })
    return definitions.map(def => `${def.name} (v${def.version}) - ${def.description}`)
  }

  // Get workflow definition from database
  private async getWorkflowDefinition(type: string) {
    const definition = await prisma.workflowDefinition.findFirst({
      where: {
        name: type,
        isActive: true
      },
      orderBy: { version: 'desc' }
    })

    if (!definition) {
      throw new Error(`Workflow definition '${type}' not found. Available types: ${await this.getAvailableWorkflowTypes()}`)
    }

    console.log(`📚 Using workflow definition: ${definition.name} v${definition.version}`)
    return {
      steps: definition.steps as any[],
      version: definition.version
    }
  }

  // Updated createWorkflow method
  async createWorkflow(type: string, metadata: any = {}) {
    // Get definition from database
    const definition = await this.getWorkflowDefinition(type)

    // Create workflow with steps from definition
    const workflow = await prisma.workflow.create({
      data: {
        type,
        metadata,
        state: WorkflowState.PENDING,
        currentStepIndex: 0,
        steps: {
          create: definition.steps.map((stepDef, index) => ({
            idx: index,
            kind: stepDef.kind,
            state: StepState.READY,
            config: stepDef.config || {},
            compensating: stepDef.compensating || null
          }))
        }
      },
      include: { steps: true }
    })

    await prisma.event.create({
      data: {
        workflowId: workflow.id,
        type: 'WORKFLOW_CREATED',
        payload: {
          definitionType: type,
          definitionVersion: definition.version,
          stepsCount: definition.steps.length
        }
      }
    })

    return workflow
  }

  // Execute workflow from start to current position
  async executeWorkflow(workflowId: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { idx: 'asc' } } }
    })

    if (!workflow) throw new Error('Workflow not found')

    console.log(`▶️ Executing workflow ${workflowId} with ${workflow.steps.length} steps`)

    // Execute steps in order
    for (let step of workflow.steps) {
      if (step.state === StepState.DONE) {
        console.log(`⏭️ Skipping completed step ${step.idx}`)
        continue
      }

      console.log(`🔄 Executing step ${step.idx} (${step.kind})`)
      step = await this.executeStep(workflow, step)
      console.log("workflow state", step)
      // If step is waiting for approval, break execution
      if (step.state === StepState.WAITING) {
        console.log(`⏸️ Workflow paused at step ${step.idx} waiting for approval`)
        break
      }
    }

    return await this.updateWorkflowState(workflowId)
  }

  // Execute a single step
  async executeStep(workflow: any, step: any) {
    console.log("executing...........",step.kind)
    try {
      // Update step to READY state
      await prisma.steps.update({
        where: { id: step.id },
        data: { state: StepState.READY }
      })

      if (step.kind === StepKind.AUTO) {
        // Execute auto step logic
        await this.executeAutoStep(workflow, step)
        step = await prisma.steps.update({
          where: { id: step.id },
          data: { state: StepState.DONE }
        })

        console.log(`✅ Auto step ${step.idx} completed`)

      } else if (step.kind === StepKind.HUMAN) {
        // Create approval request for human step
        await this.createApprovalRequest(workflow, step)
        step = await prisma.steps.update({
          where: { id: step.id },
          data: { state: StepState.WAITING }
        })

        console.log(`👤 Human step ${step.idx} - approval requested`)
      }

      return step

    } catch (error: any) {
      // Handle step execution failure
      console.error(`❌ Step ${step.idx} execution failed:`, error)

      await prisma.steps.update({
        where: { id: step.id },
        data: { state: StepState.FAILED }
      })

      await prisma.event.create({
        data: {
          workflowId: workflow.id,
          type: 'STEP_FAILED',
          workflow:workflow,
          payload: {
            stepId: step.id,
            stepIdx: step.idx,
            error: error.message,
            stack: error.stack
          }
        }
      })

      await this.executeCompensation(workflow, step)

      throw error
    }
  }

  // Execute automatic step logic
  private async executeAutoStep(workflow: any, step: any) {
    const config = step.config as any
    console.log(`🤖 Executing auto step: ${config?.action}`)

    // Simulate different auto actions
    switch (config?.action) {
      case 'validate_data':
        console.log(`📊 Validating data for workflow ${workflow.id}`)
        // Example validation logic
        if (workflow.metadata?.amount > 10000) {
          throw new Error('Amount exceeds maximum limit of $10,000')
        }
        if (!workflow.metadata?.description) {
          throw new Error('Description is required')
        }
        console.log(`✅ Data validation passed for amount: $${workflow.metadata?.amount}`)
        break

      case 'process_payment':
        console.log(`💳 Processing payment of $${workflow.metadata?.amount}`)
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 500))
        console.log(`✅ Payment processed successfully`)
        break

      case 'send_notification':
        console.log(`📢 Sending notification: ${config.message}`)
        // Simulate notification sending
        await new Promise(resolve => setTimeout(resolve, 300))
        console.log(`✅ Notification sent: ${config.message}`)
        break

      case 'spell_check':
        console.log(`🔍 Running spell check on content`)
        // Simulate spell check
        await new Promise(resolve => setTimeout(resolve, 800))
        console.log(`✅ Spell check completed`)
        break

      case 'publish_content':
        console.log(`🚀 Publishing content to platform`)
        // Simulate publishing
        await new Promise(resolve => setTimeout(resolve, 1000))
        console.log(`✅ Content published successfully`)
        break

      default:
        console.log(`⚡ Executing default auto action`)
        // Default action - just wait a bit
        await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Create approval request for human step
  private async createApprovalRequest(workflow: any, step: any) {
    const config = step.config as any
    const token = this.generateApprovalToken()

    const approval = await prisma.approval.create({
      data: {
        workflowId: workflow.id,
        stepId: step.id,
        channel: config?.channel || 'web',
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        status: 'pending'
      }
    })

    console.log(`📨 Created approval request: ${approval.id} for channel: ${approval.channel}`)

    // Send approval request via configured channel
    await notificationService.sendApprovalNotification(approval, workflow, step)

    // Record approval request event
    await prisma.event.create({
      data: {
        workflowId: workflow.id,
        type: 'APPROVAL_REQUESTED',
        payload: {
          approvalId: approval.id,
          channel: approval.channel,
          stepId: step.id,
          token: approval.token
        }
      }
    })

    return approval
  }

  // Generate unique approval token
  private generateApprovalToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  // Send approval request via appropriate channel
  private async sendApprovalRequest(approval: any, workflow: any, step: any) {
    const config = step.config as any

    console.log(`📤 Sending approval request via ${approval.channel}...`)

    switch (approval.channel) {
      case 'slack':
        await this.sendSlackApproval(approval, workflow, step)
        break
      case 'email':
        await this.sendEmailApproval(approval, workflow, step)
        break
      case 'web':
      default:
        // For web channel, just log the URL
        const approvalUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/approve/${approval.token}`
        console.log(`🌐 Web approval required: ${approvalUrl}`)
    }
  }


  async handleApproval(token: string, decision: 'approved' | 'rejected', feedback?: string) {
    console.log(`🎯 Queueing approval decision: ${decision} for token: ${token}`);

    try {
      await approvalQueue.add(
        `approval-${token}`,
        { token, decision, feedback },
        {
          jobId: `approval-${token}`, // Prevent duplicate jobs for same token
          priority: decision === 'approved' ? 1 : 2, // Higher priority for approvals
        }
      );

      console.log(`📨 Approval queued: approval-${token}`);

      return {
        success: true,
        message: `Approval ${decision} received and queued for processing`,
        jobId: `approval-${token}`,
        queued: true
      };

    } catch (error) {
      console.error(`❌ Failed to queue approval ${token}:`, error);
      throw error;
    }
  }

  // Update overall workflow state based on step and approval status
  async updateWorkflowState(workflowId: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: { orderBy: { idx: 'asc' } },
        approvals: true
      }
    })
    if (!workflow) {
      throw 'workflow not found'
    }

    let newState: WorkflowState = WorkflowState.PENDING

    // Check if any approval was rejected
    const hasRejected = workflow.approvals.some(a => a.status === 'rejected')
    if (hasRejected) {
      newState = WorkflowState.REJECTED
    }
    // Check if any step failed
    else if (workflow.steps.some(s => s.state === StepState.FAILED)) {
      newState = WorkflowState.FAILED
    }
    // Check if all steps are done
    else if (workflow.steps.every(s => s.state === StepState.DONE)) {
      newState = WorkflowState.DONE
    }
    // Check if waiting for approval
    else if (workflow.steps.some(s => s.state === StepState.WAITING)) {
      newState = WorkflowState.WAITING_APPROVAL
    }
    // Check if currently executing
    else if (workflow.steps.some(s => s.state === StepState.READY)) {
      newState = WorkflowState.RUNNING
    }

    console.log(`🔄 Updating workflow ${workflowId} state to: ${newState}`)

    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: { state: newState }
    })

    // Record state change event
    if (workflow.state !== newState) {
      await prisma.event.create({
        data: {
          workflowId: workflowId,
          type: 'WORKFLOW_STATE_CHANGED',
          payload: {
            from: workflow.state,
            to: newState
          }
        }
      })
    }

    return updatedWorkflow
  }

  // Execute compensation logic for failed steps
  private async executeCompensation(workflow: any, failedStep: any) {
    if (!failedStep.compensating) {
      console.log(`⚠️ No compensation logic defined for step ${failedStep.idx}`)
      return
    }

    console.log(`🔄 Executing compensation for step ${failedStep.idx}`)

    try {
      // Execute compensation logic
      // This would reverse any side effects of the failed step
      await new Promise(resolve => setTimeout(resolve, 300))

      await prisma.event.create({
        data: {
          workflowId: workflow.id,
          type: 'COMPENSATION_EXECUTED',
          payload: {
            stepId: failedStep.id,
            compensation: failedStep.compensating
          }
        }
      })

      console.log(`✅ Compensation executed for step ${failedStep.idx}`)
    } catch (compError: any) {
      console.error(`❌ Compensation failed for step ${failedStep.idx}:`, compError)

      await prisma.event.create({
        data: {
          workflowId: workflow.id,
          type: 'COMPENSATION_FAILED',
          payload: {
            stepId: failedStep.id,
            error: compError.message
          }
        }
      })
    }
  }

  // Get workflow with details
  async getWorkflowWithDetails(workflowId: string) {
    return await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { idx: 'asc' },
          select: {
            id: true,
            idx: true,
            kind: true,
            state: true,
            config: true,
            createdAt: true,
            updatedAt: true
          }
        },
        approvals: {
          select: {
            id: true,
            channel: true,
            status: true,
            token: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true
          }
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            type: true,
            payload: true,
            createdAt: true
          }
        }
      }
    })
  }

  // Get workflow by ID
  async getWorkflow(workflowId: string) {
    return await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: { orderBy: { idx: 'asc' } },
        approvals: true,
        events: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    })
  }


  // Cancel a workflow
  async cancelWorkflow(workflowId: string, reason?: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) throw new Error('Workflow not found')

    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: { state: WorkflowState.REJECTED }
    })

    await prisma.event.create({
      data: {
        workflowId: workflowId,
        type: 'WORKFLOW_CANCELLED',
        payload: { reason }
      }
    })

    console.log(`🛑 Workflow ${workflowId} cancelled: ${reason}`)
    return updatedWorkflow
  }

  // Retry failed step
  async retryStep(stepId: string) {
    const step = await prisma.steps.findUnique({
      where: { id: stepId },
      include: { workflow: true }
    })

    if (!step) throw new Error('Step not found')
    if (step.state !== StepState.FAILED) {
      throw new Error('Can only retry failed steps')
    }

    console.log(`🔄 Retrying step ${step.idx} in workflow ${step.workflowId}`)

    // Reset step to READY state
    await prisma.steps.update({
      where: { id: stepId },
      data: { state: StepState.READY }
    })

    await prisma.event.create({
      data: {
        workflowId: step.workflowId,
        type: 'STEP_RETRY',
        payload: { stepId: step.id, stepIdx: step.idx }
      }
    })

    // Continue workflow execution from this step
    return await this.executeWorkflow(step.workflowId)
  }

  // Method to create new workflow definitions
  async createWorkflowDefinition(
    name: string,
    steps: any[],
    description?: string
  ) {
    // Validate steps structure
    this.validateWorkflowSteps(steps)

    // Check if definition already exists
    const existing = await prisma.workflowDefinition.findFirst({
      where: { name },
      orderBy: { version: 'desc' }
    })

    const newVersion = existing ? existing.version + 1 : 1

    const definition = await prisma.workflowDefinition.create({
      data: {
        name,
        version: newVersion,
        description,
        steps,
        isActive: true
      }
    })

    console.log(`✅ Created workflow definition: ${name} v${newVersion}`)
    return definition
  }

  // Validate workflow steps structure
  public validateWorkflowSteps(steps: any[]) {
    if (!Array.isArray(steps)) {
      throw new Error('Workflow steps must be an array')
    }

    if (steps.length === 0) {
      throw new Error('Workflow must have at least one step')
    }

    steps.forEach((step, index) => {
      if (!step.kind) {
        throw new Error(`Step ${index} must have a 'kind' property (AUTO or HUMAN)`)
      }
      if (!Object.values(StepKind).includes(step.kind)) {
        throw new Error(`Step ${index} has invalid kind: ${step.kind}. Must be AUTO or HUMAN`)
      }
      if (step.kind === StepKind.HUMAN && !step.config?.channel) {
        throw new Error(`Step ${index} (HUMAN) must have a channel in config`)
      }
      if (step.idx !== undefined && step.idx !== index) {
        throw new Error(`Step index mismatch: expected ${index}, got ${step.idx}`)
      }
    })
  }

  // Get all workflow definitions
  async getAllWorkflowDefinitions() {
    return await prisma.workflowDefinition.findMany({
      orderBy: [{ name: 'asc' }, { version: 'desc' }]
    })
  }

  // Deactivate a workflow definition
  async deactivateWorkflowDefinition(name: string) {
    const result = await prisma.workflowDefinition.updateMany({
      where: { name, isActive: true },
      data: { isActive: false }
    })

    console.log(`🔴 Deactivated workflow definition: ${name}`)
    return result
  }

  private async sendSlackApproval(approval: any, workflow: any, step: any) {
    const config = step.config as any;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log("❌ Slack webhook URL not configured");
      return;
    }

    const approvalUrl = `${process.env.BASE_URL || "http://localhost:3000"}/approve/${approval.token}`;

    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🔐 Approval Required - ${config?.title || "Workflow Approval"}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Workflow:*\n${workflow.type}`,
            },
            {
              type: "mrkdwn",
              text: `*Requested By:*\nSystem`,
            },
            {
              type: "mrkdwn",
              text: `*Amount:*\n$${workflow.metadata?.amount || "N/A"}`,
            },
            {
              type: "mrkdwn",
              text: `*Employee:*\n${workflow.metadata?.employee || "N/A"}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Description:*\n${workflow.metadata?.description || "No description provided"}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ Approve",
                emoji: true,
              },
              style: "primary",
              url: `${approvalUrl}?decision=approved`,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "❌ Reject",
                emoji: true,
              },
              style: "danger",
              url: `${approvalUrl}?decision=rejected`,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "📋 Review Details",
                emoji: true,
              },
              url: approvalUrl,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⏰ This approval expires on ${approval.expiresAt.toLocaleString()} | <${approvalUrl}|Direct Link>`,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackMessage),
      });

      if (response.ok) {
        console.log(
          `✅ Slack approval sent to channel for workflow ${workflow.id}`
        );

        await prisma.event.create({
          data: {
            workflowId: workflow.id,
            type: "SLACK_MESSAGE_SENT",
            payload: { approvalId: approval.id, channel: "slack" },
          },
        });
      } else {
        console.error(
          "❌ Failed to send Slack message:",
          await response.text()
        );
      }
    } catch (error) {
      console.error("❌ Error sending Slack message:", error);
    }
  }

  async sendEmailApproval(approval: any, workflow: any, step: any) {
    console.log("started sengind")
    const config = step.config as any;
    const approvalUrl = `${process.env.BASE_URL || "http://localhost:3000"}/approve/${approval.token}`;

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

    if (!SENDGRID_API_KEY) {
      console.log("❌ SendGrid API key not configured");
      return;
    }
    console.log(config)

    const emailData = {
      personalizations: [{
        to: [{ email: config?.assignee || "gamerbuddy49@gmail.com" }]
      }],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || "noreply@yourdomain.com",
        name: process.env.SENDGRID_FROM_NAME || "Workflow System"
      },
      subject: `Approval Required: ${config?.title || "Workflow Approval"}`,
      content: [
        {
          type: "text/html",
          value: approvalUrl
        }
      ]
    };

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        console.log(`✅ Email sent successfully`);
        // ... your success logic
      } else {
        const error = await response.text();
        console.error("❌ Failed to send email:", error);
      }
    } catch (error) {
      console.error("❌ Error sending email:", error);
    }
  }

  async checkExpiredApprovals() {
    const expiredApprovals = await prisma.approval.findMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() }
      },
      include: {
        workflow: { include: { steps: true } },
        Steps: true
      }
    })

    console.log(`⏰ Found ${expiredApprovals.length} expired approvals`)

    for (const approval of expiredApprovals) {
      await this.handleExpiredApproval(approval)
    }

    return expiredApprovals.length
  }

  // Handle an expired approval
  private async handleExpiredApproval(approval: any) {
    console.log(`❌ Approval ${approval.id} has expired`)

    // Mark approval as expired
    await prisma.approval.update({
      where: { id: approval.id },
      data: { status: 'expired' }
    })

    // Record expiration event
    await prisma.event.create({
      data: {
        workflowId: approval.workflowId,
        type: 'APPROVAL_EXPIRED',
        payload: {
          approvalId: approval.id,
          stepId: approval.stepId
        }
      }
    })

    // Optionally: Notify someone that approval expired
    await this.sendExpiryNotification(approval)
  }

  // Resend approval request
  async resendApproval(approvalId: string) {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        workflow: { include: { steps: true } },
        Steps: true
      }
    })

    if (!approval) throw new Error('Approval not found')
    if (approval.status !== 'expired') {
      throw new Error('Can only resend expired approvals')
    }

    console.log(`🔄 Resending approval for workflow ${approval.workflowId}`)

    // Generate new token and expiry
    const newToken = this.generateApprovalToken()
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update approval with new token and reset status
    await prisma.approval.update({
      where: { id: approvalId },
      data: {
        token: newToken,
        expiresAt: newExpiry,
        status: 'pending',
        updatedAt: new Date()
      }
    })

    // Resend the approval request
    await this.sendApprovalRequest(
      { ...approval, token: newToken, expiresAt: newExpiry },
      approval.workflow,
      approval.Steps
    )

    await prisma.event.create({
      data: {
        workflowId: approval.workflowId,
        type: 'APPROVAL_RESENT',
        payload: {
          approvalId: approval.id,
          oldToken: approval.token,
          newToken: newToken
        }
      }
    })

    console.log(`✅ Approval resent with new token: ${newToken}`)
    return { newToken, newExpiry }
  }

  // Send expiry notification
  private async sendExpiryNotification(approval: any) {
    console.log(`📧 Sending expiry notification for approval ${approval.id}`)
    // In production, you'd send an email/Slack notification here
    // For demo, we'll just log it
    console.log(`⚠️ Approval for workflow ${approval.workflowId} has expired!`)
  }
  getWorkflowMetadata(workflow: any): WorkflowMetadata {
    return workflow.metadata as WorkflowMetadata
  }
  async replayStep(stepId: string, reason?: string, replayedBy = 'system') {
    const step = await prisma.steps.findUnique({
      where: { id: stepId },
      include: { workflow: true }
    });

    if (!step) {
      throw new Error('Step not found');
    }

    if (!step.canReplay) {
      throw new Error('This step cannot be replayed');
    }

    // 1. Record replay in history
    await prisma.stepReplay.create({
      data: {
        stepId,
        reason,
        replayedBy
      }
    });

    // 2. Reset step state
    await prisma.steps.update({
      where: { id: stepId },
      data: {
        state: 'READY',
        failedAt: null,
        replayCount: { increment: 1 }
      }
    });

    // 3. Update workflow to point to this step
    await prisma.workflow.update({
      where: { id: step.workflowId },
      data: {
        state: 'RUNNING',
        currentStepIndex: step.idx
      }
    });

    // 4. Continue workflow execution from this step
    await this.executeFromStep(step.workflowId, step.idx);

    return { success: true, message: `Step ${step.idx + 1} replayed successfully` };
  }

  private async executeFromStep(workflowId: string, fromIndex: number) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { idx: 'asc' } } }
    });

    // Execute steps starting from the replayed step
    for (let i = fromIndex; i < workflow!.steps.length; i++) {
      const step = workflow!.steps[i];
      await this.executeStep(workflow, step);
    }
  }

}
