"use client";

import { useState, useEffect } from "react";
import { WorkflowStepDefinition } from "@/app/types";
import { StepKind, WorkflowDefinition } from "@prisma/client";
import StepConfigurator from "./stepConfigurator";

interface CreateDefinitionFormProps {
  definition?: WorkflowDefinition; // existing definition for editing
  onDefinitionCreated: (definition: WorkflowDefinition) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

// Helper function to parse steps from JSON
const parseSteps = (steps: any): WorkflowStepDefinition[] => {
  if (Array.isArray(steps)) {
    return steps as WorkflowStepDefinition[];
  }
  try {
    return typeof steps === 'string' ? JSON.parse(steps) : steps || [];
  } catch {
    return [];
  }
};

export default function CreateDefinitionForm({
  definition,
  onDefinitionCreated,
  onCancel,
  isEditing = false
}: CreateDefinitionFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  
  const [steps, setSteps] = useState<WorkflowStepDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Initialize form with definition data when editing
  useEffect(() => {
    if (definition && isEditing) {
      setFormData({
        name: definition.name || "",
        description: definition.description || "",
      });
      setSteps(parseSteps(definition.steps));
    }
  }, [definition, isEditing]);

  const addStep = (kind: StepKind) => {
    const newStep: WorkflowStepDefinition = {
      idx: steps.length,
      kind,
      config:
        kind === StepKind.AUTO
          ? { action: "validate_data" }
          : { channel: "web", title: "Approval Required" },
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const updateStep = (
    index: number,
    updates: Partial<WorkflowStepDefinition>
  ) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
  };

  const removeStep = (index: number) => {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((step, i) => ({ ...step, idx: i }))
    );
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === steps.length - 1)
    ) {
      return;
    }

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const newSteps = [...steps];
    const [movedStep] = newSteps.splice(index, 1);
    newSteps.splice(newIndex, 0, movedStep);

    // Update indices
    setSteps(newSteps.map((step, i) => ({ ...step, idx: i })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const request = {
        name: formData.name,
        description: formData.description || undefined,
        steps,
      };

      // Determine URL and method based on editing mode
      const url = isEditing && definition 
        ? `/api/workflow-definitions/${definition.id}`
        : "/api/workflow-definitions";
      
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      console.log("result", result);
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} definition`);
      }

      onDefinitionCreated(result);
    } catch (error: any) {
      console.log("error", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    return isEditing ? "Edit Workflow Definition" : "Create Workflow Definition";
  };

  const getDescription = () => {
    return isEditing 
      ? "Update your workflow template and steps"
      : "Define a new workflow template with steps";
  };

  const getSubmitButtonText = () => {
    if (loading) {
      return isEditing ? "Updating..." : "Creating...";
    }
    return isEditing ? "Update Definition" : "Create Definition";
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {getTitle()}
        </h2>
        <p className="text-gray-600 mt-1">
          {getDescription()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Definition Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              placeholder="e.g., expense_approval, content_publication"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use lowercase with underscores (e.g., expense_approval)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={2}
              placeholder="Describe what this workflow does..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Steps Management */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Workflow Steps
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addStep(StepKind.AUTO)}
                className="px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200"
              >
                + Auto Step
              </button>
              <button
                type="button"
                onClick={() => addStep(StepKind.HUMAN)}
                className="px-3 py-2 bg-purple-100 text-purple-700 text-sm rounded-md hover:bg-purple-200"
              >
                + Human Step
              </button>
            </div>
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">No steps added yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Add auto or human steps to build your workflow
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <StepConfigurator
                  key={index}
                  step={step}
                  index={index}
                  onUpdate={(updates) => updateStep(index, updates)}
                  onRemove={() => removeStep(index)}
                  onMove={moveStep}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || steps.length === 0 || !formData.name}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {getSubmitButtonText()}
          </button>
        </div>
      </form>
    </div>
  );
}