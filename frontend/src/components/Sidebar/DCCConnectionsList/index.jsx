import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DCCConnection from "@/models/dccConnection";
import paths from "@/utils/paths";

const APP_TYPE_COLORS = {
  unreal: "#0D47A1",
  blender: "#EA7600",
  maya: "#00BCD4",
  houdini: "#FF5722",
  unity: "#222C37",
  godot: "#478CBF",
};

export default function DCCConnectionsList() {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    DCCConnection.getAll()
      .then((found) => setConnections(found))
      .catch(() => setConnections([]));
  }, []);

  if (connections.length === 0) return null;

  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex items-center justify-between px-2">
        <p className="text-theme-text-secondary text-[10px] font-semibold uppercase tracking-wider">
          DCC Connections
        </p>
      </div>
      {connections.map((connection) => (
        <Link
          key={connection.id}
          to={paths.settings.dccConnections()}
          className="flex items-center gap-x-2 px-2 py-1.5 rounded-lg hover:bg-theme-action-menu-item-hover transition-colors group"
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor:
                APP_TYPE_COLORS[connection.appType] || "#6B7280",
            }}
          />
          <p className="text-theme-text-secondary group-hover:text-white text-xs truncate">
            {connection.name}
          </p>
        </Link>
      ))}
    </div>
  );
}
