const { Project } = require("../models/project");
const { reqBody, userFromSession } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { EventLogs } = require("../models/eventLogs");

function projectEndpoints(app) {
  if (!app) return;

  // List all projects
  app.get(
    "/v1/projects",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (_request, response) => {
      try {
        const projects = await Project.getAll();
        response.status(200).json({ projects });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // Get a single project with connections and workspaces
  app.get(
    "/v1/projects/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const project = await Project.get({ id: Number(id) });
        if (!project) {
          response.status(404).json({ message: "Project not found" });
          return;
        }
        response.status(200).json({ project });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // Create a new project
  app.post(
    "/v1/projects/new",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const user = await userFromSession(request, response);
        const { name, description, defaultAppType } = reqBody(request);
        const { project, message } = await Project.new(
          { name, description, defaultAppType },
          user?.id
        );

        if (project) {
          await EventLogs.logEvent(
            "project_created",
            { projectName: project.name },
            user?.id
          );
        }

        response.status(200).json({ project, message });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // Update a project
  app.post(
    "/v1/projects/:id/update",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const updates = reqBody(request);
        const { project, message } = await Project.update(
          Number(id),
          updates
        );
        response.status(200).json({ project, message });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // Delete a project
  app.delete(
    "/v1/projects/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const user = await userFromSession(request, response);
        const project = await Project.get({ id: Number(id) });

        if (!project) {
          response.status(404).json({ message: "Project not found" });
          return;
        }

        await Project.delete({ id: Number(id) });
        await EventLogs.logEvent(
          "project_deleted",
          { projectName: project.name },
          user?.id
        );

        response.status(200).json({ success: true });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // --- Connection linking ---

  // Add connection to project
  app.post(
    "/v1/projects/:id/connections/add",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const { connectionId } = reqBody(request);
        if (!connectionId) {
          response.status(400).json({ message: "connectionId is required" });
          return;
        }
        const result = await Project.addConnection(
          Number(id),
          Number(connectionId)
        );
        response.status(200).json(result);
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // Remove connection from project
  app.post(
    "/v1/projects/:id/connections/remove",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const { connectionId } = reqBody(request);
        if (!connectionId) {
          response.status(400).json({ message: "connectionId is required" });
          return;
        }
        const result = await Project.removeConnection(
          Number(id),
          Number(connectionId)
        );
        response.status(200).json(result);
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // List connections for a project
  app.get(
    "/v1/projects/:id/connections",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const connections = await Project.getConnections(Number(id));
        response.status(200).json({ connections });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // --- Workspace linking ---

  // Add workspace to project
  app.post(
    "/v1/projects/:id/workspaces/add",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const { workspaceId } = reqBody(request);
        if (!workspaceId) {
          response.status(400).json({ message: "workspaceId is required" });
          return;
        }
        const result = await Project.addWorkspace(
          Number(id),
          Number(workspaceId)
        );
        response.status(200).json(result);
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // Remove workspace from project
  app.post(
    "/v1/projects/:id/workspaces/remove",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const { workspaceId } = reqBody(request);
        if (!workspaceId) {
          response.status(400).json({ message: "workspaceId is required" });
          return;
        }
        const result = await Project.removeWorkspace(
          Number(id),
          Number(workspaceId)
        );
        response.status(200).json(result);
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  // List workspaces for a project
  app.get(
    "/v1/projects/:id/workspaces",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const { id } = request.params;
        const workspaces = await Project.getWorkspaces(Number(id));
        response.status(200).json({ workspaces });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );
}

module.exports = { projectEndpoints };
