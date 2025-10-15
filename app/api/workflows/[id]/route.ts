import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { WorkflowEngine } from '@/app/lib/workflow-engine'
const engine = new WorkflowEngine()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { idx: 'asc' }
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 100 // Increased for better visualization
        },
        approvals: {
          include: {
            Steps: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(workflow)
  } catch (error) {
    console.error('Error fetching workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params
    const body = await request.json()
    const { stepId, reason } = body

    if (!stepId) {
      return NextResponse.json(
        { error: 'Step ID is required' },
        { status: 400 }
      )
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { idx: 'asc' } } }
    })

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const stepToReplay = workflow.steps.find(step => step.id === stepId)
    if (!stepToReplay) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      )
    }

    // Check if step can be replayed
    if (!stepToReplay.canReplay) {
      return NextResponse.json(
        { error: 'This step cannot be replayed' },
        { status: 400 }
      )
    }

    // Update step state and replay count
    await prisma.steps.update({
      where: { id: stepId },
      data: {
        state: 'READY',
        failedAt: null,
        replayCount: { increment: 1 }
      }
    })

    // Update workflow to restart from this step
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        state: 'RUNNING',
        currentStepIndex: stepToReplay.idx
      }
    })

    // Create replay history record
    await prisma.stepReplay.create({
      data: {
        stepId,
        reason: reason || 'Manual replay',
        replayedBy: 'user' // In real app, get from auth context
      }
    })

    // Create event for the replay
    await prisma.event.create({
      data: {
        workflowId,
        type: 'STEP_REPLAY_INITIATED',
        payload: {
          stepId,
          stepIndex: stepToReplay.idx,
          reason,
          replayedBy: 'user'
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Step ${stepToReplay.idx + 1} replayed successfully`,
      step: stepToReplay
    })

  } catch (error) {
    console.error('Error replaying step:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle workflow restart
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: true }
    })

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Reset all steps
    await prisma.steps.updateMany({
      where: { workflowId },
      data: {
        state: 'READY',
        failedAt: null
      }
    })

    // Reset workflow state
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        state: 'RUNNING',
        currentStepIndex: 0
      }
    })

    // Create restart event
    await prisma.event.create({
      data: {
        workflowId,
        type: 'WORKFLOW_RESTARTED',
        payload: {
          restartedBy: 'user', // In real app, get from auth context
          previousState: workflow.state,
          previousStepIndex: workflow.currentStepIndex
        }
      }
    })

    engine.executeWorkflow(workflowId)
    return NextResponse.json({
      success: true,
      message: 'Workflow restarted successfully'
    })

  } catch (error) {
    console.error('Error restarting workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle workflow deletion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    })

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Delete workflow (this will cascade delete steps, events, approvals due to relations)
    await prisma.workflow.delete({
      where: { id: workflowId }
    })

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle PATCH for partial updates
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params
    const body = await request.json()

    // Validate allowed fields to update
    const allowedFields = ['state', 'metadata', 'currentStepIndex']
    const updates = Object.keys(body).reduce((acc, key) => {
      if (allowedFields.includes(key)) {
        acc[key] = body[key]
      }
      return acc
    }, {} as any)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: updates
    })

    // Create update event
    await prisma.event.create({
      data: {
        workflowId,
        type: 'WORKFLOW_UPDATED',
        payload: {
          updates,
          updatedBy: 'user' // In real app, get from auth context
        }
      }
    })

    return NextResponse.json({
      success: true,
      workflow,
      message: 'Workflow updated successfully'
    })

  } catch (error) {
    console.error('Error updating workflow:', error)
    
    // Handle Prisma not found error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}