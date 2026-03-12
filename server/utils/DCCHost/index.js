const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  SSEClientTransport,
} = require("@modelcontextprotocol/sdk/client/sse.js");
const {
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { DCCConnection } = require("../../models/dccConnection");

/**
 * @class DCCMCPHost
 * @description Singleton that manages outbound MCP connections TO DCC applications
 * (Unreal Engine, Blender, Maya, Houdini, Unity, Godot).
 *
 * Unlike MCPHypervisor which manages local MCP server processes, this class
 * connects to remote DCC applications that expose MCP endpoints.
 *
 * Tools are namespaced by appType (e.g., `blender.create_mesh`, `unreal.spawn_actor`)
 * to avoid collisions when multiple DCCs are connected.
 */
class DCCMCPHost {
  static _instance;

  /**
   * Active connections map: connectionId -> { client, transport, tools, connection }
   * @type {Map<number, {client: Client, transport: object, tools: Array, connection: object}>}
   */
  connections = new Map();

  constructor() {
    if (DCCMCPHost._instance) return DCCMCPHost._instance;
    DCCMCPHost._instance = this;
    this.className = "DCCMCPHost";
    this.log("Initializing DCC MCP Host");
    return this;
  }

  log(text, ...args) {
    console.log(`\x1b[35m[${this.className}]\x1b[0m ${text}`, ...args);
  }

  /**
   * Boot all DCC connections that have autoConnect=true
   * @returns {Promise<void>}
   */
  async bootAutoConnections() {
    try {
      const autoConnectList = await DCCConnection.where({ autoConnect: true });
      if (autoConnectList.length === 0) {
        this.log("No auto-connect DCC connections found");
        return;
      }

      this.log(
        `Found ${autoConnectList.length} auto-connect DCC connection(s)`
      );

      for (const conn of autoConnectList) {
        try {
          await this.connect(conn.id);
        } catch (e) {
          this.log(
            `Failed to auto-connect to "${conn.name}" (${conn.appType}):`,
            e.message
          );
        }
      }

      this.log(
        `Auto-connect complete. ${this.connections.size} connection(s) active.`
      );
    } catch (e) {
      this.log("Error during auto-connect boot:", e.message);
    }
  }

  /**
   * Establish an MCP connection to a DCC app by its database ID
   * @param {number} connectionId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async connect(connectionId) {
    if (this.connections.has(connectionId)) {
      return {
        success: false,
        error: "Connection is already active",
      };
    }

    const connection = await DCCConnection.get({ id: connectionId });
    if (!connection) {
      return { success: false, error: "Connection not found in database" };
    }

    const { host, port, transport: transportType, name, appType } = connection;

    if (transportType === "stdio") {
      this.log(
        `Warning: stdio transport is not supported for remote DCC connections (${name})`
      );
      return {
        success: false,
        error:
          "stdio transport is not supported for remote DCC connections. Use SSE or HTTP.",
      };
    }

    this.log(`Connecting to "${name}" (${appType}) at ${host}:${port}...`);

    const client = new Client({ name: `dcc-${name}`, version: "1.0.0" });
    let mcpTransport;

    try {
      mcpTransport = this.#createTransport(transportType, host, port);
    } catch (e) {
      return { success: false, error: `Failed to create transport: ${e.message}` };
    }

    // Set up transport event listeners
    mcpTransport.onclose = () =>
      this.log(`${name} - Transport closed`);
    mcpTransport.onerror = (error) =>
      this.log(`${name} - Transport error:`, error);

    // Connect with a timeout
    const connectionPromise = client.connect(mcpTransport);
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Connection timeout (30s)")),
        30_000
      );
    });

    try {
      await Promise.race([connectionPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      // Clean up on failure
      try {
        await client.close();
      } catch {
        // ignore cleanup errors
      }
      return { success: false, error: error.message };
    }

    // Discover tools from the connected DCC
    let tools = [];
    try {
      const toolsResult = await client.listTools();
      tools = (toolsResult?.tools || []).map((tool) => ({
        ...tool,
        namespacedName: `${appType}.${tool.name}`,
        connectionId,
        appType,
        connectionName: name,
      }));
      this.log(
        `Discovered ${tools.length} tool(s) from "${name}" (${appType})`
      );
    } catch (e) {
      this.log(`Warning: Could not list tools from "${name}":`, e.message);
    }

    this.connections.set(connectionId, {
      client,
      transport: mcpTransport,
      tools,
      connection,
    });

    this.log(
      `Connected to "${name}" (${appType}) - ${tools.length} tool(s) available`
    );
    return { success: true };
  }

  /**
   * Create the appropriate MCP transport based on the transport type
   * @param {string} transportType - "sse" or "http"
   * @param {string} host
   * @param {number} port
   * @returns {SSEClientTransport | StreamableHTTPClientTransport}
   */
  #createTransport(transportType, host, port) {
    const baseUrl = `http://${host}:${port}`;

    if (transportType === "http") {
      try {
        return new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
      } catch (e) {
        this.log(
          `StreamableHTTP transport failed, falling back to SSE:`,
          e.message
        );
        return new SSEClientTransport(new URL(`${baseUrl}/sse`));
      }
    }

    // Default to SSE
    return new SSEClientTransport(new URL(`${baseUrl}/sse`));
  }

  /**
   * Disconnect an active MCP connection
   * @param {number} connectionId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async disconnect(connectionId) {
    const entry = this.connections.get(connectionId);
    if (!entry) {
      return { success: false, error: "Connection is not active" };
    }

    const { client, connection } = entry;
    this.log(`Disconnecting from "${connection.name}" (${connection.appType})`);

    try {
      await client.close();
    } catch (e) {
      this.log(`Warning during disconnect:`, e.message);
    }

    this.connections.delete(connectionId);
    this.log(`Disconnected from "${connection.name}"`);
    return { success: true };
  }

  /**
   * Disconnect all active MCP connections
   * @returns {Promise<void>}
   */
  async disconnectAll() {
    const ids = Array.from(this.connections.keys());
    this.log(`Disconnecting ${ids.length} connection(s)...`);

    for (const id of ids) {
      await this.disconnect(id);
    }

    this.log("All DCC connections disconnected");
  }

  /**
   * Check if a connection is currently active
   * @param {number} connectionId
   * @returns {boolean}
   */
  isConnected(connectionId) {
    return this.connections.has(connectionId);
  }

  /**
   * Get the live status of all DCC connections (merging DB records with live state)
   * @returns {Promise<Array<{id: number, name: string, appType: string, host: string, port: number, connected: boolean, toolCount: number}>>}
   */
  async getStatus() {
    const allConnections = await DCCConnection.getAll();
    return allConnections.map((conn) => {
      const active = this.connections.get(conn.id);
      return {
        id: conn.id,
        name: conn.name,
        appType: conn.appType,
        host: conn.host,
        port: conn.port,
        transport: conn.transport,
        autoConnect: conn.autoConnect,
        connected: !!active,
        toolCount: active ? active.tools.length : 0,
      };
    });
  }

  /**
   * Get all tools from all connected DCCs with namespaced names
   * @returns {Array<{name: string, namespacedName: string, description: string, inputSchema: object, connectionId: number, appType: string, connectionName: string}>}
   */
  getAllTools() {
    const allTools = [];
    for (const [, entry] of this.connections) {
      allTools.push(...entry.tools);
    }
    return allTools;
  }

  /**
   * Resolve which connection owns a namespaced tool name
   * @param {string} namespacedToolName - e.g., "blender.create_mesh"
   * @returns {{connectionId: number, toolName: string, entry: object} | null}
   */
  resolveToolConnection(namespacedToolName) {
    for (const [connectionId, entry] of this.connections) {
      const tool = entry.tools.find(
        (t) => t.namespacedName === namespacedToolName
      );
      if (tool) {
        return {
          connectionId,
          toolName: tool.name,
          entry,
        };
      }
    }
    return null;
  }

  /**
   * Execute a tool on the correct DCC connection
   * @param {string} namespacedToolName - e.g., "blender.create_mesh"
   * @param {object} args - Tool arguments
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async callTool(namespacedToolName, args = {}) {
    const resolved = this.resolveToolConnection(namespacedToolName);
    if (!resolved) {
      return {
        success: false,
        error: `No connected DCC owns tool "${namespacedToolName}"`,
      };
    }

    const { entry, toolName } = resolved;
    const { client, connection } = entry;

    this.log(
      `Calling tool "${toolName}" on "${connection.name}" (${connection.appType})`
    );

    try {
      const result = await client.callTool({ name: toolName, arguments: args });
      return { success: true, result };
    } catch (e) {
      this.log(`Tool call failed for "${namespacedToolName}":`, e.message);
      return { success: false, error: e.message };
    }
  }
}

module.exports = DCCMCPHost;
