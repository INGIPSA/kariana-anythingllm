const { reqBody } = require("../utils/http");
const { DCCConnection } = require("../models/dccConnection");
const DCCMCPHost = require("../utils/DCCHost");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../utils/middleware/validatedRequest");

function dccConnectionEndpoints(app) {
  if (!app) return;

  app.get(
    "/v1/dcc-connections",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (_request, response) => {
      try {
        const connections = await DCCConnection.getAll();
        return response.status(200).json({
          success: true,
          connections,
        });
      } catch (error) {
        console.error("Error listing DCC connections:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
          connections: [],
        });
      }
    }
  );

  // Status and tools endpoints must come before /:id to avoid route conflicts
  app.get(
    "/v1/dcc-connections/status",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (_request, response) => {
      try {
        const host = new DCCMCPHost();
        const status = await host.getStatus();
        return response.status(200).json({
          success: true,
          connections: status,
        });
      } catch (error) {
        console.error("Error getting DCC connection status:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
          connections: [],
        });
      }
    }
  );

  app.get(
    "/v1/dcc-connections/tools",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (_request, response) => {
      try {
        const host = new DCCMCPHost();
        const tools = host.getAllTools().map((tool) => ({
          name: tool.name,
          namespacedName: tool.namespacedName,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {},
          connectionId: tool.connectionId,
          appType: tool.appType,
          connectionName: tool.connectionName,
        }));
        return response.status(200).json({
          success: true,
          tools,
        });
      } catch (error) {
        console.error("Error listing DCC tools:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
          tools: [],
        });
      }
    }
  );

  app.get(
    "/v1/dcc-connections/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const connection = await DCCConnection.get({
          id: parseInt(id),
        });
        if (!connection) {
          return response.status(404).json({
            success: false,
            error: "Connection not found",
          });
        }
        return response.status(200).json({
          success: true,
          connection,
        });
      } catch (error) {
        console.error("Error getting DCC connection:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.post(
    "/v1/dcc-connections/new",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const data = reqBody(request);

        if (
          data.appType &&
          !DCCConnection.supportedAppTypes.includes(data.appType)
        ) {
          return response.status(400).json({
            success: false,
            error: `Invalid appType. Must be one of: ${DCCConnection.supportedAppTypes.join(", ")}`,
          });
        }

        const creatorId = response.locals?.user?.id || null;
        const { connection, message } = await DCCConnection.new(
          data,
          creatorId
        );

        if (!connection) {
          return response.status(400).json({
            success: false,
            error: message,
          });
        }

        return response.status(200).json({
          success: true,
          connection,
        });
      } catch (error) {
        console.error("Error creating DCC connection:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.post(
    "/v1/dcc-connections/:id/update",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const data = reqBody(request);

        if (
          data.appType &&
          !DCCConnection.supportedAppTypes.includes(data.appType)
        ) {
          return response.status(400).json({
            success: false,
            error: `Invalid appType. Must be one of: ${DCCConnection.supportedAppTypes.join(", ")}`,
          });
        }

        const { connection, message } = await DCCConnection.update(
          parseInt(id),
          data
        );

        if (!connection) {
          return response.status(400).json({
            success: false,
            error: message,
          });
        }

        return response.status(200).json({
          success: true,
          connection,
        });
      } catch (error) {
        console.error("Error updating DCC connection:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/v1/dcc-connections/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const deleted = await DCCConnection.delete({ id: parseInt(id) });
        return response.status(200).json({
          success: deleted,
          error: deleted ? null : "Failed to delete connection",
        });
      } catch (error) {
        console.error("Error deleting DCC connection:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.post(
    "/v1/dcc-connections/:id/test",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const connection = await DCCConnection.get({ id: parseInt(id) });

        if (!connection) {
          return response.status(404).json({
            success: false,
            error: "Connection not found",
          });
        }

        // Simple HTTP probe to host:port with 5s timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const url = `http://${connection.host}:${connection.port}`;
          await fetch(url, {
            method: "GET",
            signal: controller.signal,
          });
          clearTimeout(timeout);
          return response.status(200).json({
            success: true,
            message: "Connection successful",
          });
        } catch (fetchError) {
          clearTimeout(timeout);
          return response.status(200).json({
            success: false,
            error: `Could not reach ${connection.host}:${connection.port} - ${fetchError.message}`,
          });
        }
      } catch (error) {
        console.error("Error testing DCC connection:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.post(
    "/v1/dcc-connections/:id/connect",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const host = new DCCMCPHost();
        const result = await host.connect(parseInt(id));
        return response.status(200).json(result);
      } catch (error) {
        console.error("Error connecting to DCC:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );

  app.post(
    "/v1/dcc-connections/:id/disconnect",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const host = new DCCMCPHost();
        const result = await host.disconnect(parseInt(id));
        return response.status(200).json(result);
      } catch (error) {
        console.error("Error disconnecting from DCC:", error);
        return response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    }
  );
}

module.exports = { dccConnectionEndpoints };
