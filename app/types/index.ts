import { Prisma, StepKind, StepState, WorkflowState } from "@prisma/client";

// Core Entity Types
export interface Workflow {
  id: string;
  type: string;
  state: WorkflowState;
  metadata: WorkflowMetadata | null;
  createdAt: Date;
  updatedAt: Date;
  currentStepIndex: number;
  steps: Step[];
  approvals: Approval[];
  events: Event[];
}

export interface Step {
  id: string;
  workflowId: string;
  idx: number;
  kind: StepKind;
  state: StepState;
  config: StepConfig | null;
  compensating: any | null;
  createdAt: Date;
  updatedAt: Date;
  workflow: Workflow;
  Approval: Approval[];
}

export interface Approval {
  id: string;
  workflowId: string;
  stepId: string;
  channel: ApprovalChannel;
  status: ApprovalStatus;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  workflow: Workflow;
  step: Step;
}

export interface Event {
  id: string;
  workflowId: string;
  type: EventType;
  payload: any | null;
  createdAt: Date;
  workflow: Workflow;
}

// Configuration Types
export interface WorkflowMetadata {
  employee?: string;
  amount?: number;
  description?: string;
  category?: string;
  title?: string;
  content?: string;
  author?: string;
  [key: string]: any;
}
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  description: string | null;
  steps: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface WorkflowStepDefinition {
  idx: number;
  kind: StepKind;
  config: StepConfig;
  compensating?: CompensationConfig | null;
}
export interface CompensationConfig {
  action: string;
  parameters?: any;
  rollbackSteps?: number;
}
export interface StepConfig {
  action?: AutoAction;
  channel?: ApprovalChannel;
  title?: string;
  message?: string;
  assignee?: string;
  required?: boolean;
  fields?: ApprovalField[];
  [key: string]: any;
}

export interface ApprovalField {
  name: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

// Enum Types
export type ApprovalChannel = "web" | "slack" | "email" | "teams" | "sms";
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
export type AutoAction =
  | "validate_data"
  | "spell_check"
  | "process_payment"
  | "send_notification"
  | "publish_content";

export type EventType =
  | "WORKFLOW_CREATED"
  | "WORKFLOW_STARTED"
  | "STEP_EXECUTED"
  | "STEP_FAILED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "WORKFLOW_COMPLETED";

// API Types
export interface CreateWorkflowRequest {
  type: string;
  metadata: WorkflowMetadata;
}

export interface ApprovalDecisionRequest {
  decision: "approved" | "rejected";
  feedback?: string;
  fields?: { [key: string]: any };
}

// Component Props
export interface ApprovalPageProps {
  approval: Approval;
  workflow: Workflow;
}
export interface WorkflowDefinitionWithParsedSteps
  extends Omit<WorkflowDefinition, "steps"> {
  steps: WorkflowStepDefinition[];
}
