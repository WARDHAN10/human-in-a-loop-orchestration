"use client";

import { WorkflowDefinition } from "@prisma/client";
import { useState, useEffect } from "react";

interface CreateWorkflowFormProps {
  onWorkflowCreated: (workflow: any) => void;
}

interface MetadataField {
  name: string;
  type: "text" | "number" | "textarea" | "select" | string;
  label: string;
  required?: boolean;
  options?: string[];
}

export default function CreateWorkflowForm({
  onWorkflowCreated,
}: CreateWorkflowFormProps) {
  const [workflowTypes, setWorkflowTypes] = useState<WorkflowDefinition[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWorkflowTypes();
  }, []);

  const fetchWorkflowTypes = async () => {
    try {
      const response = await fetch("/api/workflow-definitions");
      const data = await response.json();
      setWorkflowTypes(data);
      console.log("workflowData", data);
    } catch (error) {
      console.error("Failed to fetch workflow types:", error);
    }
  };

  const selectedWorkflowDefinition = workflowTypes.find(
    (t) => t.name === selectedType
  ) as WorkflowDefinition;

  // Extract all dynamic fields from all steps in the workflow
  const getAllDynamicFields = (): MetadataField[] => {
    if (!selectedWorkflowDefinition) return [];

    const allFields = [] as MetadataField[];

    (selectedWorkflowDefinition.steps as any).forEach((step: any) => {
      if (step.config.fields && Array.isArray(step.config.fields)) {
        allFields.push(...step.config.fields);
      }
    });

    return allFields;
  };

  const dynamicFields = getAllDynamicFields();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workflows/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowDefinitionId: selectedWorkflowDefinition?.id,
          type: selectedType,
          metadata,
          workflowDefinition: selectedWorkflowDefinition,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create workflow");
      }

      onWorkflowCreated(result.workflow);
      setSelectedType("");
      setMetadata({});
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMetadataChange = (fieldName: string, value: any) => {
    setMetadata((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // Get workflow preview steps
  const getWorkflowPreview = () => {
    if (!selectedWorkflowDefinition) return [];

    return (selectedWorkflowDefinition.steps as any).map((step: any) => {
      if (step.kind === "AUTO") {
        return `🤖 ${step.config.title || step.config.action || "Auto Step"}`;
      } else {
        return `👤 ${step.config.title || "Human Approval"} (${step.config.assignee || "Assignee"})`;
      }
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Create New Workflow
          </h2>
          <p className="text-gray-600 mt-1">
            Start a new workflow process with human approvals
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
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

          {/* Workflow Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workflow Type *
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setMetadata({}); // Reset metadata when workflow type changes
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a workflow type</option>
              {workflowTypes.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name.replace(/_/g, " ")} -{" "}
                  {type.description || "No description"}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Metadata Fields */}
          {dynamicFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Workflow Details
              </h3>
              {dynamicFields.map((field, index) => (
                <div key={`${field.name}-${index}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}{" "}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      value={metadata[field.name] || ""}
                      onChange={(e) =>
                        handleMetadataChange(field.name, e.target.value)
                      }
                      required={field.required}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={metadata[field.name] || ""}
                      onChange={(e) =>
                        handleMetadataChange(field.name, e.target.value)
                      }
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={metadata[field.name] || ""}
                      onChange={(e) =>
                        handleMetadataChange(
                          field.name,
                          field.type === "number"
                            ? Number(e.target.value)
                            : e.target.value
                        )
                      }
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading || !selectedType}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Workflow"}
            </button>
          </div>
        </form>
      </div>

      {/* Workflow Preview */}
      {selectedWorkflowDefinition && (
        <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            Workflow Steps Preview:{" "}
            {selectedWorkflowDefinition.name.replace(/_/g, " ")}
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            {getWorkflowPreview().map((step: any, index: any) => (
              <li key={index}>• {step}</li>
            ))}
          </ul>
          {dynamicFields.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-1">
                Required Information:
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {dynamicFields
                  .filter((field) => field.required)
                  .map((field, index) => (
                    <li key={index}>• {field.label}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
