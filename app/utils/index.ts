import { WorkflowStepDefinition } from "../types";

export function getMetadata<T = any>(workflow: any): T {
  return workflow.metadata as T
}


export const parseSteps = (steps: any): WorkflowStepDefinition[] => {
  if (Array.isArray(steps)) {
    return steps as WorkflowStepDefinition[];
  }
  try {
    return typeof steps === 'string' ? JSON.parse(steps) : steps;
  } catch {
    return [];
  }
};

export const prepareStepsForAPI = (steps: WorkflowStepDefinition[]): any => {
  return steps; // Let Prisma handle the JSON conversion
};
