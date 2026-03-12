# Unified Connections Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the DCC Connections settings page and the MCP Servers section (from Agent Skills) into a single "Connections" page with two tabs: "Creative Apps" and "MCP Servers".

**Architecture:** Create a new `/settings/connections` route that combines both UIs. The Creative Apps tab reuses the existing DCC connection cards/modal. The MCP Servers tab reuses the existing MCP server list/panel. Remove the standalone DCC Connections page, remove MCP servers from Agent Skills, and update sidebar navigation.

**Tech Stack:** React, React Router, Phosphor Icons, existing API models (DCCConnection, MCPServers)

---

### Task 1: Create the unified Connections page

**Files:**
- Create: `frontend/src/pages/GeneralSettings/Connections/index.jsx`

**Step 1: Create the Connections page component**

```jsx
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

  const toggleMCP = async (serverName) => {
    const result = await MCPServers.toggleServer(serverName);
    if (!result.success) return;
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
```

**Step 2: Verify the file was created correctly**

Run: `ls frontend/src/pages/GeneralSettings/Connections/index.jsx`
Expected: File exists

**Step 3: Commit**

```bash
git add frontend/src/pages/GeneralSettings/Connections/index.jsx
git commit -m "feat: create unified Connections page with Creative Apps and MCP Servers tabs"
```

---

### Task 2: Add the route and update paths

**Files:**
- Modify: `frontend/src/main.jsx` (lines 376-382)
- Modify: `frontend/src/utils/paths.js` (lines 142-144, 173-175)

**Step 1: Add the new route in main.jsx**

Replace the existing DCC connections route block (lines 376-382) with the new Connections route:

```jsx
{
  path: "/settings/connections",
  lazy: async () => {
    const { default: Connections } = await import(
      "@/pages/GeneralSettings/Connections"
    );
    return { element: <AdminRoute Component={Connections} /> };
  },
},
```

Also keep the old `/settings/dcc-connections` route but redirect to `/settings/connections`:

```jsx
{
  path: "/settings/dcc-connections",
  lazy: async () => {
    const { Navigate } = await import("react-router-dom");
    return { element: <Navigate to="/settings/connections" replace /> };
  },
},
```

**Step 2: Update paths.js**

Change `agentSkills` to keep pointing to `/settings/agents` (no change needed).

Add `connections` path and update `dccConnections` to point to the new route:

In `frontend/src/utils/paths.js`, change:
```js
dccConnections: () => {
  return `/settings/dcc-connections`;
},
```
to:
```js
connections: () => {
  return `/settings/connections`;
},
dccConnections: () => {
  return `/settings/connections`;
},
```

**Step 3: Commit**

```bash
git add frontend/src/main.jsx frontend/src/utils/paths.js
git commit -m "feat: add /settings/connections route and update path helpers"
```

---

### Task 3: Update the sidebar navigation

**Files:**
- Modify: `frontend/src/components/SettingsSidebar/index.jsx` (lines 271-278, 314-327)

**Step 1: Replace the DCC Connections sidebar entry with "Connections"**

Change lines 271-278 from:
```jsx
<Option
  btnText="DCC Connections"
  icon={<Plugs className="h-5 w-5 flex-shrink-0" />}
  href={paths.settings.dccConnections()}
  user={user}
  flex={true}
  roles={["admin"]}
/>
```
to:
```jsx
<Option
  btnText="Connections"
  icon={<Plugs className="h-5 w-5 flex-shrink-0" />}
  href={paths.settings.connections()}
  user={user}
  flex={true}
  roles={["admin"]}
/>
```

**Step 2: Commit**

```bash
git add frontend/src/components/SettingsSidebar/index.jsx
git commit -m "feat: rename DCC Connections to Connections in sidebar"
```

---

### Task 4: Remove MCP Servers from Agent Skills page

**Files:**
- Modify: `frontend/src/pages/Admin/Agents/index.jsx`

**Step 1: Remove MCP server imports, state, and handlers**

Remove from imports (line 26-27):
```jsx
import { MCPServersList, MCPServerHeader } from "./MCPServers";
import ServerPanel from "./MCPServers/ServerPanel";
```

Remove state variables (lines 49-51):
```jsx
// MCP Servers are lazy loaded to not block the UI thread
const [mcpServers, setMcpServers] = useState([]);
const [selectedMcpServer, setSelectedMcpServer] = useState(null);
```

Remove handler functions:
- `handleMCPClick` (lines 217-222)
- `handleMCPServerDelete` (lines 230-235)
- `toggleMCP` (lines 123-130)

Remove `setSelectedMcpServer(null)` from `handleSkillClick` (line 205) and `handleFlowClick` (line 212).

**Step 2: Remove MCP server UI from mobile view**

Remove the MCPServerHeader/MCPServersList block (lines 323-337 in the mobile section).

Remove the `selectedMcpServer` conditional rendering in the mobile detail panel (lines 363-368).

**Step 3: Remove MCP server UI from desktop view**

Remove the MCPServerHeader/MCPServersList block (lines 531-545 in the desktop section).

Remove the `selectedMcpServer` conditional rendering in the desktop detail panel (lines 555-560).

**Step 4: Update the empty state text**

Change "Select an Agent Skill, Agent Flow, or MCP Server" to "Select an Agent Skill or Agent Flow" in both mobile (line 419) and desktop (line 612) views.

**Step 5: Remove the `SelectedSkillComponent` check for `selectedMcpServer`**

The `SelectedSkillComponent` computed value (find this in the code) should no longer consider `selectedMcpServer`.

**Step 6: Commit**

```bash
git add frontend/src/pages/Admin/Agents/index.jsx
git commit -m "refactor: remove MCP Servers section from Agent Skills page"
```

---

### Task 5: Update sidebar DCC connections list link

**Files:**
- Modify: `frontend/src/components/Sidebar/DCCConnectionsList/index.jsx`

**Step 1: Update the link target**

Find where it links to `/settings/dcc-connections` or `paths.settings.dccConnections()` and ensure it points to the new connections page. Since we updated `dccConnections()` in paths.js to return `/settings/connections`, this should already work. Verify the component uses `paths.settings.dccConnections()`.

**Step 2: Commit (if changes needed)**

```bash
git add frontend/src/components/Sidebar/DCCConnectionsList/index.jsx
git commit -m "fix: update sidebar DCC list link to new Connections page"
```

---

### Task 6: Update default ports in NewConnectionModal

**Files:**
- Modify: `frontend/src/pages/GeneralSettings/DCCConnections/NewConnectionModal.jsx` (lines 21-28)

**Step 1: Update default ports to match the KARIANA auto-start ports**

Change:
```js
const DEFAULT_PORTS = {
  unreal: 8080,
  blender: 8081,
  maya: 8082,
  houdini: 8083,
  unity: 8084,
  godot: 8085,
};
```
to:
```js
const DEFAULT_PORTS = {
  unreal: 8001,
  blender: 8081,
  maya: 8082,
  houdini: 8083,
  unity: 8084,
  godot: 8085,
};
```

**Step 2: Commit**

```bash
git add frontend/src/pages/GeneralSettings/DCCConnections/NewConnectionModal.jsx
git commit -m "fix: update default Unreal Engine port to 8001 to match KARIANA auto-start"
```

---

### Task 7: Verify and test

**Step 1: Start the dev server**

Run: `cd frontend && yarn dev`
Expected: Compiles without errors

**Step 2: Verify routing**

- Navigate to `/settings/connections` - should show the unified page with two tabs
- Navigate to `/settings/dcc-connections` - should redirect to `/settings/connections`
- Sidebar should show "Connections" link
- Agent Skills page should no longer show MCP Servers section

**Step 3: Verify tab functionality**

- "Creative Apps" tab should show DCC connection cards with add/edit/delete/connect
- "MCP Servers" tab should show MCP server list with detail panel on click

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: unified Connections page complete"
```
