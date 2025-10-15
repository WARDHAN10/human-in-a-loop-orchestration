// app/components/workflowCard.tsx
'use client'

import { Workflow } from '@/app/types'
import { useRouter } from 'next/navigation'

interface WorkflowCardProps {
  workflow: Workflow
}
type WorkflowState = "DONE" | "FAILED" | "RUNNING" | "WAITING_APPROVAL" | "PENDING";


export default function WorkflowCard({ workflow }: WorkflowCardProps) {
  const router = useRouter()

  const handleClick = () => {
    // Navigate to workflow detail page
    router.push(`/workflows/${workflow.id}`)
  }

  const getStatusColor = (state: WorkflowState) => {
    const colors = {
      'DONE': 'bg-green-100 text-green-800',
      'FAILED': 'bg-red-100 text-red-800',
      'RUNNING': 'bg-blue-100 text-blue-800',
      'WAITING_APPROVAL': 'bg-yellow-100 text-yellow-800',
      'PENDING': 'bg-gray-100 text-gray-800'
    }
    return colors[state] || colors.PENDING
  }

  const getProgressPercentage = () => {
    if (!workflow.currentStepIndex || !workflow.steps?.length) return 0
    return Math.round(((workflow.currentStepIndex) / workflow.steps.length) * 100)
  }

  return (
    <div 
      onClick={handleClick}
      className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-2">
            {workflow.type?.replace(/_/g, ' ') || 'Untitled Workflow'}
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(workflow.state as WorkflowState)}`}>
            {workflow.state?.replace(/_/g, ' ') || 'PENDING'}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">ID</div>
          <div className="text-xs font-mono text-gray-600">
            {workflow.id.slice(0, 8)}...
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{getProgressPercentage()}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Step Info */}
      <div className="flex justify-between text-sm text-gray-600">
        <div>
          <span className="font-medium">Steps:</span> {workflow.steps?.length || 0}
        </div>
        <div>
          <span className="font-medium">Current:</span> {workflow.currentStepIndex + 1}
        </div>
      </div>

      {/* Created Date */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Created: {new Date(workflow.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Click Hint */}
      <div className="mt-3 text-xs text-blue-600 flex items-center gap-1">
        <span>Click to view details →</span>
      </div>
    </div>
  )
}