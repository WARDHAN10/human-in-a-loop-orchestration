import { prisma } from "@/app/lib/prisma";
import { WorkflowEngine } from "@/app/lib/workflow-engine";
import { NextResponse } from "next/server";
const engine = new WorkflowEngine();

export async function GET(request: Request) {
  try {
    const workflows = await prisma.workflowDefinition.findMany({
      orderBy: [{ name: "asc" }, { version: "desc" }],
    });

    if (workflows.length === 0) {
      return NextResponse.json([]);
    }

    return NextResponse.json(workflows);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Parse the JSON body first
    const body = await request.json();

    // Then destructure from the parsed body
    const { steps, name, description } = body;

    // Validate required fields
    if (!name || !steps) {
      return NextResponse.json(
        { error: "Name and steps are required fields" },
        { status: 400 }
      );
    }

    // Validate steps structure (make sure engine is imported)
    engine.validateWorkflowSteps(steps);

    // Check if definition already exists
    const existing = await prisma.workflowDefinition.findFirst({
      where: { name },
      orderBy: { version: "desc" },
    });

    const newVersion = existing ? existing.version + 1 : 1;

    const definition = await prisma.workflowDefinition.create({
      data: {
        name,
        version: newVersion,
        description,
        steps,
        isActive: true,
      },
    });

    console.log(`✅ Created workflow definition: ${name} v${newVersion}`);

    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    console.error("Error creating workflow definition:", error);

    // Handle specific error types
    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json(
        { error: `Invalid workflow steps: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
