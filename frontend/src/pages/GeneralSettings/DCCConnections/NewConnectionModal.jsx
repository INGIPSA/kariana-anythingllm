import { useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import ModalWrapper from "@/components/ModalWrapper";
import DCCConnection from "@/models/dccConnection";

const APP_TYPES = [
  { value: "unreal", label: "Unreal Engine" },
  { value: "blender", label: "Blender" },
  { value: "maya", label: "Maya" },
  { value: "houdini", label: "Houdini" },
  { value: "unity", label: "Unity" },
  { value: "godot", label: "Godot" },
];

const TRANSPORTS = [
  { value: "sse", label: "SSE" },
  { value: "http", label: "HTTP" },
  { value: "stdio", label: "Stdio" },
];

const DEFAULT_PORTS = {
  unreal: 8080,
  blender: 8081,
  maya: 8082,
  houdini: 8083,
  unity: 8084,
  godot: 8085,
};

export default function NewConnectionModal({
  connection = null,
  onClose,
  onSaved,
}) {
  const formEl = useRef(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isEditing = !!connection;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(formEl.current);
    const data = {
      name: form.get("name"),
      appType: form.get("appType"),
      host: form.get("host") || "localhost",
      port: parseInt(form.get("port")),
      transport: form.get("transport"),
      autoConnect: form.get("autoConnect") === "on",
    };

    let result;
    if (isEditing) {
      result = await DCCConnection.update(connection.id, data);
    } else {
      result = await DCCConnection.create(data);
    }

    setSaving(false);

    if (result.success === false) {
      setError(result.error || "Failed to save connection");
      return;
    }

    onSaved();
  };

  return (
    <ModalWrapper isOpen={true}>
      <div className="w-full max-w-2xl bg-theme-bg-secondary rounded-lg shadow border-2 border-theme-modal-border overflow-hidden">
        <div className="relative p-6 border-b rounded-t border-theme-modal-border">
          <div className="w-full flex gap-x-2 items-center">
            <h3 className="text-xl font-semibold text-white overflow-hidden overflow-ellipsis whitespace-nowrap">
              {isEditing ? "Edit Connection" : "New DCC Connection"}
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 transition-all duration-300 bg-transparent rounded-lg text-sm p-1 inline-flex items-center hover:bg-theme-modal-border hover:border-theme-modal-border hover:border-opacity-50 border-transparent border"
          >
            <X size={24} weight="bold" className="text-white" />
          </button>
        </div>
        <div
          className="h-full w-full overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          <form ref={formEl} onSubmit={handleSubmit}>
            <div className="py-7 px-9 space-y-2 flex-col">
              <div className="w-full flex flex-col gap-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block mb-2 text-sm font-medium text-white"
                  >
                    Connection Name
                  </label>
                  <input
                    name="name"
                    type="text"
                    id="name"
                    className="border-none bg-theme-settings-input-bg w-full text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                    placeholder="e.g. My Unreal Project"
                    defaultValue={connection?.name || ""}
                    required={true}
                    autoComplete="off"
                    autoFocus={true}
                  />
                </div>

                <div>
                  <label
                    htmlFor="appType"
                    className="block mb-2 text-sm font-medium text-white"
                  >
                    Application Type
                  </label>
                  <select
                    name="appType"
                    id="appType"
                    className="border-none bg-theme-settings-input-bg w-full text-white text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                    defaultValue={connection?.appType || "unreal"}
                    required={true}
                  >
                    {APP_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="host"
                      className="block mb-2 text-sm font-medium text-white"
                    >
                      Host
                    </label>
                    <input
                      name="host"
                      type="text"
                      id="host"
                      className="border-none bg-theme-settings-input-bg w-full text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                      placeholder="localhost"
                      defaultValue={connection?.host || "localhost"}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="port"
                      className="block mb-2 text-sm font-medium text-white"
                    >
                      Port
                    </label>
                    <input
                      name="port"
                      type="number"
                      id="port"
                      className="border-none bg-theme-settings-input-bg w-full text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                      placeholder="8080"
                      defaultValue={
                        connection?.port || DEFAULT_PORTS.unreal
                      }
                      min={1}
                      max={65535}
                      required={true}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="transport"
                    className="block mb-2 text-sm font-medium text-white"
                  >
                    Transport
                  </label>
                  <select
                    name="transport"
                    id="transport"
                    className="border-none bg-theme-settings-input-bg w-full text-white text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                    defaultValue={connection?.transport || "sse"}
                    required={true}
                  >
                    {TRANSPORTS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-x-3">
                  <input
                    name="autoConnect"
                    type="checkbox"
                    id="autoConnect"
                    className="w-4 h-4 rounded border-none bg-theme-settings-input-bg text-primary-button focus:ring-primary-button"
                    defaultChecked={connection?.autoConnect || false}
                  />
                  <label
                    htmlFor="autoConnect"
                    className="text-sm font-medium text-white"
                  >
                    Auto-connect on startup
                  </label>
                </div>

                {error && (
                  <p className="text-red-400 text-sm">Error: {error}</p>
                )}
              </div>
            </div>
            <div className="flex w-full justify-end items-center p-6 space-x-2 border-t border-theme-modal-border rounded-b">
              <button
                type="button"
                onClick={onClose}
                className="transition-all duration-300 text-white hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="transition-all duration-300 bg-white text-black hover:opacity-60 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update"
                    : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalWrapper>
  );
}
