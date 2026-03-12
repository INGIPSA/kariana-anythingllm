import { useState } from "react";
import {
  PencilSimple,
  Trash,
  Lightning,
  Plug,
  PlugsConnected,
  CaretDown,
  CaretUp,
  Wrench,
} from "@phosphor-icons/react";
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
  onStatusChange,
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [tools, setTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(false);

  const isConnected = connection.connected || false;
  const toolCount = connection.toolCount || 0;

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

  const handleToggleConnect = async () => {
    setConnecting(true);
    try {
      if (isConnected) {
        await DCCConnection.disconnect(connection.id);
      } else {
        await DCCConnection.connect(connection.id);
      }
      if (onStatusChange) onStatusChange();
    } catch (e) {
      console.error("Connection toggle failed:", e);
    }
    setConnecting(false);
  };

  const handleToggleTools = async () => {
    if (!showTools && isConnected && tools.length === 0) {
      setLoadingTools(true);
      try {
        const allTools = await DCCConnection.tools();
        const myTools = allTools.filter(
          (t) => t.connectionId === connection.id
        );
        setTools(myTools);
      } catch {
        setTools([]);
      }
      setLoadingTools(false);
    }
    setShowTools(!showTools);
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
        <div className="ml-auto flex items-center gap-x-2 shrink-0">
          {isConnected && toolCount > 0 && (
            <span className="text-[10px] font-medium text-theme-text-secondary bg-white/5 px-1.5 py-0.5 rounded">
              {toolCount} tool{toolCount !== 1 ? "s" : ""}
            </span>
          )}
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? "animate-pulse" : ""
            }`}
            style={{
              backgroundColor: isConnected ? "#22C55E" : "#6B7280",
            }}
            title={isConnected ? "Connected" : "Disconnected"}
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

      {/* Connect/Disconnect button */}
      <button
        onClick={handleToggleConnect}
        disabled={connecting}
        className={`flex items-center justify-center gap-x-1.5 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50 ${
          isConnected
            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
        }`}
      >
        {isConnected ? (
          <>
            <PlugsConnected className="h-3.5 w-3.5" weight="bold" />
            {connecting ? "Disconnecting..." : "Disconnect"}
          </>
        ) : (
          <>
            <Plug className="h-3.5 w-3.5" weight="bold" />
            {connecting ? "Connecting..." : "Connect"}
          </>
        )}
      </button>

      {/* Expandable tools section */}
      {isConnected && toolCount > 0 && (
        <div className="border-t border-white/10 pt-2">
          <button
            onClick={handleToggleTools}
            className="flex items-center gap-x-1 text-xs text-theme-text-secondary hover:text-white transition-colors w-full"
          >
            <Wrench className="h-3 w-3" />
            <span>Available Tools ({toolCount})</span>
            {showTools ? (
              <CaretUp className="h-3 w-3 ml-auto" />
            ) : (
              <CaretDown className="h-3 w-3 ml-auto" />
            )}
          </button>
          {showTools && (
            <div className="mt-2 max-h-40 overflow-y-auto flex flex-col gap-y-1">
              {loadingTools ? (
                <p className="text-theme-text-secondary text-[10px]">
                  Loading tools...
                </p>
              ) : tools.length === 0 ? (
                <p className="text-theme-text-secondary text-[10px]">
                  No tools found.
                </p>
              ) : (
                tools.map((tool) => (
                  <div
                    key={tool.namespacedName}
                    className="bg-white/5 rounded px-2 py-1"
                  >
                    <p className="text-white text-[10px] font-mono truncate">
                      {tool.namespacedName}
                    </p>
                    {tool.description && (
                      <p className="text-theme-text-secondary text-[10px] truncate">
                        {tool.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
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
