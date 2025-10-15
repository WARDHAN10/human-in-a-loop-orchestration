import { WorkflowEngine } from '@/app/lib/workflow-engine'
import { CreateWorkflowRequest } from '@/app/types'
import { NextRequest, NextResponse } from 'next/server'

const engine = new WorkflowEngine()

export async function POST(request: NextRequest) {
  try {
    const body: CreateWorkflowRequest = await request.json()
    const { type, metadata } = body

    console.log(`📥 Creating workflow: ${type}`, metadata)

    // 1. Create the workflow in database
    const workflow = await engine.createWorkflow(type, metadata)
    console.log(`✅ Workflow created: ${workflow.id}`)

    // 2. Execute the workflow (this will automatically send approval requests)
    const result = await engine.executeWorkflow(workflow.id)
    console.log(`🚀 Workflow execution started: ${result.state}`)

    // 3. Check if there are pending approvals and include their info in response
    const workflowWithDetails = await engine.getWorkflowWithDetails(workflow.id)
    
    return NextResponse.json({
      success: true,
      workflow: workflowWithDetails,
      message: getWorkflowMessage(result.state)
    }, { status: 201 })
    
  } catch (error) {
    console.error('❌ Error creating workflow:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

function getWorkflowMessage(state: string): string {
  switch (state) {
    case 'WAITING_APPROVAL':
      return 'Workflow created and waiting for human approval'
    case 'DONE':
      return 'Workflow completed successfully'
    case 'REJECTED':
      return 'Workflow was rejected'
    default:
      return 'Workflow is processing'
  }
}