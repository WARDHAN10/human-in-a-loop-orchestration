'use client'

import { useState } from 'react'
import { WorkflowStepDefinition, StepConfig, ApprovalField } from '@/app/types'
import { StepKind } from '@prisma/client'

interface StepConfiguratorProps {
  step: WorkflowStepDefinition
  index: number
  onUpdate: (updates: Partial<WorkflowStepDefinition>) => void
  onRemove: () => void
  onMove: (index: number, direction: 'up' | 'down') => void
  isFirst: boolean
  isLast: boolean
}

export default function StepConfigurator({
  step,
  index,
  onUpdate,
  onRemove,
  onMove,
  isFirst,
  isLast
}: StepConfiguratorProps) {
  const [config, setConfig] = useState<StepConfig>(step.config)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Update config and propagate to parent
  const updateConfig = (updates: Partial<StepConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    onUpdate({ config: newConfig })
  }

  // Auto Step Actions
  const autoActions = [
    { value: 'validate_data', label: 'Validate Data' },
    { value: 'process_payment', label: 'Process Payment' },
    { value: 'send_notification', label: 'Send Notification' },
    { value: 'spell_check', label: 'Spell Check' },
    { value: 'publish_content', label: 'Publish Content' },
    { value: 'check_limits', label: 'Check Limits' },
    { value: 'generate_report', label: 'Generate Report' },
  ]

  // Human Step Channels
  const channels = [
    { value: 'web', label: 'Web Dashboard' },
    { value: 'email', label: 'Email' },
    { value: 'slack', label: 'Slack' },
    { value: 'teams', label: 'Microsoft Teams' },
  ]

  // Field Types for Human Steps
  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'select', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'date', label: 'Date' },
  ]

  // Add a new field to human step
  const addField = () => {
    const newField: ApprovalField = {
      name: `field_${Date.now()}`,
      type: 'text',
      label: 'New Field',
      required: false
    }
    updateConfig({
      fields: [...(config.fields || []), newField]
    })
  }

  // Update a field
  const updateField = (fieldIndex: number, updates: Partial<ApprovalField>) => {
    const newFields = [...(config.fields || [])]
    newFields[fieldIndex] = { ...newFields[fieldIndex], ...updates }
    updateConfig({ fields: newFields })
  }

  // Remove a field
  const removeField = (fieldIndex: number) => {
    const newFields = (config.fields || []).filter((_, i) => i !== fieldIndex)
    updateConfig({ fields: newFields })
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      {/* Step Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg">
            {step.kind === StepKind.AUTO ? '🤖' : '👤'}
          </span>
          <div>
            <h4 className="font-medium text-gray-900">
              Step {index + 1}: {step.kind === StepKind.AUTO ? 'Auto' : 'Human'} Step
            </h4>
            <p className="text-sm text-gray-500">
              {step.kind === StepKind.AUTO 
                ? 'Automated processing step'
                : 'Requires human approval'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Move Buttons */}
          <button
            type="button"
            onClick={() => onMove(index, 'up')}
            disabled={isFirst}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 'down')}
            disabled={isLast}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>

          {/* Remove Button */}
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-400 hover:text-red-600"
            title="Remove step"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Step Configuration */}
      <div className="space-y-4">
        {/* Common Configuration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Step Title
          </label>
          <input
            type="text"
            value={config.title || ''}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="e.g., Manager Approval, Data Validation"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Auto Step Specific Configuration */}
        {step.kind === StepKind.AUTO && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action *
            </label>
            <select
              value={config.action || ''}
              onChange={(e) => updateConfig({ action: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an action</option>
              {autoActions.map(action => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>

            {/* Action-specific configuration */}
            {config.action === 'send_notification' && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notification Message
                </label>
                <textarea
                  value={config.message || ''}
                  onChange={(e) => updateConfig({ message: e.target.value })}
                  placeholder="Enter the notification message..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Human Step Specific Configuration */}
        {step.kind === StepKind.HUMAN && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Channel *
              </label>
              <select
                value={config.channel || ''}
                onChange={(e) => updateConfig({ channel: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a channel</option>
                {channels.map(channel => (
                  <option key={channel.value} value={channel.value}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </div>

            {config.channel === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignee Email
                </label>
                <input
                  type="email"
                  value={config.assignee || ''}
                  onChange={(e) => updateConfig({ assignee: e.target.value })}
                  placeholder="approver@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Approval Fields */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Approval Fields
                </label>
                <button
                  type="button"
                  onClick={addField}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                >
                  + Add Field
                </button>
              </div>

              {(config.fields || []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2 border border-dashed border-gray-300 rounded">
                  No fields added. Approvers will see basic approve/reject options.
                </p>
              ) : (
                <div className="space-y-2">
                  {(config.fields || []).map((field, fieldIndex) => (
                    <div key={fieldIndex} className="flex gap-2 items-start p-2 bg-gray-50 rounded">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(fieldIndex, { label: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(fieldIndex, { type: e.target.value as any })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            {fieldTypes.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Name</label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateField(fieldIndex, { name: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="field_name"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={field.required || false}
                              onChange={(e) => updateField(fieldIndex, { required: e.target.checked })}
                              className="mr-1"
                            />
                            Required
                          </label>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(fieldIndex)}
                        className="p-1 text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Configuration Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Configuration
          </button>

          {showAdvanced && (
            <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Configuration (JSON)
              </label>
              <textarea
                value={JSON.stringify(config, null, 2)}
                onChange={(e) => {
                  try {
                    const newConfig = JSON.parse(e.target.value)
                    updateConfig(newConfig)
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder='{"customProperty": "value"}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Advanced: Edit raw step configuration in JSON format
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}