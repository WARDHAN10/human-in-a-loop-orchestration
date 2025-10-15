'use client'

import { useState, useEffect } from 'react'

import { Workflow } from '../types'
import WorkflowList from './component/workList'
import CreateWorkflowForm from './component/createWorkflow'
import WorkflowDefinitions from './component/workflowDefination'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'create' | 'definitions'>('workflows')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows')
      const data = await response.json()
      setWorkflows(data.workflows || [])
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWorkflowCreated = (newWorkflow: Workflow) => {
    setWorkflows(prev => [newWorkflow, ...prev])
    setActiveTab('workflows')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workflow Orchestrator</h1>
          <p className="text-gray-600 mt-2">Manage and monitor your human-in-the-loop workflows</p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'workflows', name: 'Workflows', count: workflows.length },
                { id: 'create', name: 'Create Workflow' },
                { id: 'definitions', name: 'Definitions' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                  {tab.count !== undefined && (
                    <span className="ml-2 py-0.5 px-2 text-xs bg-gray-200 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'workflows' && (
            <WorkflowList
              workflows={workflows} 
              loading={loading}
              onRefresh={fetchWorkflows}
            />
          )}
          
          {activeTab === 'create' && (
            <CreateWorkflowForm onWorkflowCreated={handleWorkflowCreated} />
          )}
          
          {activeTab === 'definitions' && (
            <WorkflowDefinitions />
          )}
        </div>
      </div>
    </div>
  )
}