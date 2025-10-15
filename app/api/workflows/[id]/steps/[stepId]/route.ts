// app/api/workflows/[id]/steps/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { StepManager } from '@/app/lib/step-manager';

const stepManager = new StepManager()


// POST /api/workflows/[id]/steps/[stepId]/execute
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: workflowId, stepId } = await params

    const result = await stepManager.executeStep(workflowId, stepId)
    return NextResponse.json(result)

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}
