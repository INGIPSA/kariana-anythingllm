import { useState } from "react";
import {
  PencilSimple,
  Trash,
  PlugsConnected,
  Chats,
} from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import Project from "@/models/project";

const APP_TYPE_LABELS = {
  unreal: "Unreal Engine",
  blender: "Blender",
  maya: "Maya",
  houdini: "Houdini",
  unity: "Unity",
  godot: "Godot",
};

export default function ProjectCard({ project, onDeleted, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");

  const connectionCount = project.project_connections?.length || 0;
  const workspaceCount = project.project_workspaces?.length || 0;

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`))
      return;
    const success = await Project.delete(project.id);
    if (success) {
      showToast("Project deleted", "info");
      onDeleted(project.id);
    } else {
      showToast("Failed to delete project", "error");
    }
  };

  const handleSaveEdit = async () => {
    const { project: updated, message } = await Project.update(project.id, {
      name,
      description,
    });
    if (updated) {
      showToast("Project updated", "info");
      setEditing(false);
      onUpdated?.();
    } else {
      showToast(message || "Failed to update project", "error");
    }
  };

  return (
    <div className="bg-theme-bg-primary border border-white/10 rounded-xl p-4 flex flex-col gap-y-3">
      {editing ? (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-theme-bg-secondary text-theme-text-primary text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:ring-1 focus:ring-primary-button"
            placeholder="Project name"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-theme-bg-secondary text-theme-text-primary text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:ring-1 focus:ring-primary-button resize-none"
            rows={2}
            placeholder="Description (optional)"
          />
          <div className="flex gap-x-2 justify-end">
            <button
              onClick={() => {
                setEditing(false);
                setName(project.name);
                setDescription(project.description || "");
              }}
              className="text-xs text-theme-text-secondary hover:text-white px-3 py-1 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="text-xs text-white bg-primary-button hover:bg-secondary px-3 py-1 rounded-lg"
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-y-1 min-w-0">
              <p className="text-sm font-semibold text-theme-text-primary truncate">
                {project.name}
              </p>
              {project.description && (
                <p className="text-xs text-theme-text-secondary line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-x-1 shrink-0 ml-2">
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-theme-text-secondary hover:text-white transition-colors"
                title="Edit project"
              >
                <PencilSimple className="h-4 w-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-theme-text-secondary hover:text-red-400 transition-colors"
                title="Delete project"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-x-3 mt-1">
            {project.defaultAppType && (
              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-button/20 text-primary-button">
                {APP_TYPE_LABELS[project.defaultAppType] || project.defaultAppType}
              </span>
            )}
            <div className="flex items-center gap-x-1 text-xs text-theme-text-secondary">
              <PlugsConnected className="h-3.5 w-3.5" />
              <span>{connectionCount}</span>
            </div>
            <div className="flex items-center gap-x-1 text-xs text-theme-text-secondary">
              <Chats className="h-3.5 w-3.5" />
              <span>{workspaceCount}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
