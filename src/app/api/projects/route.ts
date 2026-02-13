import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/manualTimeEntriesStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CreateProjectBody = {
  name?: string;
};

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({
      projects: projects.map((project) => ({
        key: project.project_key,
        name: project.project_name,
        source: project.project_key.startsWith("manual:") ? "manual" : "external",
      })),
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: CreateProjectBody;
  try {
    body = (await request.json()) as CreateProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  try {
    const project = await createProject(name);
    return NextResponse.json({
      ok: true,
      project: {
        key: project.projectKey,
        name: project.projectName,
        source: "manual",
      },
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

