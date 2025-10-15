// app/workflows/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import WorkflowVisualization from '@/app/dashboard/component/workflowVisualization'

interface WorkflowWithDetails {
  id: string
  type: string
  state: string
  metadata: any
  currentStepIndex: number
  createdAt: string
  updatedAt: string
  steps: any[]
  events: any[]
}

export default function WorkflowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [workflow, setWorkflow] = useState<WorkflowWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.id) {
      fetchWorkflow()
    }
  }, [params.id])

  const fetchWorkflow = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workflows/${params.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch workflow')
      }
      
      const data = await response.json()
      console.log("fetchWorkflow", data)
      setWorkflow(data)
    } catch (error) {
      console.error('Failed to fetch workflow:', error)
      setError('Workflow not found')
    } finally {
      setLoading(false)
    }
  }

// In WorkflowDetailPage.tsx - replace all individual functions with this one
const handleExecuteOrReplayStep = async (stepId: string, reason?: string) => {
  try {
    const response = await fetch(`/api/workflows/${params.id}/steps/${stepId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to execute/replay step')
    }
    
    // Refresh workflow data
    await fetchWorkflow()
  } catch (error) {
    console.error('Error executing/replaying step:', error)
    throw error
  }
}
  const handleRestartWorkflow = async () => {
    try {
      const response = await fetch(`/api/workflows/${params.id}`, {
        method: 'PUT'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to restart workflow')
      }
      
      // Refresh workflow data
      await fetchWorkflow()
    } catch (error) {
      console.error('Error restarting workflow:', error)
      throw error
    }
  }

  // ADDED: Execute step function
  const handleExecuteStep = async (stepId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/workflows/${params.id}/steps/${stepId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to execute step')
      }
      
      // Refresh workflow data
      await fetchWorkflow()
    } catch (error) {
      console.error('Error executing step:', error)
      throw error
    }
  }

  // ADDED: Force complete step function
  const handleForceCompleteStep = async (stepId: string, result?: any, reason?: string) => {
    try {
      const response = await fetch(`/api/workflows/${params.id}/steps/${stepId}/force-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, reason })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to force complete step')
      }
      
      // Refresh workflow data
      await fetchWorkflow()
    } catch (error) {
      console.error('Error force completing step:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Workflow Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The workflow you are looking for does not exist.'}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <WorkflowVisualization
      workflow={workflow}
      onExecuteStep={handleExecuteOrReplayStep} // Single function for both
      onRestartWorkflow={handleRestartWorkflow}
      // ADDED: Pass all the new functions
      onForceCompleteStep={handleForceCompleteStep}
    />
  )
}