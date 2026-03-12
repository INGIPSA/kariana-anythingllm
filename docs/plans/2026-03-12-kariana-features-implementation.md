# Kariana Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Kariana-specific features (DCC connections, MCP host, smart routing, projects, Clerk auth) to the AnythingLLM fork while preserving its existing look and feel.

**Architecture:** Extends AnythingLLM's existing patterns — Prisma models, Express endpoints, React settings pages with SettingsSidebar. New features are additive: DCC connections as a new Prisma model + settings page + sidebar section; MCP Host extends the existing MCPHypervisor; Clerk wraps existing AuthContext.

**Tech Stack:** React 18, Express, Prisma/SQLite, @modelcontextprotocol/sdk, @clerk/clerk-react, @clerk/express, Tailwind CSS 3, Phosphor Icons.

**Repo:** `D:/Developer/Kariana/kariana-anythingllm` (branch: `master`)

**Parallelization:**
- Batch 1 (parallel): Phase 1, Phase 4, Phase 5
- Batch 2 (sequential after Phase 1): Phase 2, then Phase 3
- Phase 6: Future/deferred

---

## Phase 1: DCC Connection Manager

### Task 1.1: Prisma Schema — DCCConnection Model

**Files:**
- Modify: `server/prisma/schema.prisma`

**Step 1: Add the DCCConnection model to the Prisma schema**

Add at the end of `server/prisma/schema.prisma`:

```prisma
model dcc_connections {
  id            Int      @id @default(autoincrement())
  name          String
  appType       String   // "unreal", "blender", "maya", "houdini", "unity", "godot"
  host          String   @default("localhost")
  port          Int
  transport     String   @default("sse") // "stdio", "sse", "http"
  autoConnect   Boolean  @default(false)
  createdBy     Int?
  createdAt     DateTime @default(now())
  lastUpdatedAt DateTime @default(now())
}
```

**Step 2: Generate migration and Prisma client**

Run from repo root:
```bash
cd server && npx prisma migrate dev --name add_dcc_connections
```
Expected: Migration created, Prisma client regenerated.

**Step 3: Commit**
```bash
git add server/prisma/
git commit -m "feat(dcc): add DCCConnection prisma model and migration"
```

---

### Task 1.2: Server Model — dccConnection.js

**Files:**
- Create: `server/models/dccConnection.js`

**Step 1: Create the Prisma model wrapper**

Follow the pattern from `server/models/workspace.js`. This model wraps Prisma queries.

```javascript
const prisma = require("../utils/prisma");

const DCCConnection = {
  supportedAppTypes: ["unreal", "blender", "maya", "houdini", "unity", "godot"],
  supportedTransports: ["stdio", "sse", "http"],

  writable: ["name", "appType", "host", "port", "transport", "autoConnect"],

  new: async function (data = {}) {
    try {
      const connection = await prisma.dcc_connections.create({
        data: {
          name: data.name,
          appType: String(data.appType).toLowerCase(),
          host: data.host || "localhost",
          port: Number(data.port),
          transport: data.transport || "sse",
          autoConnect: data.autoConnect || false,
          createdBy: data.createdBy || null,
        },
      });
      return { connection, error: null };
    } catch (error) {
      console.error("DCCConnection.new", error.message);
      return { connection: null, error: error.message };
    }
  },

  update: async function (id, data = {}) {
    try {
      const validData = {};
      for (const key of this.writable) {
        if (data.hasOwnProperty(key)) {
          validData[key] = key === "port" ? Number(data[key]) : data[key];
        }
      }
      validData.lastUpdatedAt = new Date();

      const connection = await prisma.dcc_connections.update({
        where: { id: Number(id) },
        data: validData,
      });
      return { connection, error: null };
    } catch (error) {
      console.error("DCCConnection.update", error.message);
      return { connection: null, error: error.message };
    }
  },

  get: async function (clause = {}) {
    try {
      const connection = await prisma.dcc_connections.findFirst({
        where: clause,
      });
      return connection;
    } catch (error) {
      console.error("DCCConnection.get", error.message);
      return null;
    }
  },

  where: async function (clause = {}, limit = null, orderBy = null) {
    try {
      const connections = await prisma.dcc_connections.findMany({
        where: clause,
        take: limit || undefined,
        orderBy: orderBy || { createdAt: "asc" },
      });
      return connections;
    } catch (error) {
      console.error("DCCConnection.where", error.message);
      return [];
    }
  },

  getAll: async function () {
    return await this.where();
  },

  delete: async function (id) {
    try {
      await prisma.dcc_connections.delete({
        where: { id: Number(id) },
      });
      return true;
    } catch (error) {
      console.error("DCCConnection.delete", error.message);
      return false;
    }
  },

  count: async function (clause = {}) {
    try {
      return await prisma.dcc_connections.count({ where: clause });
    } catch (error) {
      console.error("DCCConnection.count", error.message);
      return 0;
    }
  },
};

module.exports = { DCCConnection };
```

**Step 2: Commit**
```bash
git add server/models/dccConnection.js
git commit -m "feat(dcc): add DCCConnection server model"
```

---

### Task 1.3: Server Endpoints — dccConnections.js

**Files:**
- Create: `server/endpoints/dccConnections.js`
- Modify: `server/endpoints/api/index.js` (register routes)

**Step 1: Create the Express endpoint file**

Follow the pattern from `server/endpoints/mcpServers.js`:

```javascript
const { reqBody } = require("../utils/http");
const { DCCConnection } = require("../models/dccConnection");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../utils/middleware/validatedRequest");

function dccConnectionEndpoints(app) {
  if (!app) return;

  // List all DCC connections
  app.get(
    "/v1/dcc-connections",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (_request, response) => {
      try {
        const connections = await DCCConnection.getAll();
        return response.status(200).json({ connections, error: null });
      } catch (error) {
        console.error("Error listing DCC connections:", error);
        return response.status(500).json({ connections: [], error: error.message });
      }
    }
  );

  // Get single DCC connection
  app.get(
    "/v1/dcc-connections/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const connection = await DCCConnection.get({ id: Number(request.params.id) });
        if (!connection) {
          return response.status(404).json({ connection: null, error: "Connection not found" });
        }
        return response.status(200).json({ connection, error: null });
      } catch (error) {
        return response.status(500).json({ connection: null, error: error.message });
      }
    }
  );

  // Create DCC connection
  app.post(
    "/v1/dcc-connections/new",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { name, appType, host, port, transport, autoConnect } = reqBody(request);

        if (!name || !appType || !port) {
          return response.status(400).json({
            connection: null,
            error: "name, appType, and port are required",
          });
        }

        if (!DCCConnection.supportedAppTypes.includes(appType.toLowerCase())) {
          return response.status(400).json({
            connection: null,
            error: `Unsupported app type. Must be one of: ${DCCConnection.supportedAppTypes.join(", ")}`,
          });
        }

        const { connection, error } = await DCCConnection.new({
          name,
          appType: appType.toLowerCase(),
          host: host || "localhost",
          port,
          transport: transport || "sse",
          autoConnect: autoConnect || false,
        });

        return response.status(error ? 500 : 200).json({ connection, error });
      } catch (error) {
        console.error("Error creating DCC connection:", error);
        return response.status(500).json({ connection: null, error: error.message });
      }
    }
  );

  // Update DCC connection
  app.post(
    "/v1/dcc-connections/:id/update",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { connection, error } = await DCCConnection.update(
          request.params.id,
          reqBody(request)
        );
        return response.status(error ? 500 : 200).json({ connection, error });
      } catch (error) {
        return response.status(500).json({ connection: null, error: error.message });
      }
    }
  );

  // Delete DCC connection
  app.delete(
    "/v1/dcc-connections/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const success = await DCCConnection.delete(request.params.id);
        return response.status(success ? 200 : 500).json({
          success,
          error: success ? null : "Failed to delete connection",
        });
      } catch (error) {
        return response.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // Test connectivity to a DCC connection
  app.post(
    "/v1/dcc-connections/:id/test",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const connection = await DCCConnection.get({ id: Number(request.params.id) });
        if (!connection) {
          return response.status(404).json({ success: false, error: "Connection not found" });
        }

        // Try to establish MCP connection to verify it's reachable
        const MCPCompatibilityLayer = require("../utils/MCP");
        const mcp = new MCPCompatibilityLayer();

        // For now, do a simple TCP check via HTTP fetch or SSE probe
        try {
          const url = `http://${connection.host}:${connection.port}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          await fetch(`${url}/sse`, { signal: controller.signal }).catch(() => {});
          clearTimeout(timeout);
          return response.status(200).json({ success: true, error: null });
        } catch (e) {
          return response.status(200).json({
            success: false,
            error: `Could not reach ${connection.host}:${connection.port}`,
          });
        }
      } catch (error) {
        return response.status(500).json({ success: false, error: error.message });
      }
    }
  );
}

module.exports = { dccConnectionEndpoints };
```

**Step 2: Register the endpoints**

In the server boot file (find where `mcpServersEndpoints` is registered and add alongside):

```javascript
const { dccConnectionEndpoints } = require("./dccConnections");
// ... in the function that registers all routes:
dccConnectionEndpoints(app);
```

**Step 3: Commit**
```bash
git add server/endpoints/dccConnections.js server/endpoints/api/index.js
git commit -m "feat(dcc): add CRUD endpoints for DCC connections"
```

---

### Task 1.4: Frontend Model — dccConnection.js

**Files:**
- Create: `frontend/src/models/dccConnection.js`

**Step 1: Create the API wrapper**

Follow the pattern from `frontend/src/models/system.js`:

```javascript
import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const DCCConnection = {
  getAll: async () => {
    return fetch(`${API_BASE}/v1/dcc-connections`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res?.connections || [])
      .catch(() => []);
  },

  get: async (id) => {
    return fetch(`${API_BASE}/v1/dcc-connections/${id}`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => ({ connection: null, error: "Failed to fetch connection" }));
  },

  create: async (data) => {
    return fetch(`${API_BASE}/v1/dcc-connections/new`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => ({ connection: null, error: e.message }));
  },

  update: async (id, data) => {
    return fetch(`${API_BASE}/v1/dcc-connections/${id}/update`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => ({ connection: null, error: e.message }));
  },

  delete: async (id) => {
    return fetch(`${API_BASE}/v1/dcc-connections/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  test: async (id) => {
    return fetch(`${API_BASE}/v1/dcc-connections/${id}/test`, {
      method: "POST",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({ success: false, error: e.message }));
  },
};

export default DCCConnection;
```

**Step 2: Commit**
```bash
git add frontend/src/models/dccConnection.js
git commit -m "feat(dcc): add frontend API model for DCC connections"
```

---

### Task 1.5: Frontend — DCC Connections Settings Page

**Files:**
- Create: `frontend/src/pages/GeneralSettings/DCCConnections/index.jsx`
- Create: `frontend/src/pages/GeneralSettings/DCCConnections/DCCConnectionCard.jsx`
- Create: `frontend/src/pages/GeneralSettings/DCCConnections/NewConnectionModal.jsx`

**Step 1: Create the main settings page**

Follow the exact pattern from `frontend/src/pages/GeneralSettings/MobileConnections/index.jsx` — use SettingsSidebar, same layout, same card grid pattern.

The page displays:
- Header: "DCC Connections" with description "Connect to creative applications like Unreal Engine, Blender, Maya, Houdini, Unity, and Godot via MCP protocol."
- "Add Connection" button (opens modal)
- Grid of connection cards (each shows: app icon, name, host:port, status dot, edit/delete/test buttons)

App type icons: Use Phosphor icons or simple colored badges with app initials (UE, BL, MA, HO, UN, GO).

Color mapping for app types:
- unreal: `#0D47A1` (blue)
- blender: `#EA7600` (orange)
- maya: `#00BCD4` (teal)
- houdini: `#FF5722` (red-orange)
- unity: `#222C37` (dark gray)
- godot: `#478CBF` (blue)

**Step 2: Create DCCConnectionCard component**

Card layout (matches AnythingLLM card style):
```
┌─────────────────────────────┐
│ [AppBadge]  Connection Name │
│             host:port       │
│  ● Connected / ○ Offline    │
│                             │
│  [Test] [Edit] [Delete]     │
└─────────────────────────────┘
```

**Step 3: Create NewConnectionModal**

Modal with form fields:
- Name (text input)
- App Type (dropdown: Unreal Engine, Blender, Maya, Houdini, Unity, Godot)
- Host (text input, default: "localhost")
- Port (number input)
- Transport (dropdown: SSE, HTTP, Stdio — default SSE)
- Auto-connect on startup (checkbox)

Use the same modal pattern as `frontend/src/components/Modals/NewWorkspace/index.jsx`.

**Step 4: Commit**
```bash
git add frontend/src/pages/GeneralSettings/DCCConnections/
git commit -m "feat(dcc): add DCC connections settings page with card UI"
```

---

### Task 1.6: Frontend — Route + Settings Sidebar + Main Sidebar

**Files:**
- Modify: `frontend/src/main.jsx` (add route)
- Modify: `frontend/src/utils/paths.js` (add path)
- Modify: `frontend/src/components/SettingsSidebar/index.jsx` (add nav item)
- Modify: `frontend/src/components/Sidebar/index.jsx` (add connections section)

**Step 1: Add path to paths.js**

In `settings` object:
```javascript
dccConnections: () => "/settings/dcc-connections",
```

**Step 2: Add route to main.jsx**

Add alongside other admin routes:
```javascript
{
  path: "/settings/dcc-connections",
  lazy: async () => {
    const { default: DCCConnections } = await import(
      "@/pages/GeneralSettings/DCCConnections"
    );
    return { element: <AdminRoute Component={DCCConnections} /> };
  },
},
```

**Step 3: Add to SettingsSidebar**

In the `SidebarOptions` component, add a new `Option` group between "AI Providers" and "Admin":

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

Import `Plugs` from `@phosphor-icons/react`.

**Step 4: Add connections section to main Sidebar**

Below `<ActiveWorkspaces />` in the Sidebar, add a collapsible "Connections" section showing active DCC connections with status dots. This is a new component `DCCConnectionsList`:

Create: `frontend/src/components/Sidebar/DCCConnectionsList/index.jsx`

```jsx
import React, { useEffect, useState } from "react";
import { Plugs, Circle } from "@phosphor-icons/react";
import DCCConnection from "@/models/dccConnection";
import { Link } from "react-router-dom";
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
    DCCConnection.getAll().then(setConnections);
  }, []);

  if (connections.length === 0) return null;

  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex items-center gap-x-2 px-2 py-1">
        <Plugs className="h-4 w-4 text-theme-text-secondary" />
        <span className="text-theme-text-secondary text-xs font-medium uppercase">
          Connections
        </span>
      </div>
      {connections.map((conn) => (
        <Link
          key={conn.id}
          to={paths.settings.dccConnections()}
          className="flex items-center gap-x-2 px-3 py-1.5 rounded-lg hover:bg-theme-action-menu-item-hover transition-colors"
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: APP_TYPE_COLORS[conn.appType] || "#666" }}
          />
          <span className="text-theme-text-primary text-sm truncate">
            {conn.name}
          </span>
          <span className="text-theme-text-secondary text-xs ml-auto">
            {conn.appType}
          </span>
        </Link>
      ))}
    </div>
  );
}
```

In `Sidebar/index.jsx`, add after `<ActiveWorkspaces />`:
```jsx
<DCCConnectionsList />
```

**Step 5: Commit**
```bash
git add frontend/src/main.jsx frontend/src/utils/paths.js frontend/src/components/SettingsSidebar/index.jsx frontend/src/components/Sidebar/index.jsx frontend/src/components/Sidebar/DCCConnectionsList/
git commit -m "feat(dcc): wire up routes, settings sidebar, and main sidebar connections list"
```

---

## Phase 2: MCP Host (Outbound DCC Connections)

> **Depends on:** Phase 1 (DCC connections must exist in DB)

### Task 2.1: DCCMCPHost Module

**Files:**
- Create: `server/utils/DCCHost/index.js`

**Step 1: Create the DCC MCP Host**

This extends the MCP pattern but manages **outbound** connections TO DCC apps (vs existing MCPHypervisor which manages local MCP server processes).

```javascript
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { DCCConnection } = require("../../models/dccConnection");

class DCCMCPHost {
  static _instance = null;
  #connections = new Map(); // id -> { client, tools, connection }

  constructor() {
    if (DCCMCPHost._instance) return DCCMCPHost._instance;
    DCCMCPHost._instance = this;
  }

  async bootAutoConnections() {
    const connections = await DCCConnection.where({ autoConnect: true });
    for (const conn of connections) {
      await this.connect(conn.id).catch((e) =>
        console.error(`Failed to auto-connect DCC ${conn.name}:`, e.message)
      );
    }
  }

  async connect(connectionId) {
    const conn = await DCCConnection.get({ id: Number(connectionId) });
    if (!conn) throw new Error(`DCC connection ${connectionId} not found`);

    // Disconnect existing if reconnecting
    if (this.#connections.has(conn.id)) {
      await this.disconnect(conn.id);
    }

    const client = new Client({
      name: `kariana-dcc-${conn.appType}`,
      version: "1.0.0",
    });

    let transport;
    const url = `http://${conn.host}:${conn.port}`;

    if (conn.transport === "sse") {
      transport = new SSEClientTransport(new URL(`${url}/sse`));
    } else if (conn.transport === "http") {
      transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`));
    } else {
      throw new Error(`Transport "${conn.transport}" not supported for DCC connections. Use sse or http.`);
    }

    await client.connect(transport);

    // Discover tools from this DCC
    const toolsResult = await client.listTools();
    const tools = (toolsResult?.tools || []).map((tool) => ({
      ...tool,
      _connectionId: conn.id,
      _connectionName: conn.name,
      _appType: conn.appType,
      // Namespace: "blender.create_mesh" etc
      namespacedName: `${conn.appType}.${tool.name}`,
    }));

    this.#connections.set(conn.id, {
      client,
      transport,
      tools,
      connection: conn,
    });

    console.log(
      `[DCCHost] Connected to ${conn.name} (${conn.appType}) at ${conn.host}:${conn.port} — ${tools.length} tools`
    );

    return { tools, connection: conn };
  }

  async disconnect(connectionId) {
    const entry = this.#connections.get(Number(connectionId));
    if (!entry) return;

    try {
      await entry.client.close();
    } catch (e) {
      console.error(`Error closing DCC connection ${connectionId}:`, e.message);
    }
    this.#connections.delete(Number(connectionId));
  }

  async disconnectAll() {
    for (const [id] of this.#connections) {
      await this.disconnect(id);
    }
  }

  isConnected(connectionId) {
    return this.#connections.has(Number(connectionId));
  }

  getStatus() {
    const statuses = [];
    for (const [id, entry] of this.#connections) {
      statuses.push({
        id,
        name: entry.connection.name,
        appType: entry.connection.appType,
        host: entry.connection.host,
        port: entry.connection.port,
        connected: true,
        toolCount: entry.tools.length,
      });
    }
    return statuses;
  }

  // Get all tools from all connected DCCs (namespaced)
  getAllTools() {
    const allTools = [];
    for (const [, entry] of this.#connections) {
      allTools.push(...entry.tools);
    }
    return allTools;
  }

  // Find which connection owns a namespaced tool
  resolveToolConnection(namespacedToolName) {
    for (const [, entry] of this.#connections) {
      const tool = entry.tools.find(
        (t) => t.namespacedName === namespacedToolName || t.name === namespacedToolName
      );
      if (tool) return { tool, entry };
    }
    return null;
  }

  // Execute a tool on a connected DCC
  async callTool(namespacedToolName, args = {}) {
    const resolved = this.resolveToolConnection(namespacedToolName);
    if (!resolved) {
      throw new Error(`No connected DCC has tool "${namespacedToolName}"`);
    }

    const { tool, entry } = resolved;
    const result = await entry.client.callTool({
      name: tool.name, // Use original (un-namespaced) name for the actual call
      arguments: args,
    });

    return {
      ...result,
      _connectionName: entry.connection.name,
      _appType: entry.connection.appType,
    };
  }
}

module.exports = DCCMCPHost;
```

**Step 2: Commit**
```bash
git add server/utils/DCCHost/
git commit -m "feat(mcp-host): add DCCMCPHost for outbound MCP connections to DCC apps"
```

---

### Task 2.2: DCC Connection Status Endpoints

**Files:**
- Modify: `server/endpoints/dccConnections.js`

**Step 1: Add connect/disconnect/status endpoints**

Add to the existing `dccConnectionEndpoints` function:

```javascript
const DCCMCPHost = require("../utils/DCCHost");

// Connect to a DCC app
app.post(
  "/v1/dcc-connections/:id/connect",
  [validatedRequest, flexUserRoleValid([ROLES.admin])],
  async (request, response) => {
    try {
      const host = new DCCMCPHost();
      const result = await host.connect(request.params.id);
      return response.status(200).json({
        success: true,
        tools: result.tools.map((t) => ({ name: t.namespacedName, description: t.description })),
        error: null,
      });
    } catch (error) {
      return response.status(500).json({ success: false, tools: [], error: error.message });
    }
  }
);

// Disconnect from a DCC app
app.post(
  "/v1/dcc-connections/:id/disconnect",
  [validatedRequest, flexUserRoleValid([ROLES.admin])],
  async (request, response) => {
    try {
      const host = new DCCMCPHost();
      await host.disconnect(request.params.id);
      return response.status(200).json({ success: true, error: null });
    } catch (error) {
      return response.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get live status of all DCC connections
app.get(
  "/v1/dcc-connections/status",
  [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
  async (_request, response) => {
    try {
      const host = new DCCMCPHost();
      const statuses = host.getStatus();
      const allConnections = await DCCConnection.getAll();

      // Merge DB connections with live status
      const merged = allConnections.map((conn) => {
        const live = statuses.find((s) => s.id === conn.id);
        return {
          ...conn,
          connected: !!live,
          toolCount: live?.toolCount || 0,
        };
      });

      return response.status(200).json({ connections: merged, error: null });
    } catch (error) {
      return response.status(500).json({ connections: [], error: error.message });
    }
  }
);

// List all available DCC tools (from connected apps)
app.get(
  "/v1/dcc-connections/tools",
  [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
  async (_request, response) => {
    try {
      const host = new DCCMCPHost();
      const tools = host.getAllTools().map((t) => ({
        name: t.namespacedName,
        originalName: t.name,
        description: t.description,
        appType: t._appType,
        connectionName: t._connectionName,
        inputSchema: t.inputSchema,
      }));
      return response.status(200).json({ tools, error: null });
    } catch (error) {
      return response.status(500).json({ tools: [], error: error.message });
    }
  }
);
```

**Step 2: Add connect/disconnect/status to frontend model**

In `frontend/src/models/dccConnection.js`, add:

```javascript
connect: async (id) => {
  return fetch(`${API_BASE}/v1/dcc-connections/${id}/connect`, {
    method: "POST",
    headers: baseHeaders(),
  })
    .then((res) => res.json())
    .catch((e) => ({ success: false, error: e.message }));
},

disconnect: async (id) => {
  return fetch(`${API_BASE}/v1/dcc-connections/${id}/disconnect`, {
    method: "POST",
    headers: baseHeaders(),
  })
    .then((res) => res.json())
    .catch((e) => ({ success: false, error: e.message }));
},

status: async () => {
  return fetch(`${API_BASE}/v1/dcc-connections/status`, {
    method: "GET",
    headers: baseHeaders(),
  })
    .then((res) => res.json())
    .then((res) => res?.connections || [])
    .catch(() => []);
},

tools: async () => {
  return fetch(`${API_BASE}/v1/dcc-connections/tools`, {
    method: "GET",
    headers: baseHeaders(),
  })
    .then((res) => res.json())
    .then((res) => res?.tools || [])
    .catch(() => []);
},
```

**Step 3: Commit**
```bash
git add server/endpoints/dccConnections.js frontend/src/models/dccConnection.js
git commit -m "feat(mcp-host): add connect/disconnect/status/tools endpoints"
```

---

### Task 2.3: Boot Auto-Connect on Server Start

**Files:**
- Modify: `server/index.js` (add DCCMCPHost boot)

**Step 1: Add auto-connect boot**

In `server/index.js`, after the existing MCP server boot, add:

```javascript
const DCCMCPHost = require("./utils/DCCHost");

// After server starts listening:
new DCCMCPHost().bootAutoConnections().then(() => {
  console.log("[DCCHost] Auto-connect DCC connections booted");
}).catch((e) => {
  console.error("[DCCHost] Error booting auto-connect:", e.message);
});
```

**Step 2: Commit**
```bash
git add server/index.js
git commit -m "feat(mcp-host): boot auto-connect DCC connections on server start"
```

---

### Task 2.4: Update Frontend Cards with Connect/Disconnect

**Files:**
- Modify: `frontend/src/pages/GeneralSettings/DCCConnections/DCCConnectionCard.jsx`

**Step 1: Add connect/disconnect buttons and live status to cards**

Cards should show:
- Green pulsing dot when connected (with tool count)
- Gray dot when disconnected
- Connect/Disconnect toggle button
- Tool list expandable section when connected

**Step 2: Commit**
```bash
git add frontend/src/pages/GeneralSettings/DCCConnections/
git commit -m "feat(mcp-host): update DCC cards with connect/disconnect and live status"
```

---

## Phase 3: Smart Routing + Agent Loop Enhancement

> **Depends on:** Phase 2 (needs DCCMCPHost and connected tools)

### Task 3.1: Inject DCC Tools into Agent

**Files:**
- Modify: `server/utils/agents/index.js` (AgentHandler)
- Modify: `server/utils/MCP/index.js` (MCPCompatibilityLayer)

**Step 1: Extend MCPCompatibilityLayer to include DCC tools**

In `MCPCompatibilityLayer`, add a method that merges DCC host tools as agent plugins:

```javascript
const DCCMCPHost = require("../DCCHost");

// Add to MCPCompatibilityLayer class:
activeDCCTools() {
  const host = new DCCMCPHost();
  const tools = host.getAllTools();
  return tools.map((tool) => ({
    name: `@@dcc_${tool._appType}_${tool.name}`,
    plugin: this.#convertDCCToolToPlugin(tool),
  }));
}

#convertDCCToolToPlugin(tool) {
  const host = new DCCMCPHost();
  return {
    name: `@@dcc_${tool._appType}_${tool.name}`,
    startupConfig: {
      params: {},
    },
    plugin: function () {
      return {
        name: this.name,
        setup(aibitat) {
          aibitat.function({
            super: aibitat,
            name: this.name,
            description: `[${tool._appType.toUpperCase()}] ${tool.description || tool.name}`,
            parameters: tool.inputSchema || { type: "object", properties: {} },
            handler: async function (args) {
              try {
                const result = await host.callTool(tool.namespacedName, args);
                const content = result?.content;
                if (Array.isArray(content)) {
                  return content.map((c) => c?.text || JSON.stringify(c)).join("\n");
                }
                return typeof content === "string" ? content : JSON.stringify(content || result);
              } catch (e) {
                return `Error executing ${tool.namespacedName}: ${e.message}`;
              }
            },
          });
        },
      };
    },
  };
}
```

**Step 2: In AgentHandler, load DCC tools alongside MCP plugins**

Where existing MCP plugins are loaded (search for `activeMCPServers` in agent setup), add:

```javascript
// After loading MCP server plugins:
const dccTools = mcp.activeDCCTools();
for (const dccTool of dccTools) {
  // Add to the agent's available functions
  plugins.push(dccTool.plugin);
}
```

**Step 3: Commit**
```bash
git add server/utils/MCP/index.js server/utils/agents/index.js
git commit -m "feat(smart-routing): inject DCC tools into agent loop via MCPCompatibilityLayer"
```

---

### Task 3.2: Dynamic System Prompt with DCC Context

**Files:**
- Create: `server/utils/DCCHost/systemPrompt.js`

**Step 1: Create DCC system prompt injection**

```javascript
const DCCMCPHost = require("./index");

function getDCCSystemPromptInjection() {
  const host = new DCCMCPHost();
  const statuses = host.getStatus();

  if (statuses.length === 0) return "";

  const connectionDescriptions = statuses.map((s) => {
    const tools = host.getAllTools().filter((t) => t._connectionId === s.id);
    const toolNames = tools.map((t) => t.namespacedName).join(", ");
    return `- **${s.name}** (${s.appType}, ${s.host}:${s.port}): ${s.toolCount} tools available [${toolNames}]`;
  });

  return `
## Connected DCC Applications

You have access to the following creative applications via MCP:

${connectionDescriptions.join("\n")}

When the user asks you to perform actions in these applications, use the appropriate tool. Tool names are namespaced by app type (e.g., \`blender.create_mesh\`, \`unreal.spawn_actor\`).

If the user's request could apply to multiple connected apps, ask them to clarify which app they mean.
`.trim();
}

module.exports = { getDCCSystemPromptInjection };
```

**Step 2: Inject into workspace system prompt**

In the chat stream handler (`server/utils/chats/stream.js`), where the system prompt is built, append the DCC injection:

```javascript
const { getDCCSystemPromptInjection } = require("../DCCHost/systemPrompt");

// Where system prompt is assembled:
const dccPrompt = getDCCSystemPromptInjection();
if (dccPrompt) {
  systemPrompt += `\n\n${dccPrompt}`;
}
```

**Step 3: Commit**
```bash
git add server/utils/DCCHost/systemPrompt.js server/utils/chats/stream.js
git commit -m "feat(smart-routing): inject DCC context into system prompt for smart routing"
```

---

## Phase 4: Project-Based Organization

### Task 4.1: Project Prisma Model

**Files:**
- Modify: `server/prisma/schema.prisma`

**Step 1: Add Project model**

```prisma
model projects {
  id                Int      @id @default(autoincrement())
  name              String
  slug              String   @unique
  description       String?  @default("")
  defaultAppType    String?  // Primary DCC app for this project
  settings          String?  @default("{}") // JSON blob for project-specific settings
  createdBy         Int?
  createdAt         DateTime @default(now())
  lastUpdatedAt     DateTime @default(now())

  project_connections project_connections[]
  project_workspaces  project_workspaces[]
}

model project_connections {
  id              Int      @id @default(autoincrement())
  projectId       Int
  connectionId    Int
  createdAt       DateTime @default(now())

  project         projects @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, connectionId])
}

model project_workspaces {
  id              Int      @id @default(autoincrement())
  projectId       Int
  workspaceId     Int
  createdAt       DateTime @default(now())

  project         projects   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  workspace       workspaces @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([projectId, workspaceId])
}
```

Also add to the `workspaces` model:
```prisma
project_workspaces  project_workspaces[]
```

**Step 2: Generate migration**
```bash
cd server && npx prisma migrate dev --name add_projects
```

**Step 3: Commit**
```bash
git add server/prisma/
git commit -m "feat(projects): add Project, ProjectConnection, ProjectWorkspace prisma models"
```

---

### Task 4.2: Server Model + Endpoints for Projects

**Files:**
- Create: `server/models/project.js`
- Create: `server/endpoints/projects.js`

**Step 1: Create Project model wrapper**

Follow same pattern as `dccConnection.js`:
- `new()`, `update()`, `get()`, `where()`, `getAll()`, `delete()`
- `addConnection(projectId, connectionId)`
- `removeConnection(projectId, connectionId)`
- `getConnections(projectId)`
- `addWorkspace(projectId, workspaceId)`
- `removeWorkspace(projectId, workspaceId)`
- `getWorkspaces(projectId)`
- Slug generation: lowercase, hyphenated from name

**Step 2: Create CRUD endpoints**

```
GET    /v1/projects          — list all projects
POST   /v1/projects/new      — create project
POST   /v1/projects/:id/update — update project
DELETE /v1/projects/:id      — delete project
POST   /v1/projects/:id/connections/add    — link connection
POST   /v1/projects/:id/connections/remove — unlink connection
GET    /v1/projects/:id/connections        — list project connections
POST   /v1/projects/:id/workspaces/add     — link workspace
POST   /v1/projects/:id/workspaces/remove  — unlink workspace
GET    /v1/projects/:id/workspaces         — list project workspaces
```

**Step 3: Register endpoints and commit**
```bash
git add server/models/project.js server/endpoints/projects.js
git commit -m "feat(projects): add Project server model and CRUD endpoints"
```

---

### Task 4.3: Frontend — Projects UI

**Files:**
- Create: `frontend/src/models/project.js`
- Create: `frontend/src/pages/GeneralSettings/Projects/index.jsx`
- Create: `frontend/src/pages/GeneralSettings/Projects/ProjectCard.jsx`
- Create: `frontend/src/pages/GeneralSettings/Projects/NewProjectModal.jsx`

**Step 1: Create frontend API model** (same pattern as dccConnection.js)

**Step 2: Create Projects settings page**

Layout: Same card grid as DCC Connections, but each card shows:
- Project name + description
- Linked DCC connections (colored badges)
- Linked workspaces count
- Edit/Delete buttons

**Step 3: Create NewProjectModal**

Fields:
- Name
- Description
- Default App Type (optional dropdown)
- Link existing connections (multi-select checkboxes)
- Link existing workspaces (multi-select checkboxes)

**Step 4: Add route + settings sidebar entry**

- Path: `/settings/projects`
- SettingsSidebar: Add under "Admin" section with `FolderSimple` icon

**Step 5: Commit**
```bash
git add frontend/src/models/project.js frontend/src/pages/GeneralSettings/Projects/ frontend/src/main.jsx frontend/src/utils/paths.js frontend/src/components/SettingsSidebar/index.jsx
git commit -m "feat(projects): add Projects settings page with card UI and routing"
```

---

## Phase 5: Clerk Authentication

### Task 5.1: Install Clerk Dependencies

**Step 1: Install packages**

```bash
cd frontend && yarn add @clerk/clerk-react
cd ../server && yarn add @clerk/express
```

**Step 2: Add env vars**

In `.env` (already has CLERK keys from memory):
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
```

**Step 3: Commit**
```bash
git add frontend/package.json server/package.json yarn.lock .env.example
git commit -m "feat(clerk): install @clerk/clerk-react and @clerk/express"
```

---

### Task 5.2: Frontend — Clerk Provider

**Files:**
- Modify: `frontend/src/App.jsx` (wrap with ClerkProvider)
- Create: `frontend/src/components/ClerkAuth/index.jsx`

**Step 1: Wrap App with ClerkProvider**

In `App.jsx`, add conditional Clerk wrapping (so it doesn't break if no key):

```jsx
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Wrap the auth provider conditionally
function AuthWrapper({ children }) {
  if (!clerkPubKey) return children; // Fall back to existing auth
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      {children}
    </ClerkProvider>
  );
}
```

**Step 2: Create ClerkAuth guard component**

Uses `useAuth()` from Clerk to protect routes. Falls back to existing JWT auth if Clerk is not configured.

**Step 3: Commit**
```bash
git add frontend/src/App.jsx frontend/src/components/ClerkAuth/
git commit -m "feat(clerk): add ClerkProvider wrapper and auth guard component"
```

---

### Task 5.3: Backend — Clerk Middleware

**Files:**
- Create: `server/utils/middleware/clerkAuth.js`
- Modify: `server/utils/middleware/validatedRequest.js`

**Step 1: Create Clerk middleware**

```javascript
const { clerkClient, requireAuth } = require("@clerk/express");

function clerkAuthMiddleware() {
  if (!process.env.CLERK_SECRET_KEY) return null; // Clerk not configured

  return requireAuth();
}

// Sync Clerk user to local DB on first auth
async function syncClerkUser(req, res, next) {
  if (!req.auth?.userId) return next();

  const User = require("../../models/user");
  const existing = await User.get({ clerkId: req.auth.userId });
  if (!existing) {
    const clerkUser = await clerkClient.users.getUser(req.auth.userId);
    await User.createFromClerk({
      clerkId: clerkUser.id,
      username: clerkUser.username || clerkUser.emailAddresses[0]?.emailAddress,
      role: "default",
    });
  }

  next();
}

module.exports = { clerkAuthMiddleware, syncClerkUser };
```

**Step 2: Update validatedRequest to support both auth modes**

Check if Clerk is configured; if so, validate Clerk session token. Otherwise, fall back to existing JWT validation.

**Step 3: Commit**
```bash
git add server/utils/middleware/clerkAuth.js server/utils/middleware/validatedRequest.js
git commit -m "feat(clerk): add Clerk middleware with fallback to JWT auth"
```

---

### Task 5.4: User Model — Clerk ID Field

**Files:**
- Modify: `server/prisma/schema.prisma` (add clerkId to users)
- Modify: `server/models/user.js` (add createFromClerk method)

**Step 1: Add clerkId field**

```prisma
model users {
  // ... existing fields
  clerkId String? @unique
}
```

**Step 2: Migrate**
```bash
cd server && npx prisma migrate dev --name add_clerk_id
```

**Step 3: Add createFromClerk to User model**
```javascript
createFromClerk: async function ({ clerkId, username, role }) {
  // Create user with Clerk ID, no password needed
}
```

**Step 4: Commit**
```bash
git add server/prisma/ server/models/user.js
git commit -m "feat(clerk): add clerkId to users model and sync method"
```

---

## Phase 6: System-Level Agent Fallback (Future)

> **Deferred** — This phase requires significant research into screen capture APIs, OS-level input automation, and cross-platform compatibility. It should be planned separately after Phases 1-5 are stable.

**Scope:**
- Screen capture from DCC apps without MCP plugins
- Input automation (keyboard/mouse) for basic operations
- OCR for reading app state from screenshots
- Fallback tool registration when MCP is unavailable

**Not implemented in this plan.**

---

## Execution Order

```
Batch 1 (parallel branches):
  ├── phase-1-dcc-connections (Tasks 1.1 → 1.6)
  ├── phase-4-projects (Tasks 4.1 → 4.3)
  └── phase-5-clerk-auth (Tasks 5.1 → 5.4)

Merge all Batch 1 → master

Batch 2 (sequential):
  ├── phase-2-mcp-host (Tasks 2.1 → 2.4)
  └── phase-3-smart-routing (Tasks 3.1 → 3.2)

Merge Batch 2 → master
```
