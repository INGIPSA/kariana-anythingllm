import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { Plugs, Cube, PlugsConnected, Plug, CaretDown, CaretUp, Wrench } from "@phosphor-icons/react";
import DCCConnection from "@/models/dccConnection";
import MCPServers from "@/models/mcpServers";
import { MCPServersList, MCPServerHeader } from "@/pages/Admin/Agents/MCPServers";
import ServerPanel from "@/pages/Admin/Agents/MCPServers/ServerPanel";
import { isMobile } from "react-device-detect";
import {
  UnrealLogo,
  BlenderLogo,
  MayaLogo,
  HoudiniLogo,
  UnityLogo,
  GodotLogo,
} from "@/media/creativeApps";

const STATUS_POLL_INTERVAL = 10_000;

// App definitions — only "unreal" is enabled for now
const APPS = [
  {
    id: "unreal",
    name: "Unreal Engine",
    logo: UnrealLogo,
    color: "#0D47A1",
    enabled: true,
    description: "Connect to Unreal Engine via KARIANA plugin",
    defaultHost: "localhost",
    // Two MCP servers auto-created for Unreal
    servers: [
      { suffix: "Core", port: 8001 },
      { suffix: "Remote", port: 8002 },
    ],
  },
  {
    id: "blender",
    name: "Blender",
    logo: BlenderLogo,
    color: "#EA7600",
    enabled: false,
  },
  {
    id: "maya",
    name: "Maya",
    logo: MayaLogo,
    color: "#00BCD4",
    enabled: false,
  },
  {
    id: "houdini",
    name: "Houdini",
    logo: HoudiniLogo,
    color: "#FF5722",
    enabled: false,
  },
  {
    id: "unity",
    name: "Unity",
    logo: UnityLogo,
    color: "#222C37",
    enabled: false,
  },
  {
    id: "godot",
    name: "Godot",
    logo: GodotLogo,
    color: "#478CBF",
    enabled: false,
  },
];

export default function Connections() {
  const [activeTab, setActiveTab] = useState("apps");

  // Apps / DCC state
  const [connections, setConnections] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [configHost, setConfigHost] = useState("localhost");
  const [configAutoConnect, setConfigAutoConnect] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [tools, setTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const pollRef = useRef(null);

  // MCP state
  const [mcpServers, setMcpServers] = useState([]);
  const [selectedMcpServer, setSelectedMcpServer] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const statusList = await DCCConnection.status();
      if (statusList.length > 0) {
        setConnections(statusList);
      } else {
        const found = await DCCConnection.getAll();
        setConnections(found);
      }
    } catch {
      try {
        const found = await DCCConnection.getAll();
        setConnections(found);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, STATUS_POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // Get connections for a specific app type
  const getAppConnections = (appId) =>
    connections.filter((c) => c.appType === appId);

  const isAppConnected = (appId) =>
    getAppConnections(appId).some((c) => c.connected);

  const getAppToolCount = (appId) =>
    getAppConnections(appId).reduce((sum, c) => sum + (c.toolCount || 0), 0);

  // When selecting an app, load its current config from existing connections
  const handleSelectApp = (app) => {
    if (!app.enabled) return;
    if (selectedApp?.id === app.id) {
      setSelectedApp(null);
      setShowTools(false);
      setTools([]);
      return;
    }
    setSelectedApp(app);
    setShowTools(false);
    setTools([]);
    const existing = getAppConnections(app.id);
    if (existing.length > 0) {
      setConfigHost(existing[0].host || "localhost");
      setConfigAutoConnect(existing[0].autoConnect || false);
    } else {
      setConfigHost(app.defaultHost || "localhost");
      setConfigAutoConnect(true);
    }
  };

  // Save config: create or update the DCC connections for the app
  const handleSaveConfig = async () => {
    if (!selectedApp) return;
    setSaving(true);
    const existing = getAppConnections(selectedApp.id);

    for (const server of selectedApp.servers) {
      const name = `${selectedApp.name} ${server.suffix}`;
      const match = existing.find((c) =>
        c.name === name || c.port === server.port
      );

      const data = {
        name,
        appType: selectedApp.id,
        host: configHost,
        port: server.port,
        transport: "sse",
        autoConnect: configAutoConnect,
      };

      if (match) {
        await DCCConnection.update(match.id, data);
      } else {
        await DCCConnection.create(data);
      }
    }

    await fetchStatus();
    setSaving(false);
  };

  // Connect/disconnect all connections for an app
  const handleToggleConnect = async () => {
    if (!selectedApp) return;
    setConnecting(true);
    const appConns = getAppConnections(selectedApp.id);
    const connected = isAppConnected(selectedApp.id);

    for (const conn of appConns) {
      if (connected) {
        await DCCConnection.disconnect(conn.id);
      } else {
        await DCCConnection.connect(conn.id);
      }
    }

    await fetchStatus();
    setConnecting(false);
  };

  // Delete all connections for an app
  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    if (!window.confirm(`Remove ${selectedApp.name} configuration?`)) return;
    const appConns = getAppConnections(selectedApp.id);
    for (const conn of appConns) {
      await DCCConnection.delete(conn.id);
    }
    setSelectedApp(null);
    await fetchStatus();
  };

  const handleToggleTools = async () => {
    if (!showTools && selectedApp) {
      setLoadingTools(true);
      try {
        const allTools = await DCCConnection.tools();
        const appConns = getAppConnections(selectedApp.id);
        const connIds = appConns.map((c) => c.id);
        setTools(allTools.filter((t) => connIds.includes(t.connectionId)));
      } catch {
        setTools([]);
      }
      setLoadingTools(false);
    }
    setShowTools(!showTools);
  };

  const toggleMCP = (serverName) => {
    setMcpServers((prev) =>
      prev.map((s) =>
        s.name === serverName ? { ...s, running: !s.running } : s
      )
    );
  };

  const handleMCPServerDelete = (serverName) => {
    setSelectedMcpServer(null);
    setMcpServers((prev) => prev.filter((s) => s.name !== serverName));
  };

  const tabs = [
    { id: "apps", label: "Apps", icon: Plugs },
    { id: "mcp-servers", label: "MCP Servers", icon: Cube },
  ];

  const appHasConfig = (appId) => getAppConnections(appId).length > 0;

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex md:mt-0 mt-6">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
          {/* Header */}
          <div className="w-full flex flex-col gap-y-1 pb-6 border-white/10 border-b-2">
            <p className="text-lg leading-6 font-bold text-theme-text-primary">
              Connections
            </p>
            <p className="text-xs leading-[18px] font-base text-theme-text-secondary mt-2">
              Manage connections to creative applications and MCP tool servers.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-x-1 mt-4 border-b border-white/10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedMcpServer(null);
                    setSelectedApp(null);
                  }}
                  className={`flex items-center gap-x-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                    activeTab === tab.id
                      ? "border-primary-button text-white"
                      : "border-transparent text-theme-text-secondary hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Apps Tab */}
          {activeTab === "apps" && (
            <div className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {APPS.map((app) => {
                  const connected = isAppConnected(app.id);
                  const toolCount = getAppToolCount(app.id);
                  const configured = appHasConfig(app.id);
                  const isSelected = selectedApp?.id === app.id;

                  return (
                    <button
                      key={app.id}
                      onClick={() => handleSelectApp(app)}
                      disabled={!app.enabled}
                      className={`relative flex flex-col items-center gap-y-3 p-5 rounded-xl border transition-all ${
                        !app.enabled
                          ? "opacity-40 cursor-not-allowed border-white/5 bg-theme-bg-primary"
                          : isSelected
                            ? "border-primary-button bg-theme-bg-primary shadow-lg shadow-primary-button/10"
                            : "border-white/10 bg-theme-bg-primary hover:border-white/20 hover:bg-theme-bg-primary/80 cursor-pointer"
                      }`}
                    >
                      {/* Logo */}
                      <img
                        src={app.logo}
                        alt={app.name}
                        className="w-12 h-12 rounded-lg"
                        draggable={false}
                      />

                      {/* Name */}
                      <p className={`text-sm font-medium text-center ${
                        app.enabled ? "text-white" : "text-theme-text-secondary"
                      }`}>
                        {app.name}
                      </p>

                      {/* Status indicators */}
                      {app.enabled && connected && (
                        <div className="flex items-center gap-x-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[10px] text-green-400">
                            Connected
                            {toolCount > 0 && ` (${toolCount} tools)`}
                          </span>
                        </div>
                      )}

                      {app.enabled && configured && !connected && (
                        <div className="flex items-center gap-x-1.5">
                          <div className="w-2 h-2 rounded-full bg-gray-500" />
                          <span className="text-[10px] text-theme-text-secondary">
                            Configured
                          </span>
                        </div>
                      )}

                      {/* Coming Soon badge */}
                      {!app.enabled && (
                        <span className="text-[10px] font-medium text-theme-text-secondary bg-white/5 px-2 py-0.5 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected App Config Panel */}
              {selectedApp && (
                <div className="mt-6 bg-theme-bg-primary border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-x-4 mb-6">
                    <img
                      src={selectedApp.logo}
                      alt={selectedApp.name}
                      className="w-10 h-10 rounded-lg"
                    />
                    <div>
                      <p className="text-white font-semibold">
                        {selectedApp.name}
                      </p>
                      <p className="text-theme-text-secondary text-xs">
                        {selectedApp.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-4 max-w-md">
                    {/* Host */}
                    <div>
                      <label
                        htmlFor="app-host"
                        className="block mb-2 text-sm font-medium text-white"
                      >
                        Host
                      </label>
                      <input
                        id="app-host"
                        type="text"
                        value={configHost}
                        onChange={(e) => setConfigHost(e.target.value)}
                        placeholder="localhost"
                        className="border-none bg-theme-settings-input-bg w-full text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                      />
                      <p className="text-theme-text-secondary text-[10px] mt-1">
                        MCP servers on ports{" "}
                        {selectedApp.servers.map((s) => s.port).join(" and ")}
                      </p>
                    </div>

                    {/* Auto-connect */}
                    <div className="flex items-center gap-x-3">
                      <input
                        id="app-autoconnect"
                        type="checkbox"
                        checked={configAutoConnect}
                        onChange={(e) => setConfigAutoConnect(e.target.checked)}
                        className="w-4 h-4 rounded border-none bg-theme-settings-input-bg text-primary-button focus:ring-primary-button"
                      />
                      <label
                        htmlFor="app-autoconnect"
                        className="text-sm font-medium text-white"
                      >
                        Auto-connect on startup
                      </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-x-3 mt-2">
                      <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="transition-all duration-300 bg-white text-black hover:opacity-60 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? "Saving..." : appHasConfig(selectedApp.id) ? "Update" : "Save"}
                      </button>

                      {appHasConfig(selectedApp.id) && (
                        <>
                          <button
                            onClick={handleToggleConnect}
                            disabled={connecting}
                            className={`flex items-center gap-x-1.5 text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 ${
                              isAppConnected(selectedApp.id)
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                            }`}
                          >
                            {isAppConnected(selectedApp.id) ? (
                              <>
                                <PlugsConnected className="h-4 w-4" weight="bold" />
                                {connecting ? "Disconnecting..." : "Disconnect"}
                              </>
                            ) : (
                              <>
                                <Plug className="h-4 w-4" weight="bold" />
                                {connecting ? "Connecting..." : "Connect"}
                              </>
                            )}
                          </button>

                          <button
                            onClick={handleDeleteApp}
                            className="text-sm text-theme-text-secondary hover:text-red-400 transition-colors px-3 py-2"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>

                    {/* Tools section */}
                    {isAppConnected(selectedApp.id) && getAppToolCount(selectedApp.id) > 0 && (
                      <div className="border-t border-white/10 pt-4 mt-2">
                        <button
                          onClick={handleToggleTools}
                          className="flex items-center gap-x-1.5 text-xs text-theme-text-secondary hover:text-white transition-colors"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          <span>Available Tools ({getAppToolCount(selectedApp.id)})</span>
                          {showTools ? (
                            <CaretUp className="h-3 w-3 ml-1" />
                          ) : (
                            <CaretDown className="h-3 w-3 ml-1" />
                          )}
                        </button>
                        {showTools && (
                          <div className="mt-3 max-h-60 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {loadingTools ? (
                              <p className="text-theme-text-secondary text-xs">
                                Loading tools...
                              </p>
                            ) : tools.length === 0 ? (
                              <p className="text-theme-text-secondary text-xs">
                                No tools found.
                              </p>
                            ) : (
                              tools.map((tool) => (
                                <div
                                  key={tool.namespacedName}
                                  className="bg-white/5 rounded px-2 py-1.5"
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
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MCP Servers Tab */}
          {activeTab === "mcp-servers" && (
            <div className="mt-4 flex gap-x-6">
              <div className="flex flex-col min-w-[320px]">
                <MCPServerHeader
                  setMcpServers={setMcpServers}
                  setSelectedMcpServer={setSelectedMcpServer}
                >
                  {({ loadingMcpServers }) => (
                    <MCPServersList
                      isLoading={loadingMcpServers}
                      servers={mcpServers}
                      selectedServer={selectedMcpServer}
                      handleClick={setSelectedMcpServer}
                    />
                  )}
                </MCPServerHeader>
              </div>
              {selectedMcpServer && (
                <div className="flex-1 bg-theme-bg-primary rounded-xl p-4 overflow-y-auto max-h-[calc(100vh-250px)]">
                  <ServerPanel
                    server={selectedMcpServer}
                    toggleServer={toggleMCP}
                    onDelete={handleMCPServerDelete}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
