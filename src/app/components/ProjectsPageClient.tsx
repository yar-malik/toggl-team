"use client";

import { useMemo, useState } from "react";

const PROJECT_COLORS = [
  "#2D9CDB",
  "#9B51E0",
  "#D53F8C",
  "#ED8936",
  "#C56A00",
  "#38A169",
  "#17A2B8",
  "#D97706",
  "#4C51BF",
  "#9F7AEA",
  "#D69E2E",
  "#6B8E23",
  "#E53E3E",
  "#4A5568",
  "#0EA5E9",
];

type Project = {
  key: string;
  name: string;
  color: string;
  totalSeconds: number;
  entryCount: number;
  source: "manual" | "external";
};

type EditModalState = {
  key: string;
  name: string;
  color: string;
};

function formatHours(totalSeconds: number) {
  const hours = totalSeconds / 3600;
  return `${hours.toFixed(2)} h`;
}

export default function ProjectsPageClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditModalState | null>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900">Projects</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="New project"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!newProjectName.trim()) {
                setError("Project name is required");
                return;
              }
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/projects", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: newProjectName }),
                });
                const data = (await res.json()) as { error?: string; project?: Project };
                if (!res.ok || data.error) throw new Error(data.error || "Failed to create project");
                if (data.project) {
                  setProjects((prev) => [...prev.filter((p) => p.key !== data.project!.key), data.project!]);
                }
                setNewProjectName("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create project");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            + New project
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Filters:</span> Member • Project name
      </div>

      {error && <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Entries</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((project) => (
              <tr key={project.key} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="inline-flex items-center gap-2 font-medium text-slate-900">
                    <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: project.color }} />
                    {project.name}
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-600">{formatHours(project.totalSeconds || 0)}</td>
                <td className="px-4 py-2 text-slate-600">{project.entryCount || 0}</td>
                <td className="px-4 py-2 text-slate-600">{project.source}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing({ key: project.key, name: project.name, color: project.color || "#0EA5E9" })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {sortedProjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-3xl font-semibold text-slate-900">Edit Project</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-3xl leading-none text-slate-500">
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-block h-8 w-8 rounded-full" style={{ backgroundColor: editing.color }} />
                <input
                  type="text"
                  value={editing.name}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-3xl font-semibold"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Project color</p>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                  {PROJECT_COLORS.map((color) => {
                    const active = editing.color.toUpperCase() === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditing((prev) => (prev ? { ...prev, color } : prev))}
                        className={`relative h-9 w-9 rounded-full border-2 ${active ? "border-slate-900" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {active && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!editing.name.trim()) {
                    setError("Project name is required");
                    return;
                  }
                  setBusy(true);
                  setError(null);
                  try {
                    const res = await fetch("/api/projects", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key: editing.key, name: editing.name, color: editing.color }),
                    });
                    const data = (await res.json()) as {
                      error?: string;
                      project?: { key: string; name: string; color: string };
                    };
                    if (!res.ok || data.error) throw new Error(data.error || "Failed to update project");
                    if (data.project) {
                      setProjects((prev) =>
                        prev.map((project) =>
                          project.key === data.project!.key
                            ? { ...project, name: data.project!.name, color: data.project!.color }
                            : project
                        )
                      );
                    }
                    setEditing(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to update project");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-xl bg-sky-700 px-8 py-3 text-lg font-semibold text-white disabled:bg-slate-300"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
