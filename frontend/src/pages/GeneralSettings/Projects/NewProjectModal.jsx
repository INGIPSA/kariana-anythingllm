import { useState } from "react";
import { X } from "@phosphor-icons/react";
import ModalWrapper from "@/components/ModalWrapper";
import Project from "@/models/project";
import showToast from "@/utils/toast";

const APP_TYPES = [
  { value: "", label: "None" },
  { value: "unreal", label: "Unreal Engine" },
  { value: "blender", label: "Blender" },
  { value: "maya", label: "Maya" },
  { value: "houdini", label: "Houdini" },
  { value: "unity", label: "Unity" },
  { value: "godot", label: "Godot" },
];

export default function NewProjectModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultAppType, setDefaultAppType] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Project name is required", "error");
      return;
    }

    setSaving(true);
    const { project, message } = await Project.create({
      name: name.trim(),
      description: description.trim(),
      defaultAppType: defaultAppType || null,
    });
    setSaving(false);

    if (project) {
      showToast("Project created successfully", "success");
      setName("");
      setDescription("");
      setDefaultAppType("");
      onCreated?.();
    } else {
      showToast(message || "Failed to create project", "error");
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setDefaultAppType("");
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen}>
      <div className="relative w-full max-w-[500px] max-h-full">
        <div className="relative bg-theme-bg-secondary rounded-lg shadow border border-theme-modal-border">
          <div className="flex items-start justify-between p-4 border-b rounded-t border-theme-modal-border">
            <h3 className="text-xl font-semibold text-theme-text-primary">
              New Project
            </h3>
            <button
              onClick={handleClose}
              type="button"
              className="transition-all duration-300 text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-sm p-1.5 ml-auto inline-flex items-center bg-transparent hover:bg-theme-modal-border"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-theme-text-primary">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-none bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button block w-full p-2.5"
                  placeholder="My Game Project"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-theme-text-primary">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-none bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button block w-full p-2.5 resize-none"
                  rows={3}
                  placeholder="A brief description of the project..."
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-theme-text-primary">
                  Default App Type
                </label>
                <select
                  value={defaultAppType}
                  onChange={(e) => setDefaultAppType(e.target.value)}
                  className="border-none bg-theme-settings-input-bg text-theme-text-primary text-sm rounded-lg focus:outline-primary-button block w-full p-2.5"
                >
                  {APP_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex w-full justify-between items-center p-6 space-x-2 border-t border-theme-modal-border rounded-b">
              <button
                onClick={handleClose}
                type="button"
                className="px-4 py-2 rounded-lg text-theme-text-secondary hover:text-theme-text-primary text-sm bg-transparent hover:bg-theme-modal-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="transition-all duration-300 border border-slate-200 px-4 py-2 rounded-lg text-white text-sm items-center flex gap-x-2 bg-primary-button hover:bg-secondary hover:text-white focus:ring-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalWrapper>
  );
}
