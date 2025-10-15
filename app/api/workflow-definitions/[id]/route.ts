import { prisma } from '@/app/lib/prisma';
import { NextResponse } from 'next/server';


// GET /api/workflow-definitions/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workflow = await prisma.workflowDefinition.findUnique({
      where: { id }
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow definition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Error fetching workflow definition:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const workflow = await prisma.workflowDefinition.update({
      where: { id },
      data: body
    });

    return NextResponse.json(workflow);
  } catch (error: any) {
    console.error('Error updating workflow definition:', error);
    
    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Workflow definition not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/workflow-definitions/:id
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.workflowDefinition.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: 'Workflow definition deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting workflow definition:', error);
    
    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Workflow definition not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}