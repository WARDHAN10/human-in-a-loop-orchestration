// app/components/WorkflowVisualization.tsx
"use client";

import { useState } from "react";
import { Workflow, Steps, Event, StepKind, StepState } from "@prisma/client";

interface WorkflowWithDetails extends Workflow {
  steps: Steps[];
  events: Event[];
}
type WorkflowState =
  | "completed"
  | "in-progress"
  | "waiting"
  | "pending"
  | "failed";

interface WorkflowVisualizationProps {
  workflow: WorkflowWithDetails;
  onReplayStep: (stepId: string, reason?: string) => Promise<void>;
  onRestartWorkflow: (workflowId: string) => Promise<void>;
  onExecuteStep: (stepId: string, reason?: string) => Promise<void>;
  onRollbackStep: (stepId: string, reason?: string) => Promise<void>;
  onSkipStep: (stepId: string, reason?: string) => Promise<void>;
  onForceCompleteStep: (stepId: string, result?: any, reason?: string) => Promise<void>;
}

export default function WorkflowVisualization({
  workflow,
  onReplayStep,
  onRestartWorkflow,
  onExecuteStep,
  onRollbackStep,
  onSkipStep,
  onForceCompleteStep,
}: WorkflowVisualizationProps) {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [replayReason, setReplayReason] = useState("");
  const [isReplaying, setIsReplaying] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  
  // State for step management actions
  const [actionState, setActionState] = useState<{
    type: 'execute' | 'rollback' | 'skip' | 'force-complete' | 'replay' | null;
    stepId: string | null;
    reason: string;
    result: string;
  }>({
    type: null,
    stepId: null,
    reason: '',
    result: ''
  });

  // Get events for a specific step by matching step index from event payload
  const getStepEvents = (stepIndex: number) => {
    return workflow.events.filter((event) => {
      try {
        const payload = event.payload as any;
        return (
          payload?.stepIndex === stepIndex ||
          payload?.stepId === workflow.steps[stepIndex]?.id
        );
      } catch {
        return false;
      }
    });
  };

  const getStepStatus = (step: Steps, index: number) => {
    const currentStepIndex = workflow.currentStepIndex || 0;
    if (step.failedAt) return "failed";
    if (step.state == StepState.DONE) return "completed";
    if (step.kind == StepKind.AUTO) {
      return index <= currentStepIndex ? "completed" : "pending";
    }
    if (index === currentStepIndex) {
      if (workflow.state === "WAITING_APPROVAL") return "waiting";
      if (step.failedAt) return "failed";
      return "in-progress";
    }
    return step.kind == StepKind.HUMAN ? "waiting" : "pending";
  };

  const getStatusColor = (status: WorkflowState) => {
    const colors = {
      completed: "bg-green-100 text-green-800 border-green-300",
      "in-progress": "bg-blue-100 text-blue-800 border-blue-300 animate-pulse",
      waiting: "bg-yellow-100 text-yellow-800 border-yellow-300",
      pending: "bg-gray-100 text-gray-600 border-gray-300",
      failed: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[status] || colors.pending;
  };

  const getStepIcon = (step: Steps, status: WorkflowState) => {
    const icons = {
      AUTO: "🤖",
      HUMAN: "👤",
    };

    const statusIcons = {
      completed: "✅",
      "in-progress": "🔄",
      waiting: "⏳",
      pending: "⚪",
      failed: "❌",
    };

    return `${icons[step.kind]} ${statusIcons[status]}`;
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await onRestartWorkflow(workflow.id);
    } catch (error) {
      console.error("Failed to restart workflow:", error);
    } finally {
      setIsRestarting(false);
    }
  };

  // Parse step config safely
  const getStepConfig = (step: Steps) => {
    try {
      return typeof step.config === "string"
        ? JSON.parse(step.config)
        : step.config || {};
    } catch {
      return {};
    }
  };

  // Step management actions
  const handleStepAction = (action: 'execute' | 'rollback' | 'skip' | 'force-complete' | 'replay', step: Steps) => {
    setActionState({ 
      type: action, 
      stepId: step.id, 
      reason: '', 
      result: '' 
    });
  };

 // In WorkflowVisualization.tsx - simplified confirmAction
const confirmAction = async () => {
  const { type, stepId, reason, result } = actionState;
  
  if (!type || !stepId) return;

  try {
    switch (type) {
      case 'execute': // This now handles both execute AND replay
        await onExecuteStep(stepId, reason);
        break;
      case 'skip':
        await onSkipStep(stepId, reason);
        break;
      case 'force-complete':
        await onForceCompleteStep(stepId, result, reason);
        break;
    }
    setActionState({ type: null, stepId: null, reason: '', result: '' });
  } catch (error: any) {
    console.error(`Failed to ${type} step:`, error);
  }
};

// In WorkflowVisualization.tsx - simplified getStepActions
const getStepActions = (step: Steps, index: number) => {
  const currentStepIndex = workflow.currentStepIndex || 0;
  const status = getStepStatus(step, index);
  const actions:any = [];

  // Single "Execute/Replay" button that works for both cases
  if ((step as any).canExecute !== false && status === 'completed') {
    const label = "🔁 Replay From Here"
    const description = index < currentStepIndex ? 
      `Replay from step ${index + 1}. All subsequent steps will be reset.` : 
      `Execute step ${index + 1} now.`;
    
    actions.push({
      label,
      action: 'execute' as const, // Now we only use 'execute' action for both
      color: 'bg-green-100 text-green-700 hover:bg-green-200',
      description
    });
  }

  return actions;
};

  const getActionTitle = (type: string, step: Steps, index: number) => {
    const titles = {
      execute: `Execute Step ${index + 1}`,
      rollback: `Rollback to Step ${index + 1}`,
      skip: `Skip Step ${index + 1}`,
      'force-complete': `Force Complete Step ${index + 1}`,
      replay: step.kind === StepKind.HUMAN ? `Restart Approval for Step ${index + 1}` : `Replay Step ${index + 1}`
    };
    return titles[type as keyof typeof titles] || type;
  };

  const getActionDescription = (type: string, step: Steps, index: number) => {
    const descriptions = {
      execute: `Execute step ${index + 1} now. Workflow will continue from here.`,
      rollback: `Rollback workflow to step ${index + 1}. All subsequent steps will be reset and workflow will resume execution from this point.`,
      skip: `Skip step ${index + 1}. Mark as completed and move to next step.`,
      'force-complete': `Force complete step ${index + 1}. Provide result data below.`,
      replay: step.kind === StepKind.HUMAN ? 
        `Restart approval process for step ${index + 1}. New approval requests will be sent.` :
        `Re-execute step ${index + 1}. Workflow will continue from here.`
    };
    return descriptions[type as keyof typeof descriptions] || '';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {workflow.type.replace(/_/g, " ")}
              </h1>
              <p className="text-gray-600 mt-2">Workflow ID: {workflow.id}</p>
              <div className="flex items-center gap-4 mt-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    workflow.state === "DONE"
                      ? "bg-green-100 text-green-800"
                      : workflow.state === "FAILED"
                        ? "bg-red-100 text-red-800"
                        : workflow.state === "RUNNING"
                          ? "bg-blue-100 text-blue-800"
                          : workflow.state === "WAITING_APPROVAL"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {workflow.state.replace(/_/g, " ")}
                </span>
                <span className="text-sm text-gray-500">
                  Current Step: {workflow.currentStepIndex + 1} of{" "}
                  {workflow.steps.length}
                </span>
                <span className="text-sm text-gray-500">
                  Created: {new Date(workflow.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                disabled={isRestarting}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isRestarting
                  ? "🔄 Restarting..."
                  : "🔄 Restart Entire Workflow"}
              </button>
            </div>
          </div>
        </div>

        {/* Workflow Steps Flowchart */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Workflow Progress
          </h2>

          <div className="relative">
            {/* Timeline connector */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 -z-10" />

            {/* Steps */}
            <div className="space-y-8">
              {workflow.steps.map((step, index) => {
                const status = getStepStatus(step, index);
                const stepConfig = getStepConfig(step);
                const stepEvents = getStepEvents(index);
                const actions = getStepActions(step, index);

                return (
                  <div key={step.id} className="flex items-start gap-6">
                    {/* Step indicator */}
                    <div
                      className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-xl border-4 ${
                        status === "completed"
                          ? "border-green-500 bg-green-50"
                          : status === "in-progress"
                            ? "border-blue-500 bg-blue-50"
                            : status === "waiting"
                              ? "border-yellow-500 bg-yellow-50"
                              : status === "failed"
                                ? "border-red-500 bg-red-50"
                                : "border-gray-300 bg-gray-50"
                      }`}
                    >
                      {getStepIcon(step, status)}
                    </div>

                    {/* Step content */}
                    <div
                      className={`flex-1 rounded-lg p-5 border-2 ${
                        status === "completed"
                          ? "border-green-200 bg-green-50"
                          : status === "in-progress"
                            ? "border-blue-200 bg-blue-50"
                            : status === "waiting"
                              ? "border-yellow-200 bg-yellow-50"
                              : status === "failed"
                                ? "border-red-200 bg-red-50"
                                : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Step {index + 1}:{" "}
                              {stepConfig?.title || `${step.kind} Step`}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status)}`}
                            >
                              {status.replace("-", " ").toUpperCase()}
                            </span>
                            {step.replayCount > 0 && (
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                                Replayed {step.replayCount} time
                                {step.replayCount !== 1 ? "s" : ""}
                              </span>
                            )}
                            {(step as any).rollbackCount > 0 && (
                              <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                Rolled back {(step as any).rollbackCount} time
                                {(step as any).rollbackCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-gray-600 space-y-1">
                            <p>
                              <strong>Type:</strong> {step.kind}
                            </p>
                            {stepConfig?.action && (
                              <p>
                                <strong>Action:</strong> {stepConfig.action}
                              </p>
                            )}
                            {stepConfig?.assignee && (
                              <p>
                                <strong>Assignee:</strong> {stepConfig.assignee}
                              </p>
                            )}
                            {stepConfig?.channel && (
                              <p>
                                <strong>Channel:</strong> {stepConfig.channel}
                              </p>
                            )}
                            {step.failedAt && (
                              <p className="text-red-600">
                                <strong>Failed at:</strong>{" "}
                                {new Date(step.failedAt).toLocaleString()}
                              </p>
                            )}
                            {(step as any).executedAt && (
                              <p className="text-green-600">
                                <strong>Executed at:</strong>{" "}
                                {new Date((step as any).executedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap justify-end">
                          {actions.map((action:any) => (
                            <button
                              key={action.action}
                              onClick={() => handleStepAction(action.action, step)}
                              className={`px-3 py-2 rounded text-sm font-medium ${action.color}`}
                              title={action.description}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step events */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Recent Events:
                        </h4>
                        <div className="space-y-1">
                          {stepEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center gap-2 text-xs text-gray-600"
                            >
                              <span className="w-2 h-2 bg-gray-400 rounded-full" />
                              <span>{event.type}</span>
                              <span className="text-gray-400">
                                {new Date(event.createdAt).toLocaleTimeString()}
                              </span>
                              {event.payload &&
                                typeof event.payload === "object" &&
                                (event.payload as any).error && (
                                  <span className="text-red-600">
                                    ({(event.payload as any).error})
                                  </span>
                                )}
                            </div>
                          ))}
                          {stepEvents.length === 0 && (
                            <p className="text-xs text-gray-400">
                              No events yet
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action confirmation modal */}
                      {actionState.stepId === step.id && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                          <h4 className="font-medium text-gray-900 mb-2">
                            {getActionTitle(actionState.type!, step, index)}
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            {getActionDescription(actionState.type!, step, index)}
                          </p>
                          
                          <textarea
                            value={actionState.reason}
                            onChange={(e) => setActionState(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder={`Reason for ${actionState.type}...`}
                            rows={2}
                            className="w-full p-2 border rounded mb-3"
                          />
                          
                          {actionState.type === 'force-complete' && (
                            <textarea
                              value={actionState.result}
                              onChange={(e) => setActionState(prev => ({ ...prev, result: e.target.value }))}
                              placeholder="Result data (optional)..."
                              rows={2}
                              className="w-full p-2 border rounded mb-3"
                            />
                          )}
                          
                          <div className="flex gap-2">
                            <button
                              onClick={confirmAction}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setActionState({ type: null, stepId: null, reason: '', result: '' })}
                              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Workflow Metadata */}
        {workflow.metadata && (
          <div className="mt-6 bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Workflow Data
            </h3>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto">
              {JSON.stringify(workflow.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}