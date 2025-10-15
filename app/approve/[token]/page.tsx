"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface ApprovalData {
  approval: {
    id: string;
    token: string;
    status: string;
    channel: string;
    expiresAt: string;
    isExpired: boolean;
    canResend: boolean;
    workflow: {
      id: string;
      type: string;
      state: string;
      metadata: any;
    };
    step: {
      id: string;
      idx: number;
      config: any;
    };
  };
  events: any[];
}

export default function ApprovalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;

  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Pre-select decision from URL query parameter
  const preSelectedDecision = searchParams.get("decision") as
    | "approved"
    | "rejected"
    | null;
  const [decision, setDecision] = useState<"approved" | "rejected">(
    preSelectedDecision || "approved"
  );

  useEffect(() => {
    fetchApprovalData();
  }, [token]);

  const fetchApprovalData = async () => {
    try {
      const response = await fetch(`/api/approvals/${token}`);
      if (!response.ok) throw new Error("Failed to fetch approval data");
      const data = await response.json();
      setApprovalData(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/approvals/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit approval");
      }

      setResult(result);
      setApprovalData((prev) =>
        prev
          ? {
              ...prev,
              approval: { ...prev.approval, status: decision },
            }
          : null
      );
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      const response = await fetch(`/api/approvals/${token}`, {
        method: "PUT",
      });
      const result = await response.json();

      if (response.ok) {
        await fetchApprovalData(); // Refresh data
        alert("Approval resent successfully!");
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading approval request...</p>
        </div>
      </div>
    );
  }

  if (error && !approvalData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-red-400 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Approval Not Found
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }
  console.log(approvalData);
  if (!approvalData) return null;

  const { approval } = approvalData;
  const { workflow, step } = approval;

  if (approval.status !== "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-green-400 text-6xl mb-4">
            {approval.status === "approved" ? "✅" : "❌"}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Approval {approval.status}
          </h1>
          <p className="text-gray-600 mb-4">
            This approval has already been {approval.status}.
          </p>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (approval.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-yellow-400 text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Approval Expired
          </h1>
          <p className="text-gray-600 mb-4">
            This approval link has expired. Please request a new one.
          </p>
          {approval.canResend && (
            <button
              onClick={handleResend}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 mb-4"
            >
              Resend Approval Request
            </button>
          )}
          <div>
            <a href="/dashboard" className="text-blue-600 hover:text-blue-800">
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-green-400 text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Decision Submitted
          </h1>
          <p className="text-gray-600 mb-4">
            Thank you for your response. The workflow will continue
            automatically.
          </p>
          <div className="bg-gray-50 p-4 rounded-md text-left mb-4">
            <p>
              <strong>Workflow:</strong> {workflow.type.replace("_", " ")}
            </p>
            <p>
              <strong>New State:</strong>{" "}
              {result.workflow?.state || "Processing..."}
            </p>
          </div>
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">Approval Required</h1>
            <p className="text-blue-100 mt-1">
              {step.config?.title || "Workflow Approval Request"}
            </p>
          </div>

          {/* Workflow Details */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Workflow: {workflow.type.replace("_", " ")}
            </h2>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Details:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {Object.entries(workflow.metadata || {}).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-500 capitalize">{key}:</span>
                    <span className="ml-2 text-gray-900">
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <p>
                This approval expires on{" "}
                {new Date(approval.expiresAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Approval Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Your Decision *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="decision"
                    value="approved"
                    checked={decision === "approved"}
                    onChange={(e) => setDecision(e.target.value as "approved")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    ✅ Approve
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="decision"
                    value="rejected"
                    checked={decision === "rejected"}
                    onChange={(e) => setDecision(e.target.value as "rejected")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    ❌ Reject
                  </span>
                </label>
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="feedback"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Feedback (Optional)
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                placeholder="Add any comments or reasons for your decision..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-between items-center">
              <a
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Dashboard
              </a>

              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-2 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  decision === "approved"
                    ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                    : "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submitting ? "Submitting..." : `Submit ${decision}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
