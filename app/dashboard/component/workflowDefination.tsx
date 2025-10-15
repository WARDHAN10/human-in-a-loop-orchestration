"use client";

import { useState, useEffect } from "react";
import { WorkflowDefinition, WorkflowStepDefinition } from "@/app/types";
import CreateDefinitionForm from "./createDefinitionForm";
import { StepKind } from "@prisma/client";

export default function WorkflowDefinitions() {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDefinition, setEditingDefinition] =
    useState<WorkflowDefinition | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const fetchDefinitions = async () => {
    try {
      const response = await fetch("/api/workflow-definitions");

      const data = await response.json();
      console.log("data", data);
      if (data) {
        setDefinitions(data);
      }
    } catch (error: any) {
      console.log("error", error);

      setError(error.message);
    } finally {
      console.log("error", error);

      setLoading(false);
    }
  };

  const handleCreateDefinition = (newDefinition: WorkflowDefinition) => {
    console.log("newDefination", newDefinition);
    setDefinitions((prev) => [newDefinition, ...prev]);
    setShowCreateForm(false);
  };

  const handleUpdateDefinition = (updatedDefinition: WorkflowDefinition) => {
    setDefinitions((prev) =>
      prev.map((def) =>
        def.id === updatedDefinition.id ? updatedDefinition : def
      )
    );
    setEditingDefinition(null);
  };

  const handleToggleActive = async (
    definitionId: string,
    isActive: boolean
  ) => {
    try {
      const response = await fetch(
        `/api/workflow-definitions/${definitionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
        }
      );

      const data = await response.json();
      console.log("data", data);
      if (data) {
        setDefinitions((prev) =>
          prev.map((def) =>
            def.id === definitionId ? { ...def, isActive: !isActive } : def
          )
        );
      } else {
        throw new Error(data.error || "Failed to update definition");
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm(`Are you sure you want to delete?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/workflow-definitions/${workflowId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh the list or remove from state
        console.log("Workflow deleted successfully");
        // You might want to refresh the data here
        window.location.reload(); // or update state
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Error deleting workflow:", error);
      alert("Error deleting workflow");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Workflow Definitions
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your workflow templates and step configurations
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Create New Definition
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">❌</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="text-sm text-red-700 mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {showCreateForm ? (
        <CreateDefinitionForm
          onDefinitionCreated={handleCreateDefinition}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : editingDefinition ? (
        <CreateDefinitionForm
          definition={editingDefinition}
          onDefinitionCreated={handleUpdateDefinition}
          onCancel={() => setEditingDefinition(null)}
          isEditing={true}
        />
      ) : (
        <>
          {console.log("defination", definitions)}
          {definitions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
              <div className="text-gray-400 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No workflow definitions yet
              </h3>
              <p className="text-gray-500 mb-4">
                Create your first workflow template to get started.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Definition
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {definitions.map((definition) => (
                <DefinitionCard
                  key={definition.id}
                  definition={definition}
                  onToggleActive={handleToggleActive}
                  onDelete={() => handleDeleteWorkflow(definition.id)}
                  onEdit={() => setEditingDefinition(definition)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Definition Card Component
interface DefinitionCardProps {
  definition: WorkflowDefinition;
  onToggleActive: (definitionId: string, isActive: boolean) => void;
  onDelete: (definitionId: string) => void;
  onEdit: (definition: WorkflowDefinition) => void;
}

function DefinitionCard({
  definition,
  onToggleActive,
  onDelete,
  onEdit,
}: DefinitionCardProps) {
  const [showSteps, setShowSteps] = useState(false);

  const getStepIcon = (kind: StepKind) => {
    return kind === StepKind.AUTO ? "🤖" : "👤";
  };

  const getStepDescription = (step: WorkflowStepDefinition) => {
    if (step.kind === StepKind.AUTO) {
      return `Auto: ${step.config.action || "Process"}`;
    } else {
      return `Human: ${step.config.channel || "web"} approval`;
    }
  };
  console.log("defination", definition);
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {definition.name.replace(/_/g, " ")}
              </h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                v{definition.version}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  definition.isActive
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {definition.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {definition.description && (
              <p className="text-gray-600 text-sm">{definition.description}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span>Steps: {(definition.steps as any).length}</span>
              <span>
                Created: {new Date(definition.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(definition)}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Update
            </button>

            <button
              onClick={() => onToggleActive(definition.id, definition.isActive)}
              className={`px-3 py-1 text-sm rounded ${
                definition.isActive
                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  : "bg-green-100 text-green-800 hover:bg-green-200"
              }`}
            >
              {definition.isActive ? "Deactivate" : "Activate"}
            </button>

            <button
              onClick={() => setShowSteps(!showSteps)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              {showSteps ? "Hide Steps" : "Show Steps"}
            </button>
            <button
              onClick={() => onDelete(definition.id)}
              className={`p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors duration-200`}
              title="Delete"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Steps Details */}
        {showSteps && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Workflow Steps:</h4>
            <div className="space-y-2">
              {(definition.steps as any).map((step: any, index: any) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-lg mt-0.5">
                    {getStepIcon(step.kind)}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          Step {index + 1}: {getStepDescription(step)}
                        </p>
                        {step.config.title && (
                          <p className="text-sm text-gray-600 mt-1">
                            {step.config.title}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          step.kind === StepKind.AUTO
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {step.kind}
                      </span>
                    </div>

                    {/* Step Configuration Details */}
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      {step.kind === StepKind.HUMAN && step.config.channel && (
                        <p>Channel: {step.config.channel}</p>
                      )}
                      {step.config.assignee && (
                        <p>Assignee: {step.config.assignee}</p>
                      )}
                      {step.config.fields && step.config.fields.length > 0 && (
                        <p>
                          Fields: {step.config.fields.length} input field(s)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
