import { NextRequest, NextResponse } from 'next/server'
import { WorkflowEngine } from '@/app/lib/workflow-engine'
import { ApprovalDecisionRequest } from '@/app/types'
import { prisma } from '@/app/lib/prisma'

const engine = new WorkflowEngine()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    const approval = await prisma.approval.findUnique({
      where: { token },
      include: { 
        workflow: { 
          include: { 
            steps: { orderBy: { idx: 'asc' } },
            events: { 
              where: { type: { contains: 'APPROVAL' } },
              orderBy: { createdAt: 'desc' },
              take: 5 
            }
          } 
        },
        Steps: true 
      }
    })
    
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    // Check if approval is expired
    const isExpired = approval.expiresAt < new Date()
    const canResend = isExpired && approval.status === 'pending'

    return NextResponse.json({
      approval: {
        id: approval.id,
        token: approval.token,
        status: approval.status,
        channel: approval.channel,
        expiresAt: approval.expiresAt,
        isExpired,
        canResend,
        workflow: {
          id: approval.workflow.id,
          type: approval.workflow.type,
          state: approval.workflow.state,
          metadata: approval.workflow.metadata
        },
        step: {
          id: approval.Steps.id,
          idx: approval.Steps.idx,
          config: approval.Steps.config
        }
      },
      events: approval.workflow.events
    })
  } catch (error) {
    console.error('Error fetching approval:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body: ApprovalDecisionRequest = await request.json()
    const { decision, feedback } = body
    
    const result = await engine.handleApproval(token, decision, feedback)
    return NextResponse.json({
      success: true,
      workflow: result,
      message: `Approval ${decision} successfully`
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's an expiry error
    if (errorMessage.includes('expired')) {
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          code: 'APPROVAL_EXPIRED',
          canResend: true
        },
        { status: 410 }
      )
    }
    
    // Check if already processed
    if (errorMessage.includes('already processed')) {
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          code: 'ALREADY_PROCESSED'
        },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: 400 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    const approval = await prisma.approval.findUnique({
      where: { token }
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    const result = await engine.resendApproval(approval.id)
    
    return NextResponse.json({
      success: true,
      newToken: result.newToken,
      newExpiry: result.newExpiry,
      message: 'Approval resent successfully'
    })
  } catch (error: any) {
    console.error('Error resending approval:', error)
    
    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 400 }
    )
  }
}