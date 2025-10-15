import { NextRequest, NextResponse } from 'next/server'
import { WorkflowEngine } from '@/app/lib/workflow-engine'
import { prisma } from '@/app/lib/prisma'

const engine = new WorkflowEngine()

export async function GET({ params }: { params: Promise<{ skip: number, take: number }> }) {

  try {
    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        skip: 0,
        take: 50,
        include: {
          steps: { orderBy: { idx: 'asc' } },
          approvals: true,
          _count: {
            select: { events: true, steps: true, approvals: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.workflow.count()
    ])
    console.log("workflow",workflows)
    return NextResponse.json({ workflows, total, skip: 0, take: 50 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}