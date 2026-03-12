import { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Plugs, Plus } from "@phosphor-icons/react";
import CTAButton from "@/components/lib/CTAButton";
import DCCConnection from "@/models/dccConnection";
import DCCConnectionCard from "./DCCConnectionCard";
import NewConnectionModal from "./NewConnectionModal";
import { isMobile } from "react-device-detect";

export default function DCCConnections() {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);

  const fetchConnections = async () => {
    const found = await DCCConnection.getAll();
    setConnections(found);
  };

  useEffect(() => {
    fetchConnections().finally(() => setLoading(false));
  }, []);

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
    fetchConnections();
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex md:mt-0 mt-6">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
          <div className="w-full flex flex-col gap-y-1 pb-6 border-white/10 border-b-2">
            <div className="items-center flex gap-x-4">
              <p className="text-lg leading-6 font-bold text-theme-text-primary">
                DCC Connections
              </p>
            </div>
            <p className="text-xs leading-[18px] font-base text-theme-text-secondary mt-2">
              Connect to creative applications like Unreal Engine, Blender,
              Maya, Houdini, Unity, and Godot via MCP protocol.
            </p>
          </div>
          <div className="w-full justify-end flex">
            <CTAButton
              onClick={() => setShowModal(true)}
              className="mt-3 mr-0 mb-4 md:-mb-14 z-10"
            >
              <Plus className="h-4 w-4" weight="bold" /> Add Connection
            </CTAButton>
          </div>
          <div className="mt-6">
            {loading ? (
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
                  No DCC connections configured yet.
                </p>
                <p className="text-theme-text-secondary text-xs mt-1">
                  Click "Add Connection" to connect to a creative application.
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
                  />
                ))}
              </div>
            )}
          </div>
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
