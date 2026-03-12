import { useState } from "react";
import { PencilSimple, Trash, Lightning } from "@phosphor-icons/react";
import DCCConnection from "@/models/dccConnection";

const APP_TYPE_CONFIG = {
  unreal: { label: "UE", color: "#0D47A1", name: "Unreal Engine" },
  blender: { label: "BL", color: "#EA7600", name: "Blender" },
  maya: { label: "MA", color: "#00BCD4", name: "Maya" },
  houdini: { label: "HO", color: "#FF5722", name: "Houdini" },
  unity: { label: "UN", color: "#222C37", name: "Unity" },
  godot: { label: "GO", color: "#478CBF", name: "Godot" },
};

export default function DCCConnectionCard({
  connection,
  onEdit,
  onDelete,
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const config = APP_TYPE_CONFIG[connection.appType] || {
    label: "??",
    color: "#6B7280",
    name: connection.appType,
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await DCCConnection.test(connection.id);
    setTestResult(result);
    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="bg-theme-bg-primary border border-white/10 rounded-xl p-4 flex flex-col gap-y-3">
      <div className="flex items-center gap-x-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: config.color }}
        >
          {config.label}
        </div>
        <div className="flex flex-col min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {connection.name}
          </p>
          <p className="text-theme-text-secondary text-xs">
            {config.name}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-x-1 shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "#6B7280" }}
            title="Status unknown"
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-1">
        <p className="text-theme-text-secondary text-xs">
          <span className="text-white/60">Host:</span>{" "}
          {connection.host}:{connection.port}
        </p>
        <p className="text-theme-text-secondary text-xs">
          <span className="text-white/60">Transport:</span>{" "}
          {connection.transport?.toUpperCase()}
        </p>
        {connection.autoConnect && (
          <p className="text-theme-text-secondary text-xs">
            <span className="text-green-400">Auto-connect</span>
          </p>
        )}
      </div>

      {testResult && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            testResult.success
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {testResult.success
            ? "Connection successful"
            : testResult.error || "Connection failed"}
        </div>
      )}

      <div className="flex items-center gap-x-2 pt-1 border-t border-white/10">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-x-1 text-xs text-theme-text-secondary hover:text-white transition-colors disabled:opacity-50"
          title="Test connection"
        >
          <Lightning className="h-3.5 w-3.5" weight="bold" />
          {testing ? "Testing..." : "Test"}
        </button>
        <button
          onClick={() => onEdit(connection)}
          className="flex items-center gap-x-1 text-xs text-theme-text-secondary hover:text-white transition-colors"
          title="Edit connection"
        >
          <PencilSimple className="h-3.5 w-3.5" weight="bold" />
          Edit
        </button>
        <button
          onClick={() => onDelete(connection.id)}
          className="flex items-center gap-x-1 text-xs text-theme-text-secondary hover:text-red-400 transition-colors ml-auto"
          title="Delete connection"
        >
          <Trash className="h-3.5 w-3.5" weight="bold" />
          Delete
        </button>
      </div>
    </div>
  );
}
