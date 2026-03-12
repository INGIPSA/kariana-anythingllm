import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "@/components/SettingsSidebar";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Plugs, Plus, Cube } from "@phosphor-icons/react";
import CTAButton from "@/components/lib/CTAButton";
import DCCConnection from "@/models/dccConnection";
import MCPServers from "@/models/mcpServers";
import DCCConnectionCard from "../DCCConnections/DCCConnectionCard";
import NewConnectionModal from "../DCCConnections/NewConnectionModal";
import { MCPServersList, MCPServerHeader } from "@/pages/Admin/Agents/MCPServers";
import ServerPanel from "@/pages/Admin/Agents/MCPServers/ServerPanel";
import { isMobile } from "react-device-detect";

const STATUS_POLL_INTERVAL = 10_000;

export default function Connections() {
  const [activeTab, setActiveTab] = useState("creative-apps");

  // DCC state
  const [dccLoading, setDccLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
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
      const found = await DCCConnection.getAll();
      setConnections(found);
    }
  }, []);

  useEffect(() => {
    fetchStatus().finally(() => setDccLoading(false));
    pollRef.current = setInterval(fetchStatus, STATUS_POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this connection?"))
      return;
    const result = await DCCConnection.delete(id);
    if (result.success) {
      setConnections((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleEdit = (connection) => {
    setEditingConnection(connection);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingConnection(null);
  };

  const handleSaved = () => {
    handleCloseModal();
    fetchStatus();
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
    { id: "creative-apps", label: "Creative Apps", icon: Plugs },
    { id: "mcp-servers", label: "MCP Servers", icon: Cube },
  ];

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
            <div className="items-center flex gap-x-4">
              <p className="text-lg leading-6 font-bold text-theme-text-primary">
                Connections
              </p>
            </div>
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

          {/* Tab Content */}
          {activeTab === "creative-apps" && (
            <>
              <div className="w-full justify-end flex">
                <CTAButton
                  onClick={() => setShowModal(true)}
                  className="mt-3 mr-0 mb-4 md:-mb-14 z-10"
                >
                  <Plus className="h-4 w-4" weight="bold" /> Add Connection
                </CTAButton>
              </div>
              <div className="mt-6">
                {dccLoading ? (
                  <Skeleton.default
                    height="80vh"
                    width="100%"
                    highlightColor="var(--theme-bg-primary)"
                    baseColor="var(--theme-bg-secondary)"
                    count={1}
                    className="w-full p-4 rounded-b-2xl rounded-tr-2xl rounded-tl-sm"
                    containerClassName="flex w-full"
                  />
                ) : connections.length === 0 ? (
                  <div className="w-full flex flex-col items-center justify-center py-20">
                    <Plugs className="h-12 w-12 text-theme-text-secondary mb-4" />
                    <p className="text-theme-text-secondary text-sm">
                      No creative app connections configured yet.
                    </p>
                    <p className="text-theme-text-secondary text-xs mt-1">
                      Click "Add Connection" to connect to Unreal Engine,
                      Blender, and more.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {connections.map((connection) => (
                      <DCCConnectionCard
                        key={connection.id}
                        connection={connection}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={fetchStatus}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

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
      {showModal && (
        <NewConnectionModal
          connection={editingConnection}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
